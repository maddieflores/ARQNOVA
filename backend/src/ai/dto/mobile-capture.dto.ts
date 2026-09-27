import { Type } from 'class-transformer';
import { IsDefined, IsNotEmptyObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AiImageInputDto } from './generate-uml-proposal.dto';

export class MobileCaptureUmlDto {
  @IsDefined({ message: 'La imagen capturada es obligatoria' })
  @IsNotEmptyObject({}, { message: 'La imagen capturada no puede estar vacía' })
  @ValidateNested()
  @Type(() => AiImageInputDto)
  image!: AiImageInputDto;

  @IsOptional()
  @IsString({ message: 'La instrucción adicional debe ser un texto válido' })
  @MaxLength(2000, { message: 'La instrucción adicional no puede exceder 2000 caracteres' })
  prompt?: string;
}
