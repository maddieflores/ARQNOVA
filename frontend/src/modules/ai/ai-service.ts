import { requestJson } from '../../services/http'
import type { AiApplyResult, AiImageInput, AiUmlProposal, CreateProjectFromAiResult } from './types'

export const aiService = {
  generateUmlProposal: (
    projectId: string,
    prompt?: string,
    currentDiagram?: unknown,
    image?: AiImageInput,
  ) =>
    requestJson<{ proposal: AiUmlProposal }>(`/projects/${projectId}/ai/uml-proposal`, {
      method: 'POST',
      body: {
        prompt: prompt || undefined,
        currentDiagram,
        image: image ? { data: image.data, mimeType: image.mimeType } : undefined,
      },
    }),
  applyUmlProposal: (projectId: string, proposal: AiUmlProposal) =>
    requestJson<AiApplyResult>(`/projects/${projectId}/ai/apply-uml-proposal`, {
      method: 'POST',
      body: { proposal },
    }),
  generateNewUml: (prompt?: string, image?: AiImageInput) =>
    requestJson<{ proposal: AiUmlProposal }>('/ai/generate-diagram', {
      method: 'POST',
      body: {
        prompt: prompt || undefined,
        image: image ? { data: image.data, mimeType: image.mimeType } : undefined,
      },
    }),
  createProjectFromProposal: (proposal: AiUmlProposal, projectName?: string, projectDescription?: string) =>
    requestJson<CreateProjectFromAiResult>('/ai/create-project-from-diagram', {
      method: 'POST',
      body: {
        projectName: projectName?.trim() || undefined,
        projectDescription: projectDescription?.trim() || undefined,
        proposal,
      },
    }),
  getProposals: (projectId: string, status?: string) =>
    requestJson<import('./types').SavedProposal[]>(
      `/projects/${projectId}/ai/proposals${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      { method: 'GET' }
    ),
  getProposal: (projectId: string, proposalId: string) =>
    requestJson<import('./types').SavedProposal>(`/projects/${projectId}/ai/proposals/${proposalId}`, {
      method: 'GET',
    }),
  applySavedProposal: (projectId: string, proposalId: string) =>
    requestJson<{ proposal: import('./types').SavedProposal; created: { classes: number; attributes: number; methods: number; relations: number }; diagram: import('../uml/types').Diagram }>(
      `/projects/${projectId}/ai/proposals/${proposalId}/apply`,
      { method: 'POST' }
    ),
  rejectProposal: (projectId: string, proposalId: string) =>
    requestJson<import('./types').SavedProposal>(`/projects/${projectId}/ai/proposals/${proposalId}/reject`, {
      method: 'POST',
    }),
  getMyCaptures: () =>
    requestJson<import('./types').SavedProposal[]>('/ai/my-captures', {
      method: 'GET',
    }),
}



