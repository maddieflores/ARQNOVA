export type UmlVisibility = 'PUBLIC' | 'PRIVATE' | 'PROTECTED' | 'PACKAGE'

export type UmlRelationType =
  | 'ASSOCIATION'
  | 'AGGREGATION'
  | 'COMPOSITION'
  | 'INHERITANCE'
  | 'DEPENDENCY'

export interface UmlAttribute {
  id: string
  umlClassId: string
  name: string
  type: string
  visibility: UmlVisibility
  isPrimaryKey: boolean
  position: number
}

export interface UmlMethod {
  id: string
  umlClassId: string
  name: string
  returnType: string
  visibility: UmlVisibility
  position: number
}

export interface UmlClass {
  id: string
  diagramId: string
  name: string
  x: number
  y: number
  width: number | null
  height: number | null
  isAbstract: boolean
  attributes: UmlAttribute[]
  methods: UmlMethod[]
  createdAt: string
  updatedAt: string
}

export interface UmlRelation {
  id: string
  diagramId: string
  sourceClassId: string
  targetClassId: string
  associationClassId: string | null
  type: UmlRelationType
  sourceMultiplicity: string
  targetMultiplicity: string
  label: string | null
  createdAt: string
  updatedAt: string
}

export interface Diagram {
  id: string
  projectId: string
  name: string
  classes: UmlClass[]
  relations: UmlRelation[]
  createdAt: string
  updatedAt: string
}

export interface MoveUmlClassPayload {
  x: number
  y: number
}
