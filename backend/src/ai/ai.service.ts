import { BadRequestException, Injectable } from '@nestjs/common';
import { validateDto } from '../common/validate-dto';
import { DiagramsService } from '../uml/diagrams.service';
import { GenerateUmlProposalDto } from './dto/generate-uml-proposal.dto';
import { AiUmlProposalService } from './ai-uml-proposal.service';

@Injectable()
export class AiService {
  constructor(private readonly diagrams: DiagramsService, private readonly proposals: AiUmlProposalService) {}

  async generateUmlProposal(projectId: string, userId: string, input: GenerateUmlProposalDto) {
    const dto = validateDto(GenerateUmlProposalDto, input);
    const cleanPrompt = dto.prompt?.trim() || '';
    if (!cleanPrompt && !dto.image) {
      throw new BadRequestException('Debe proporcionar una instrucción de texto o una imagen para analizar.');
    }
    await this.diagrams.validateProjectAccess(projectId, userId);
    const currentDiagram = dto.currentDiagram ?? (await this.diagrams.getByProject(projectId, userId).catch(() => null));
    return { proposal: await this.proposals.generate(cleanPrompt, currentDiagram, dto.image) };
  }
}

