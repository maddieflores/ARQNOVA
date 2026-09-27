import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class AiImageInputDto {
  @IsString({ message: 'Los datos de la imagen deben ser una cadena en formato base64' })
  @IsNotEmpty({ message: 'Los datos de la imagen en base64 no pueden estar vacíos' })
  @MaxLength(10_000_000, { message: 'La imagen excede el tamaño máximo permitido' })
  data!: string;

  @IsString({ message: 'El tipo MIME de la imagen debe ser un texto' })
  @IsNotEmpty({ message: 'El tipo MIME de la imagen es obligatorio' })
  @Matches(/^image\/(png|jpeg|jpg|webp)$/i, { message: 'El formato de imagen debe ser PNG, JPG/JPEG o WEBP' })
  mimeType!: string;
}

export class GenerateUmlProposalDto {
  @IsOptional()
  @IsString({ message: 'La instrucción debe ser un texto válido' })
  @MaxLength(2000, { message: 'La instrucción no puede exceder 2000 caracteres' })
  prompt?: string;

  @IsOptional()
  currentDiagram?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiImageInputDto)
  image?: AiImageInputDto;
}

