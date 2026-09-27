import { requestJson } from '../../services/http'

export interface GeneratePromptPayload {
  projectId: string
  platform?: 'WEB' | 'MOBILE' | string
  framework?: string
  style?: string
  architecture?: string
  stateManagement?: string
  includeFlutterPrep?: boolean
  frontendFramework?: string
  stylingFramework?: string
}

export interface GeneratePromptResponse {
  success: boolean
  prompt: string
}

export const frontendGeneratorService = {
  generatePrompt: (payload: GeneratePromptPayload, signal?: AbortSignal) =>
    requestJson<GeneratePromptResponse>('/frontend-generator/prompt', {
      method: 'POST',
      body: payload,
      signal,
    }),
}
