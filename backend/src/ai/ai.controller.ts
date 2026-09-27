import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AiService } from './ai.service';
import { GenerateUmlProposalDto } from './dto/generate-uml-proposal.dto';
import { ApplyUmlProposalDto } from './dto/apply-uml-proposal.dto';
import { MobileCaptureUmlDto } from './dto/mobile-capture.dto';
import { AiUmlApplyService } from './ai-uml-apply.service';
import { AiProposalsService } from './ai-proposals.service';

@Controller('projects/:projectId/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly applyService: AiUmlApplyService,
    private readonly proposalsService: AiProposalsService,
  ) {}

  @Post('uml-proposal')
  generate(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest, @Body() dto: GenerateUmlProposalDto) {
    return this.ai.generateUmlProposal(projectId, request.user!.id, dto);
  }

  @Post('apply-uml-proposal')
  apply(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest, @Body() dto: ApplyUmlProposalDto) {
    return this.applyService.apply(projectId, request.user!.id, dto);
  }

  @Post('mobile-capture')
  mobileCapture(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: MobileCaptureUmlDto,
  ) {
    return this.proposalsService.createFromMobileCapture(projectId, request.user!.id, dto);
  }

  @Get('proposals')
  listProposals(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: ProposalStatus,
  ) {
    return this.proposalsService.listByProject(projectId, request.user!.id, status);
  }

  @Get('proposals/:proposalId')
  getProposal(
    @Param('projectId') projectId: string,
    @Param('proposalId') proposalId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.proposalsService.getById(projectId, proposalId, request.user!.id);
  }

  @Post('proposals/:proposalId/apply')
  applyProposal(
    @Param('projectId') projectId: string,
    @Param('proposalId') proposalId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.proposalsService.applyProposal(projectId, proposalId, request.user!.id);
  }

  @Post('proposals/:proposalId/reject')
  rejectProposal(
    @Param('projectId') projectId: string,
    @Param('proposalId') proposalId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.proposalsService.rejectProposal(projectId, proposalId, request.user!.id);
  }
}
