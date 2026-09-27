import { ServiceUnavailableException } from '@nestjs/common';
import type { AiProvider } from './ai-provider';

export class UnavailableAiProvider implements AiProvider {
  constructor(private readonly providerName: string) {}
  async generateUmlProposal(): Promise<never> { throw new ServiceUnavailableException(`Proveedor de IA no disponible: ${this.providerName}`); }
  async generateNewUml(): Promise<never> { throw new ServiceUnavailableException(`Proveedor de IA no disponible: ${this.providerName}`); }
}
