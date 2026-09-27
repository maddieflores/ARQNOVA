import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { UmlModule } from '../uml/uml.module';
import { AiController } from './ai.controller';
import { AiCapturesController } from './ai-captures.controller';
import { AiGeneratorController } from './ai-generator.controller';
import { AI_PROVIDER } from './ai-provider';
import { AiService } from './ai.service';
import { AiUmlProposalService } from './ai-uml-proposal.service';
import { AiUmlGeneratorService } from './ai-uml-generator.service';
import { AiProposalsService } from './ai-proposals.service';
import { MockAiProvider } from './mock-ai.provider';
import { GeminiAiProvider } from './gemini-ai.provider';
import { UnavailableAiProvider } from './unavailable-ai.provider';
import { AiUmlApplyService } from './ai-uml-apply.service';

@Module({
  imports: [AuthModule, UmlModule],
  controllers: [AiController, AiCapturesController, AiGeneratorController],
  providers: [
    AiService,
    AiUmlProposalService,
    AiUmlApplyService,
    AiUmlGeneratorService,
    AiProposalsService,
    MockAiProvider,
    GeminiAiProvider,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, MockAiProvider, GeminiAiProvider],
      useFactory: (config: ConfigService, mock: MockAiProvider, gemini: GeminiAiProvider) => {
        const providerName = config.get<string>('AI_PROVIDER', 'mock')?.toLowerCase()?.trim();
        if (providerName === 'gemini') return gemini;
        if (providerName === 'mock') return mock;
        return new UnavailableAiProvider(providerName || 'unknown');
      },
    },
  ],
  exports: [AiService, AiUmlProposalService, AiUmlApplyService, AiUmlGeneratorService, AiProposalsService],
})
export class AiModule {}
