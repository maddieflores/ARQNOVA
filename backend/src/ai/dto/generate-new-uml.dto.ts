import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AiImageInputDto } from './generate-uml-proposal.dto';

export class GenerateNewUmlDto {
  @IsOptional()
  @IsString({ message: 'La descripción del sistema debe ser un texto válido' })
  @MaxLength(2000, { message: 'La descripción no puede exceder 2000 caracteres' })
  prompt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiImageInputDto)
  image?: AiImageInputDto;
}
