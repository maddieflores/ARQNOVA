import { BadGatewayException, GatewayTimeoutException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER, type AiImageInput, type AiProvider } from './ai-provider';
import { AiActionType, AiUmlProposalDto } from './dto/ai-uml-proposal.dto';

@Injectable()
export class AiUmlProposalService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider, private readonly config: ConfigService) {}

  async generate(prompt: string, currentDiagram?: unknown, image?: AiImageInput) {
    let raw: unknown;
    try {
      raw = await this.withTimeout(this.provider.generateUmlProposal(prompt, currentDiagram, image));
    } catch (error) {

      if (
        error instanceof GatewayTimeoutException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('El proveedor de IA no está disponible temporalmente');
    }
    const proposal = this.parse(raw);
    this.validateSemantics(proposal, currentDiagram);
    return proposal;
  }

  parse(raw: unknown) {
    let value: unknown = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        throw new BadGatewayException('El proveedor devolvió una propuesta inválida');
      }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadGatewayException('El proveedor devolvió una propuesta inválida');
    }
    const proposal = plainToInstance(AiUmlProposalDto, value);
    const errors = validateSync(proposal, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      throw new BadGatewayException('El proveedor devolvió una propuesta inválida');
    }
    return proposal;
  }

  validateSemantics(proposal: AiUmlProposalDto, currentDiagram?: any) {
    // Si contiene clases directamente (formato aditivo tradicional)
    if (proposal.classes && proposal.classes.length > 0) {
      const classNames = new Set<string>();
      for (const umlClass of proposal.classes) {
        const className = umlClass.name.trim().toLocaleLowerCase();
        if (classNames.has(className)) {
          throw new BadGatewayException('La propuesta contiene clases duplicadas');
        }
        classNames.add(className);
        const attributes = new Set<string>();
        for (const attribute of umlClass.attributes) {
          const name = attribute.name.trim().toLocaleLowerCase();
          if (attributes.has(name)) {
            throw new BadGatewayException(`La clase ${umlClass.name} contiene atributos duplicados`);
          }
          attributes.add(name);
        }
        const methods = new Set<string>();
        for (const method of umlClass.methods) {
          const name = method.name.trim().toLocaleLowerCase();
          if (methods.has(name)) {
            throw new BadGatewayException(`La clase ${umlClass.name} contiene métodos duplicados`);
          }
          methods.add(name);
        }
      }
      const relations = new Set<string>();
      if (proposal.relations) {
        for (const relation of proposal.relations) {
          const source = relation.sourceClassName.trim().toLocaleLowerCase();
          const target = relation.targetClassName.trim().toLocaleLowerCase();
          if (!classNames.has(source) || !classNames.has(target)) {
            throw new BadGatewayException('La propuesta contiene una relación con clases inexistentes');
          }
          const key = `${source}:${target}:${relation.type}`;
          if (relations.has(key)) {
            throw new BadGatewayException('La propuesta contiene relaciones duplicadas');
          }
          relations.add(key);
        }
      }
    }

    // Si contiene acciones estructuradas
    if (proposal.actions && proposal.actions.length > 0) {
      const existingClassNames = new Set<string>(
        (currentDiagram?.classes || []).map((c: any) => c.name.trim().toLocaleLowerCase())
      );
      const newClassNames = new Set<string>();

      for (const action of proposal.actions) {
        if (action.action === AiActionType.ADD_CLASS) {
          const name = (action.className || '').trim().toLocaleLowerCase();
          if (name && (existingClassNames.has(name) || newClassNames.has(name))) {
            throw new BadGatewayException(`La clase '${action.className}' ya existe`);
          }
          if (name) newClassNames.add(name);
        }
      }
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    const timeoutMs = this.config.get<number>('AI_TIMEOUT_MS', 10_000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new GatewayTimeoutException('El proveedor de IA excedió el tiempo permitido')), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
