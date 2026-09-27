import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AiProposalsService } from './ai-proposals.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiCapturesController {
  constructor(private readonly proposalsService: AiProposalsService) {}

  @Get('my-captures')
  getMyCaptures(@Req() request: AuthenticatedRequest) {
    return this.proposalsService.listUserCaptures(request.user!.id);
  }
}
