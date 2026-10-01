import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UmlRelationType, UmlVisibility } from '@prisma/client';
import { validateDto } from '../common/validate-dto';
import { PrismaService } from '../prisma/prisma.service';
import { SystemRole } from '../roles/system-role';
import { AI_PROVIDER, type AiProvider } from './ai-provider';
import { AiUmlProposalService } from './ai-uml-proposal.service';
import { CreateProjectFromAiDto } from './dto/create-project-from-ai.dto';
import { GenerateNewUmlDto } from './dto/generate-new-uml.dto';
import { AiUmlProposalDto } from './dto/ai-uml-proposal.dto';

const GRID_COLUMNS = 3;
const GRID_X = 320;
const GRID_Y = 260;
const GRID_MARGIN = 80;

const COMPLETE_DIAGRAM_INCLUDE = {
  classes: {
    include: {
      attributes: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
      methods: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  relations: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
};

@Injectable()
export class AiUmlGeneratorService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly prisma: PrismaService,
    private readonly proposals: AiUmlProposalService,
    private readonly config: ConfigService,
  ) {}

  async generateNewDiagram(userId: string, input: GenerateNewUmlDto) {
    await this.verifyActiveUser(userId);
    const dto = validateDto(GenerateNewUmlDto, input);
    const cleanPrompt = dto.prompt?.trim() || '';

    if (!cleanPrompt && !dto.image) {
      throw new BadRequestException('Debe proporcionar una descripción o una imagen para generar el diagrama UML.');
    }

    let raw: unknown;
    try {
      raw = await this.withTimeout(this.provider.generateNewUml(cleanPrompt, dto.image));
    } catch (error) {
      if (
        error instanceof GatewayTimeoutException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('El proveedor de IA no está disponible temporalmente.');
    }

    const proposal = this.proposals.parse(raw);
    this.validateNewModelSemantics(proposal);
    return { proposal };
  }

  async createProjectAndDiagram(userId: string, input: CreateProjectFromAiDto) {
    const dto = validateDto(CreateProjectFromAiDto, input);
    this.validateNewModelSemantics(dto.proposal);

    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, role: { select: { name: true } } },
    });

    if (!owner) throw new NotFoundException('Usuario propietario inexistente');
    if (!owner.isActive || owner.role.name !== SystemRole.ANFITRION) {
      throw new ForbiddenException('Solo un anfitrión activo puede crear un nuevo proyecto.');
    }

    const rawName = dto.projectName?.trim();
    const fallbackName = dto.proposal.summary
      ? dto.proposal.summary.replace(/^sistema\s+de\s+/i, '').slice(0, 40).trim()
      : 'Nuevo Proyecto IA';
    const projectName = rawName || (fallbackName ? fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1) : 'Proyecto IA');
    const projectDescription = dto.projectDescription?.trim() || dto.proposal.summary?.trim() || 'Proyecto generado con IA ARQNOVA';

    const classes = dto.proposal.classes || [];
    const relations = dto.proposal.relations || [];

    const result = await this.prisma.$transaction(
      async tx => {
        // 1. Crear Proyecto
        const project = await tx.project.create({
          data: {
            name: projectName,
            description: projectDescription,
            ownerId: userId,
          },
        });

        // 2. Crear Diagrama principal del proyecto
        const diagram = await tx.diagram.create({
          data: {
            projectId: project.id,
            name: `Diagrama de ${projectName}`,
          },
        });

        // 3. Crear Clases, Atributos y Métodos
        const classIds = new Map<string, string>();
        let attributeCount = 0;
        let methodCount = 0;

        for (const [index, proposed] of classes.entries()) {
          const col = index % GRID_COLUMNS;
          const row = Math.floor(index / GRID_COLUMNS);
          const posX = GRID_MARGIN + col * GRID_X;
          const posY = GRID_MARGIN + row * GRID_Y;

          const createdClass = await tx.umlClass.create({
            data: {
              diagramId: diagram.id,
              name: proposed.name.trim(),
              isAbstract: proposed.isAbstract ?? false,
              x: posX,
              y: posY,
              attributes: {
                create: proposed.attributes.map((attr, pos) => ({
                  name: attr.name.trim(),
                  type: attr.type.trim(),
                  visibility: attr.visibility || UmlVisibility.PRIVATE,
                  isPrimaryKey: attr.isPrimaryKey ?? false,
                  position: pos,
                })),
              },
              methods: {
                create: proposed.methods.map((meth, pos) => ({
                  name: meth.name.trim(),
                  returnType: meth.returnType.trim(),
                  visibility: meth.visibility || UmlVisibility.PUBLIC,
                  position: pos,
                })),
              },
            },
            select: { id: true },
          });

          classIds.set(this.key(proposed.name), createdClass.id);
          attributeCount += proposed.attributes.length;
          methodCount += proposed.methods.length;
        }

        // 4. Crear Relaciones
        let relationCount = 0;
        for (const rel of relations) {
          const sourceId = classIds.get(this.key(rel.sourceClassName));
          const targetId = classIds.get(this.key(rel.targetClassName));
          const associationClassId = rel.associationClassName ? classIds.get(this.key(rel.associationClassName)) : undefined;

          if (!sourceId || !targetId) {
            throw new BadRequestException(
              `La propuesta contiene una relación entre clases inexistentes ('${rel.sourceClassName}' -> '${rel.targetClassName}')`,
            );
          }
          if (rel.associationClassName && !associationClassId) throw new BadRequestException(`La clase de asociación '${rel.associationClassName}' no existe`);

          await tx.umlRelation.create({
            data: {
              diagramId: diagram.id,
              sourceClassId: sourceId,
              targetClassId: targetId,
              associationClassId,
              type: rel.type || UmlRelationType.ASSOCIATION,
              sourceMultiplicity: rel.sourceMultiplicity || '1',
              targetMultiplicity: rel.targetMultiplicity || '1',
              label: rel.label?.trim() || null,
            },
          });
          relationCount++;
        }

        // 5. Cargar diagrama completo persistido
        const fullDiagram = await tx.diagram.findUniqueOrThrow({
          where: { id: diagram.id },
          include: COMPLETE_DIAGRAM_INCLUDE,
        });

        return {
          project,
          diagram: fullDiagram,
          created: {
            classes: classes.length,
            attributes: attributeCount,
            methods: methodCount,
            relations: relationCount,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return result;
  }

  validateNewModelSemantics(proposal: AiUmlProposalDto) {
    if (!proposal.classes || proposal.classes.length === 0) {
      // Si vinieron acciones estructuradas ADD_CLASS en vez de classes directas, adaptamos o validamos
      if (proposal.actions && proposal.actions.length > 0) {
        proposal.classes = proposal.actions
          .filter(a => a.action === 'ADD_CLASS' && Boolean(a.className))
          .map(a => ({
            name: a.className!.trim(),
            isAbstract: a.isAbstract ?? false,
            attributes: a.attributes || (a.attribute ? [a.attribute] : []),
            methods: a.methods || (a.method ? [a.method] : []),
          }));
        proposal.relations = proposal.actions
          .filter(a => a.action === 'ADD_RELATION' && Boolean(a.sourceClassName) && Boolean(a.targetClassName))
          .map(a => ({
            sourceClassName: a.sourceClassName!.trim(),
            targetClassName: a.targetClassName!.trim(),
            associationClassName: a.associationClassName?.trim(),
            type: a.relationType || UmlRelationType.ASSOCIATION,
            sourceMultiplicity: a.sourceMultiplicity || '1',
            targetMultiplicity: a.targetMultiplicity || '1',
            label: a.label?.trim(),
          }));
      }

      if (!proposal.classes || proposal.classes.length === 0) {
        throw new BadGatewayException('El proveedor devolvió una propuesta sin clases definidas.');
      }
    }

    const classNames = new Set<string>();
    for (const umlClass of proposal.classes) {
      const className = this.key(umlClass.name);
      if (!className) {
        throw new BadGatewayException('La propuesta contiene una clase con nombre vacío');
      }
      if (classNames.has(className)) {
        throw new BadGatewayException(`La propuesta contiene clases duplicadas ('${umlClass.name}')`);
      }
      classNames.add(className);

      const attributes = new Set<string>();
      for (const attr of umlClass.attributes || []) {
        const attrName = this.key(attr.name);
        if (!attrName) {
          throw new BadGatewayException(`La clase '${umlClass.name}' contiene un atributo con nombre vacío`);
        }
        if (attributes.has(attrName)) {
          throw new BadGatewayException(`La clase '${umlClass.name}' contiene atributos duplicados ('${attr.name}')`);
        }
        attributes.add(attrName);
      }

      const methods = new Set<string>();
      for (const meth of umlClass.methods || []) {
        const methName = this.key(meth.name);
        if (!methName) {
          throw new BadGatewayException(`La clase '${umlClass.name}' contiene un método con nombre vacío`);
        }
        if (methods.has(methName)) {
          throw new BadGatewayException(`La clase '${umlClass.name}' contiene métodos duplicados ('${meth.name}')`);
        }
        methods.add(methName);
      }
    }

    if (proposal.relations) {
      const relationPairs = new Set<string>();
      for (const rel of proposal.relations) {
        const source = this.key(rel.sourceClassName);
        const target = this.key(rel.targetClassName);
        if (!classNames.has(source) || !classNames.has(target)) {
          throw new BadGatewayException(
            `La propuesta contiene una relación con clases no definidas ('${rel.sourceClassName}' -> '${rel.targetClassName}')`,
          );
        }
        if (rel.associationClassName && !classNames.has(this.key(rel.associationClassName))) {
          throw new BadGatewayException(`La clase de asociación '${rel.associationClassName}' no está definida`);
        }
        const pairKey = `${source}:${target}:${rel.type}`;
        if (relationPairs.has(pairKey)) {
          throw new BadGatewayException('La propuesta contiene relaciones duplicadas');
        }
        relationPairs.add(pairKey);
      }
    }
  }

  private key(value?: string) {
    return (value || '').trim().toLocaleLowerCase();
  }

  private async verifyActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user?.isActive) {
      throw new ForbiddenException('El usuario no está activo o no tiene acceso al servicio.');
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    const timeoutMs = this.config.get<number>('AI_TIMEOUT_MS', 25_000);
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
