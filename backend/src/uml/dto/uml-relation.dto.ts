import { UmlRelationType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const MULTIPLICITY = /^(?:\*|\d+|\d+\.\.(?:\d+|\*))$/;

export class CreateUmlRelationDto {
  @IsUUID() sourceClassId!: string;
  @IsUUID() targetClassId!: string;
  @IsOptional() @IsUUID() associationClassId?: string | null;
  @IsEnum(UmlRelationType) type!: UmlRelationType;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) sourceMultiplicity?: string;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) targetMultiplicity?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) label?: string;
}

export class UpdateUmlRelationDto {
  @IsOptional() @IsEnum(UmlRelationType) type?: UmlRelationType;
  @IsOptional() @IsUUID() associationClassId?: string | null;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) sourceMultiplicity?: string;
  @IsOptional() @IsString() @Matches(MULTIPLICITY) targetMultiplicity?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) label?: string;
}
