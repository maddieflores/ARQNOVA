import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateFrontendPromptDto {
  @IsUUID('4', { message: 'El ID del proyecto debe ser un UUID válido.' })
  projectId!: string;

  @IsOptional()
  @IsString()
  platform?: string; // 'WEB' | 'MOBILE'

  @IsOptional()
  @IsString()
  framework?: string; // 'REACT' | 'ANGULAR' | 'VUE' | 'FLUTTER' | 'REACT_NATIVE' | 'React + Vite' | etc.

  @IsOptional()
  @IsString()
  style?: string; // 'TAILWIND' | 'MATERIAL_UI' | 'Tailwind CSS' | etc.

  @IsOptional()
  @IsString()
  architecture?: string; // 'CLEAN' | 'MVVM' | 'Clean Architecture' | etc.

  @IsOptional()
  @IsString()
  stateManagement?: string; // 'PROVIDER' | 'RIVERPOD' | 'BLOC' | 'Provider' | etc.

  @IsOptional()
  @IsBoolean()
  includeFlutterPrep?: boolean;

  // Backwards compatibility aliases
  @IsOptional()
  @IsString()
  frontendFramework?: string;

  @IsOptional()
  @IsString()
  stylingFramework?: string;
}
