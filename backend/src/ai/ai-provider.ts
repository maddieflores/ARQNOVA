export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiImageInput {
  data: string;
  mimeType: string;
}

export interface AiProvider {
  generateUmlProposal(prompt: string, currentDiagram?: unknown, image?: AiImageInput): Promise<unknown>;
  generateNewUml(prompt?: string, image?: AiImageInput): Promise<unknown>;
}

