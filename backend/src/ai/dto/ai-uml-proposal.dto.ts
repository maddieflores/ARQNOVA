import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { UmlRelationType, UmlVisibility } from '@prisma/client';

export const MULTIPLICITY = /^(?:\*|\d+|\d+\.\.(?:\d+|\*))$/;

export enum AiActionType {
  ADD_CLASS = 'ADD_CLASS',
  UPDATE_CLASS = 'UPDATE_CLASS',
  DELETE_CLASS = 'DELETE_CLASS',
  ADD_ATTRIBUTE = 'ADD_ATTRIBUTE',
  UPDATE_ATTRIBUTE = 'UPDATE_ATTRIBUTE',
  DELETE_ATTRIBUTE = 'DELETE_ATTRIBUTE',
  ADD_METHOD = 'ADD_METHOD',
  UPDATE_METHOD = 'UPDATE_METHOD',
  DELETE_METHOD = 'DELETE_METHOD',
  ADD_RELATION = 'ADD_RELATION',
  UPDATE_RELATION = 'UPDATE_RELATION',
  DELETE_RELATION = 'DELETE_RELATION',
}

export class AiUmlAttributeDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) type!: string;
  @IsEnum(UmlVisibility) visibility!: UmlVisibility;
  @IsOptional() @IsBoolean() isPrimaryKey?: boolean;
}

export class AiUmlMethodDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) returnType!: string;
  @IsEnum(UmlVisibility) visibility!: UmlVisibility;
}

export class AiUmlClassDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsBoolean() isAbstract?: boolean;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => AiUmlAttributeDto) attributes!: AiUmlAttributeDto[];
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => AiUmlMethodDto) methods!: AiUmlMethodDto[];
}

export class AiUmlRelationDto {
  @IsString() @IsNotEmpty() @MaxLength(80) sourceClassName!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) targetClassName!: string;
  @IsEnum(UmlRelationType) type!: UmlRelationType;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) sourceMultiplicity?: string;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) targetMultiplicity?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) label?: string;
}

export class AiUmlActionDto {
  @IsEnum(AiActionType) action!: AiActionType;
  @IsOptional() @IsString() @MaxLength(120) classId?: string;
  @IsOptional() @IsString() @MaxLength(80) className?: string;
  @IsOptional() @IsBoolean() isAbstract?: boolean;

  @IsOptional() @IsString() @MaxLength(120) attributeId?: string;
  @IsOptional() @IsString() @MaxLength(80) attributeName?: string;
  @IsOptional() @IsString() @MaxLength(80) attributeType?: string;
  @IsOptional() @IsEnum(UmlVisibility) attributeVisibility?: UmlVisibility;
  @IsOptional() @IsBoolean() isPrimaryKey?: boolean;

  @IsOptional() @IsString() @MaxLength(120) methodId?: string;
  @IsOptional() @IsString() @MaxLength(80) methodName?: string;
  @IsOptional() @IsString() @MaxLength(80) methodReturnType?: string;
  @IsOptional() @IsEnum(UmlVisibility) methodVisibility?: UmlVisibility;

  @IsOptional() @IsString() @MaxLength(120) relationId?: string;
  @IsOptional() @IsString() @MaxLength(120) sourceClassId?: string;
  @IsOptional() @IsString() @MaxLength(80) sourceClassName?: string;
  @IsOptional() @IsString() @MaxLength(120) targetClassId?: string;
  @IsOptional() @IsString() @MaxLength(80) targetClassName?: string;
  @IsOptional() @IsEnum(UmlRelationType) relationType?: UmlRelationType;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) sourceMultiplicity?: string;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) targetMultiplicity?: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;

  @IsOptional() @ValidateNested() @Type(() => AiUmlAttributeDto) attribute?: AiUmlAttributeDto;
  @IsOptional() @ValidateNested() @Type(() => AiUmlMethodDto) method?: AiUmlMethodDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AiUmlAttributeDto) attributes?: AiUmlAttributeDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AiUmlMethodDto) methods?: AiUmlMethodDto[];
}

export class AiUmlProposalDto {
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AiUmlActionDto) actions?: AiUmlActionDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => AiUmlClassDto) classes?: AiUmlClassDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AiUmlRelationDto) relations?: AiUmlRelationDto[];
}
