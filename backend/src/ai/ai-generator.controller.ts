import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AiUmlGeneratorService } from './ai-uml-generator.service';
import { GenerateNewUmlDto } from './dto/generate-new-uml.dto';
import { CreateProjectFromAiDto } from './dto/create-project-from-ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiGeneratorController {
  constructor(private readonly generator: AiUmlGeneratorService) {}

  @Post('generate-diagram')
  generateNewDiagram(@Req() request: AuthenticatedRequest, @Body() dto: GenerateNewUmlDto) {
    return this.generator.generateNewDiagram(request.user!.id, dto);
  }

  @Post('create-project-from-diagram')
  createProject(@Req() request: AuthenticatedRequest, @Body() dto: CreateProjectFromAiDto) {
    return this.generator.createProjectAndDiagram(request.user!.id, dto);
  }
}
