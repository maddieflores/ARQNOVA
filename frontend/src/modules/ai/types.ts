export type AiVisibility = 'PUBLIC' | 'PRIVATE' | 'PROTECTED' | 'PACKAGE'
export type AiRelationType = 'ASSOCIATION' | 'AGGREGATION' | 'COMPOSITION' | 'INHERITANCE' | 'DEPENDENCY'

export type AiActionType =
  | 'ADD_CLASS'
  | 'UPDATE_CLASS'
  | 'DELETE_CLASS'
  | 'ADD_ATTRIBUTE'
  | 'UPDATE_ATTRIBUTE'
  | 'DELETE_ATTRIBUTE'
  | 'ADD_METHOD'
  | 'UPDATE_METHOD'
  | 'DELETE_METHOD'
  | 'ADD_RELATION'
  | 'UPDATE_RELATION'
  | 'DELETE_RELATION'

export interface AiUmlAttribute {
  name: string
  type: string
  visibility: AiVisibility
  isPrimaryKey?: boolean
}

export interface AiUmlMethod {
  name: string
  returnType: string
  visibility: AiVisibility
}

export interface AiUmlClass {
  name: string
  isAbstract?: boolean
  attributes: AiUmlAttribute[]
  methods: AiUmlMethod[]
}

export interface AiUmlRelation {
  sourceClassName: string
  targetClassName: string
  associationClassName?: string
  type: AiRelationType
  sourceMultiplicity?: string
  targetMultiplicity?: string
  label?: string
}

export interface AiUmlAction {
  action: AiActionType
  classId?: string
  className?: string
  isAbstract?: boolean
  attributeId?: string
  attributeName?: string
  attributeType?: string
  attributeVisibility?: AiVisibility
  isPrimaryKey?: boolean
  methodId?: string
  methodName?: string
  methodReturnType?: string
  methodVisibility?: AiVisibility
  relationId?: string
  sourceClassId?: string
  sourceClassName?: string
  targetClassId?: string
  targetClassName?: string
  associationClassId?: string
  associationClassName?: string
  relationType?: AiRelationType
  sourceMultiplicity?: string
  targetMultiplicity?: string
  label?: string
  attribute?: AiUmlAttribute
  method?: AiUmlMethod
  attributes?: AiUmlAttribute[]
  methods?: AiUmlMethod[]
}

export interface AiUmlProposal {
  summary?: string
  actions?: AiUmlAction[]
  classes?: AiUmlClass[]
  relations?: AiUmlRelation[]
}

export interface AiImageInput {
  data: string
  mimeType: string
  fileName?: string
}

export interface AiApplyResult {
  created: { classes: number; attributes: number; methods: number; relations: number }
  diagram: import('../uml/types').Diagram
}

export interface CreateProjectFromAiResult {
  project: import('../projects/projects-service').Project
  diagram: import('../uml/types').Diagram
  created: { classes: number; attributes: number; methods: number; relations: number }
}

export type ProposalStatus = 'PENDING' | 'APPLIED' | 'REJECTED' | 'ERROR'
export type ProposalOrigin = 'MOBILE_IMAGE' | 'WEB_AI'

export interface SavedProposal {
  id: string
  projectId: string
  userId: string
  origin: ProposalOrigin
  status: ProposalStatus
  prompt?: string | null
  summary?: string | null
  classesCount: number
  attributesCount: number
  methodsCount: number
  relationsCount: number
  proposalJson: AiUmlProposal
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string; email: string }
  project?: { id: string; name: string }
}


