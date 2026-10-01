import type { UmlRelationType, UmlVisibility } from '@prisma/client';

export interface XmiAttribute { name: string; type: string; visibility: UmlVisibility; isPrimaryKey: boolean }
export interface XmiMethod { name: string; returnType: string; visibility: UmlVisibility }
export interface XmiClass { externalId: string; name: string; x: number; y: number; isAbstract: boolean; attributes: XmiAttribute[]; methods: XmiMethod[] }
export interface XmiRelation { sourceExternalId: string; targetExternalId: string; associationClassExternalId?: string; type: UmlRelationType; sourceMultiplicity: string; targetMultiplicity: string; label?: string }
export interface XmiModel { name: string; classes: XmiClass[]; relations: XmiRelation[] }
