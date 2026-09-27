import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AiUmlProposalDto } from './ai-uml-proposal.dto';

export class CreateProjectFromAiDto {
  @IsOptional()
  @IsString({ message: 'El nombre del proyecto debe ser una cadena de texto' })
  @MaxLength(120, { message: 'El nombre del proyecto no puede exceder 120 caracteres' })
  projectName?: string;

  @IsOptional()
  @IsString({ message: 'La descripción del proyecto debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La descripción del proyecto no puede exceder 500 caracteres' })
  projectDescription?: string;

  @IsNotEmpty({ message: 'La propuesta del modelo UML es obligatoria' })
  @ValidateNested()
  @Type(() => AiUmlProposalDto)
  proposal!: AiUmlProposalDto;
}
