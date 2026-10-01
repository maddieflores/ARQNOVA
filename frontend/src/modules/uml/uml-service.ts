import { requestJson } from '../../services/http'
import type { Diagram, MoveUmlClassPayload, UmlAttribute, UmlClass, UmlMethod, UmlRelation, UmlRelationType, UmlVisibility } from './types'

export interface UmlClassInput { name: string; x: number; y: number; isAbstract?: boolean }
export interface UpdateUmlClassInput { name?: string; isAbstract?: boolean; width?: number; height?: number }
export interface UmlAttributeInput { name: string; type: string; visibility: UmlVisibility; isPrimaryKey?: boolean; position?: number }
export interface UmlMethodInput { name: string; returnType: string; visibility: UmlVisibility; position?: number }
export interface UmlRelationInput { sourceClassId: string; targetClassId: string; associationClassId?: string | null; type: UmlRelationType; sourceMultiplicity?: string; targetMultiplicity?: string; label?: string }
export type UpdateUmlRelationInput = Partial<Pick<UmlRelationInput, 'associationClassId' | 'type' | 'sourceMultiplicity' | 'targetMultiplicity' | 'label'>>

const root = (projectId: string) => `/projects/${projectId}/diagram`

export const umlService = {
  get(projectId: string, signal?: AbortSignal): Promise<Diagram> { return requestJson(root(projectId), { signal }) },
  createClass(projectId: string, input: UmlClassInput): Promise<UmlClass> { return requestJson(`${root(projectId)}/classes`, { method: 'POST', body: input }) },
  updateClass(projectId: string, classId: string, input: UpdateUmlClassInput): Promise<UmlClass> { return requestJson(`${root(projectId)}/classes/${classId}`, { method: 'PATCH', body: input }) },
  moveClass(projectId: string, classId: string, input: MoveUmlClassPayload): Promise<UmlClass> { return requestJson(`${root(projectId)}/classes/${classId}/position`, { method: 'PATCH', body: input }) },
  removeClass(projectId: string, classId: string): Promise<UmlClass> { return requestJson(`${root(projectId)}/classes/${classId}`, { method: 'DELETE' }) },
  createAttribute(projectId: string, classId: string, input: UmlAttributeInput): Promise<UmlAttribute> { return requestJson(`${root(projectId)}/classes/${classId}/attributes`, { method: 'POST', body: input }) },
  updateAttribute(projectId: string, classId: string, id: string, input: Partial<UmlAttributeInput>): Promise<UmlAttribute> { return requestJson(`${root(projectId)}/classes/${classId}/attributes/${id}`, { method: 'PATCH', body: input }) },
  removeAttribute(projectId: string, classId: string, id: string): Promise<UmlAttribute> { return requestJson(`${root(projectId)}/classes/${classId}/attributes/${id}`, { method: 'DELETE' }) },
  createMethod(projectId: string, classId: string, input: UmlMethodInput): Promise<UmlMethod> { return requestJson(`${root(projectId)}/classes/${classId}/methods`, { method: 'POST', body: input }) },
  updateMethod(projectId: string, classId: string, id: string, input: Partial<UmlMethodInput>): Promise<UmlMethod> { return requestJson(`${root(projectId)}/classes/${classId}/methods/${id}`, { method: 'PATCH', body: input }) },
  removeMethod(projectId: string, classId: string, id: string): Promise<UmlMethod> { return requestJson(`${root(projectId)}/classes/${classId}/methods/${id}`, { method: 'DELETE' }) },
  createRelation(projectId: string, input: UmlRelationInput): Promise<UmlRelation> { return requestJson(`${root(projectId)}/relations`, { method: 'POST', body: input }) },
  updateRelation(projectId: string, id: string, input: UpdateUmlRelationInput): Promise<UmlRelation> { return requestJson(`${root(projectId)}/relations/${id}`, { method: 'PATCH', body: input }) },
  removeRelation(projectId: string, id: string): Promise<UmlRelation> { return requestJson(`${root(projectId)}/relations/${id}`, { method: 'DELETE' }) },
}
