import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Diagram, MoveUmlClassPayload, UmlClass, UmlRelation } from './types'

export type UmlClassNodeData = { umlClass: UmlClass; lockedBy?: string } & Record<string, unknown>
export type UmlRelationEdgeData = { relation: UmlRelation } & Record<string, unknown>
export interface DiagramFlowModel { nodes: Node<UmlClassNodeData>[]; edges: Edge<UmlRelationEdgeData>[] }

export function diagramToFlow(diagram: Diagram): DiagramFlowModel {
  const associationAnchors = diagram.relations.filter(relation => relation.associationClassId).map(relation => {
    const source = diagram.classes.find(item => item.id === relation.sourceClassId)
    const target = diagram.classes.find(item => item.id === relation.targetClassId)
    const associationClass = diagram.classes.find(item => item.id === relation.associationClassId)!
    return { id: `association-anchor-${relation.id}`, position: { x: ((source?.x ?? 0) + (target?.x ?? 0)) / 2 + 140, y: ((source?.y ?? 0) + (target?.y ?? 0)) / 2 + 60 }, data: { umlClass: associationClass }, selectable: false, draggable: false, style: { width: 1, height: 1, opacity: 0, padding: 0, border: 0, pointerEvents: 'none' as const } }
  })
  const associationClassEdges = diagram.relations.filter(relation => relation.associationClassId).map(relation => ({
    id: `association-class-${relation.id}`, source: relation.associationClassId!, target: `association-anchor-${relation.id}`,
    data: { relation }, label: '«associationClass»', style: { strokeWidth: 1.5, strokeDasharray: '6 4' },
  }))
  return {
    nodes: [...diagram.classes.map(umlClass => ({
      id: umlClass.id, type: 'umlClass', position: { x: umlClass.x, y: umlClass.y }, data: { umlClass },
      ...(umlClass.width == null ? {} : { width: umlClass.width }), ...(umlClass.height == null ? {} : { height: umlClass.height }),
    })), ...associationAnchors],
    edges: [...diagram.relations.map(relation => ({
      id: relation.id, source: relation.sourceClassId, target: relation.targetClassId,
      label: `${relation.sourceMultiplicity}  ${relation.label ?? relation.type}  ${relation.targetMultiplicity}`,
      data: { relation },
      markerEnd: relation.type === 'INHERITANCE' || relation.type === 'DEPENDENCY' ? { type: MarkerType.ArrowClosed } : undefined,
      animated: relation.type === 'DEPENDENCY',
      style: { strokeWidth: relation.type === 'COMPOSITION' ? 3 : relation.type === 'AGGREGATION' ? 2 : 1.5, strokeDasharray: relation.type === 'DEPENDENCY' ? '6 4' : undefined },
    })), ...associationClassEdges],
  }
}

export function flowNodeToMovePayload(node: Pick<Node, 'position'>): MoveUmlClassPayload { return { x: node.position.x, y: node.position.y } }
