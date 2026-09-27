import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProposalOrigin, ProposalStatus } from '@prisma/client';
import { CollaborationService } from '../collaboration/collaboration.service';
import { validateDto } from '../common/validate-dto';
import { PrismaService } from '../prisma/prisma.service';
import { DiagramsService } from '../uml/diagrams.service';
import { AiUmlApplyService } from './ai-uml-apply.service';
import { AiUmlProposalService } from './ai-uml-proposal.service';
import { MobileCaptureUmlDto } from './dto/mobile-capture.dto';
import { AiActionType, AiUmlProposalDto } from './dto/ai-uml-proposal.dto';

@Injectable()
export class AiProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagrams: DiagramsService,
    private readonly proposalGenerator: AiUmlProposalService,
    private readonly applyService: AiUmlApplyService,
    private readonly collaboration: CollaborationService,
  ) {}

  async createFromMobileCapture(projectId: string, userId: string, input: MobileCaptureUmlDto) {
    const dto = validateDto(MobileCaptureUmlDto, input);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.diagrams.validateProjectAccess(projectId, userId);
    const currentDiagram = await this.diagrams.getByProject(projectId, userId).catch(() => null);

    const cleanPrompt = dto.prompt?.trim() || '';
    const proposal = await this.proposalGenerator.generate(cleanPrompt, currentDiagram, dto.image);

    const stats = this.calculateStats(proposal);

    const saved = await this.prisma.umlProposal.create({
      data: {
        projectId,
        userId,
        origin: ProposalOrigin.MOBILE_IMAGE,
        status: ProposalStatus.PENDING,
        prompt: cleanPrompt || null,
        summary: proposal.summary?.trim() || 'Propuesta UML generada desde imagen móvil',
        classesCount: stats.classes,
        attributesCount: stats.attributes,
        methodsCount: stats.methods,
        relationsCount: stats.relations,
        proposalJson: JSON.parse(JSON.stringify(proposal)),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.collaboration.emitProposalReceived(projectId, saved, { id: user.id, name: user.name });

    return {
      id: saved.id,
      projectId: saved.projectId,
      projectName: saved.project.name,
      status: saved.status,
      origin: saved.origin,
      summary: saved.summary,
      counts: stats,
      proposal: proposal,
      createdAt: saved.createdAt,
      message: 'Propuesta enviada al proyecto. Continúa en ARQNOVA Web para revisar y aplicar los cambios.',
    };
  }

  async listByProject(projectId: string, userId: string, status?: ProposalStatus) {
    await this.diagrams.validateProjectAccess(projectId, userId);
    return this.prisma.umlProposal.findMany({
      where: {
        projectId,
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(projectId: string, proposalId: string, userId: string) {
    await this.diagrams.validateProjectAccess(projectId, userId);
    const proposal = await this.prisma.umlProposal.findFirst({
      where: { id: proposalId, projectId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (!proposal) {
      throw new NotFoundException('Propuesta UML no encontrada');
    }
    return proposal;
  }

  async applyProposal(projectId: string, proposalId: string, userId: string) {
    await this.diagrams.validateProjectAccess(projectId, userId);
    const proposal = await this.prisma.umlProposal.findFirst({
      where: { id: proposalId, projectId },
    });

    if (!proposal) {
      throw new NotFoundException('Propuesta UML no encontrada');
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException(`No se puede aplicar una propuesta con estado ${proposal.status}`);
    }

    const applyResult = await this.applyService.apply(projectId, userId, {
      proposal: proposal.proposalJson as unknown as AiUmlProposalDto,
    });

    const updated = await this.prisma.umlProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.APPLIED },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return {
      proposal: updated,
      created: applyResult.created,
      diagram: applyResult.diagram,
    };
  }

  async rejectProposal(projectId: string, proposalId: string, userId: string) {
    await this.diagrams.validateProjectAccess(projectId, userId);
    const proposal = await this.prisma.umlProposal.findFirst({
      where: { id: proposalId, projectId },
    });

    if (!proposal) {
      throw new NotFoundException('Propuesta UML no encontrada');
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      throw new BadRequestException(`No se puede rechazar una propuesta con estado ${proposal.status}`);
    }

    const updated = await this.prisma.umlProposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.REJECTED },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  async listUserCaptures(userId: string) {
    return this.prisma.umlProposal.findMany({
      where: { userId },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private calculateStats(proposal: AiUmlProposalDto) {
    let classes = 0;
    let attributes = 0;
    let methods = 0;
    let relations = 0;

    if (proposal.classes && proposal.classes.length > 0) {
      classes = proposal.classes.length;
      attributes = proposal.classes.reduce((sum, c) => sum + (c.attributes?.length || 0), 0);
      methods = proposal.classes.reduce((sum, c) => sum + (c.methods?.length || 0), 0);
      relations = proposal.relations?.length || 0;
    } else if (proposal.actions && proposal.actions.length > 0) {
      for (const action of proposal.actions) {
        if (action.action === AiActionType.ADD_CLASS) {
          classes++;
          const attrs = action.attributes || (action.attribute ? [action.attribute] : []);
          const meths = action.methods || (action.method ? [action.method] : []);
          attributes += attrs.length;
          methods += meths.length;
        } else if (action.action === AiActionType.ADD_ATTRIBUTE || action.action === AiActionType.UPDATE_ATTRIBUTE) {
          attributes++;
        } else if (action.action === AiActionType.ADD_METHOD || action.action === AiActionType.UPDATE_METHOD) {
          methods++;
        } else if (action.action === AiActionType.ADD_RELATION || action.action === AiActionType.UPDATE_RELATION) {
          relations++;
        }
      }
    }

    return { classes, attributes, methods, relations };
  }
}
