import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateFrontendPromptDto } from './dto/generate-frontend-prompt.dto';
import { FrontendGeneratorService } from './frontend-generator.service';

@Controller('frontend-generator')
@UseGuards(JwtAuthGuard)
export class FrontendGeneratorController {
  constructor(private readonly frontendGeneratorService: FrontendGeneratorService) {}

  @Post('prompt')
  async generatePrompt(
    @Body() dto: GenerateFrontendPromptDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.frontendGeneratorService.generatePrompt(dto, request.user!.id);
  }
}
