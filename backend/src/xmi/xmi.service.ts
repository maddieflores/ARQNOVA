import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, UmlRelationType, UmlVisibility } from '@prisma/client';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { CollaborationService } from '../collaboration/collaboration.service';
import { PrismaService } from '../prisma/prisma.service';
import { DiagramsService } from '../uml/diagrams.service';
import type { XmiClass, XmiModel, XmiRelation } from './xmi.types';

const MAX_XMI_BYTES = 2 * 1024 * 1024;
const MULTIPLICITY = /^(?:\*|\d+|\d+\.\.(?:\d+|\*))$/;
const VISIBILITY: Record<string, UmlVisibility> = { public: UmlVisibility.PUBLIC, private: UmlVisibility.PRIVATE, protected: UmlVisibility.PROTECTED, package: UmlVisibility.PACKAGE };

@Injectable()
export class XmiService {
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false, trimValues: true });
  private readonly builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true, suppressEmptyNode: true, suppressBooleanAttributes: false });

  constructor(private readonly prisma: PrismaService, private readonly diagrams: DiagramsService, private readonly collaboration: CollaborationService) { }

  async export(projectId: string, userId: string) {
    const diagram = await this.diagrams.getOrCreateByProject(projectId, userId);
    const modelXmiId = `EAID_Model_${this.safeId(diagram.id)}`;
    const diagramXmiId = `EAID_Diagram_${this.safeId(diagram.id)}`;
    const classId = new Map(diagram.classes.map(item => [item.id, `EAID_${this.safeId(item.id)}`]));
    const relationIdMap = new Map(diagram.relations.map(item => [item.id, `EAID_Rel_${this.safeId(item.id)}`]));

    const typeNames = [...new Set(diagram.classes.flatMap(item => [...item.attributes.map(attribute => attribute.type), ...item.methods.map(method => method.returnType)]))];
    const typeIds = new Map(typeNames.map((name, index) => [name, `primitive_${index}_${this.safeFilename(name)}`]));

    const packagedElement: Record<string, unknown>[] = typeNames.map(name => ({ '@_xmi:type': 'uml:PrimitiveType', '@_xmi:id': typeIds.get(name), '@_name': name }));
    packagedElement.push(...diagram.classes.map(umlClass => {
      const cId = classId.get(umlClass.id)!;
      return {
        '@_xmi:type': 'uml:Class',
        '@_xmi:id': cId,
        '@_name': umlClass.name,
        '@_isAbstract': String(umlClass.isAbstract),
        '@_arqnova:x': String(umlClass.x),
        '@_arqnova:y': String(umlClass.y),
        ownedAttribute: umlClass.attributes.map((attribute, attrIdx) => ({
          '@_xmi:type': 'uml:Property',
          '@_xmi:id': `EAID_Attr_${this.safeId(attribute.id)}`,
          '@_name': attribute.name,
          '@_type': typeIds.get(attribute.type),
          '@_visibility': attribute.visibility.toLowerCase(),
          '@_arqnova:typeName': attribute.type,
          '@_arqnova:isPrimaryKey': String(attribute.isPrimaryKey),
          properties: {
            '@_type': attribute.type,
            '@_isOrdered': 'false',
            '@_isDerived': 'false',
            '@_position': String(attrIdx),
          },
        })),
        ownedOperation: umlClass.methods.map((method, methIdx) => ({
          '@_xmi:type': 'uml:Operation',
          '@_xmi:id': `EAID_Meth_${this.safeId(method.id)}`,
          '@_name': method.name,
          '@_visibility': method.visibility.toLowerCase(),
          '@_arqnova:returnType': method.returnType,
          properties: {
            '@_type': method.returnType,
            '@_returnType': method.returnType,
            '@_position': String(methIdx),
          },
          ownedParameter: {
            '@_xmi:type': 'uml:Parameter',
            '@_xmi:id': `EAID_Ret_${this.safeId(method.id)}`,
            '@_direction': 'return',
            '@_type': typeIds.get(method.returnType),
            properties: {
              '@_type': method.returnType,
            },
          },
        })),
      };
    }));

    for (const relation of diagram.relations) {
      packagedElement.push(this.exportRelation(relation, classId, relationIdMap));
    }

    // Geometry calculations for Enterprise Architect diagram extension
    const minX = diagram.classes.length ? Math.min(...diagram.classes.map(c => c.x)) : 0;
    const minY = diagram.classes.length ? Math.min(...diagram.classes.map(c => c.y)) : 0;
    const shiftX = minX < 50 ? 80 - minX : 0;
    const shiftY = minY < 50 ? 80 - minY : 0;

    const eaElements: Record<string, unknown>[] = diagram.classes.map((umlClass, index) => {
      const cId = classId.get(umlClass.id)!;
      return {
        '@_xmi:idref': cId,
        '@_xmi:type': 'uml:Class',
        '@_name': umlClass.name,
        '@_scope': 'public',
        model: { '@_package': modelXmiId, '@_tpos': '0', '@_ea_localid': String(index + 1), '@_ea_eleType': 'element' },
        properties: { '@_isSpecification': 'false', '@_sType': 'Class', '@_nType': '0', '@_scope': 'public', '@_isAbstract': String(umlClass.isAbstract) },
        project: { '@_author': 'ARQNOVA', '@_version': '1.0', '@_status': 'Proposed' },
        attributes: umlClass.attributes.length > 0 ? {
          attribute: umlClass.attributes.map((attr, aIdx) => ({
            '@_xmi:idref': `EAID_Attr_${this.safeId(attr.id)}`,
            '@_name': attr.name,
            '@_scope': attr.visibility === UmlVisibility.PUBLIC ? 'Public' : attr.visibility === UmlVisibility.PROTECTED ? 'Protected' : 'Private',
            properties: {
              '@_type': attr.type,
              '@_position': String(aIdx),
              '@_isID': String(attr.isPrimaryKey),
            },
          })),
        } : undefined,
        operations: umlClass.methods.length > 0 ? {
          operation: umlClass.methods.map((method, mIdx) => ({
            '@_xmi:idref': `EAID_Meth_${this.safeId(method.id)}`,
            '@_name': method.name,
            '@_scope': method.visibility === UmlVisibility.PUBLIC ? 'Public' : method.visibility === UmlVisibility.PROTECTED ? 'Protected' : 'Private',
            properties: {
              '@_type': method.returnType,
              '@_returnType': method.returnType,
              '@_position': String(mIdx),
            },
          })),
        } : undefined,
        style: { '@_appearance': 'BackColor=-1;BorderColor=-1;BorderWidth=-1;FontColor=-1;VSwimLanes=1;HSwimLanes=1;BorderStyle=0;' },
      };
    });

    const eaConnectors: Record<string, unknown>[] = diagram.relations.map((relation, index) => {
      const rId = relationIdMap.get(relation.id)!;
      const sourceClass = diagram.classes.find(c => c.id === relation.sourceClassId);
      const targetClass = diagram.classes.find(c => c.id === relation.targetClassId);
      const sourceCId = classId.get(relation.sourceClassId)!;
      const targetCId = classId.get(relation.targetClassId)!;
      const eaType = relation.type === UmlRelationType.DEPENDENCY ? 'Dependency' : relation.type === UmlRelationType.INHERITANCE ? 'Generalization' : relation.type === UmlRelationType.AGGREGATION ? 'Aggregation' : relation.type === UmlRelationType.COMPOSITION ? 'Composition' : 'Association';
      const isAggregation = relation.type === UmlRelationType.AGGREGATION;
      const isComposition = relation.type === UmlRelationType.COMPOSITION;

      return {
        '@_xmi:idref': rId,
        source: {
          '@_xmi:idref': sourceCId,
          model: { '@_type': 'Class', '@_name': sourceClass?.name ?? '' },
          role: { '@_visibility': 'Public', '@_targetScope': 'instance' },
          type: {
            '@_multiplicity': relation.sourceMultiplicity,
            '@_aggregation': isAggregation ? 'shared' : isComposition ? 'composite' : 'none',
            '@_containment': 'Unspecified',
          },
          modifiers: { '@_isOrdered': 'false', '@_changeable': 'none', '@_isNavigable': 'true' },
          style: { '@_value': 'Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Navigable;' },
        },
        target: {
          '@_xmi:idref': targetCId,
          model: { '@_type': 'Class', '@_name': targetClass?.name ?? '' },
          role: { '@_visibility': 'Public', '@_targetScope': 'instance' },
          type: {
            '@_multiplicity': relation.targetMultiplicity,
            '@_aggregation': 'none',
            '@_containment': 'Unspecified',
          },
          modifiers: { '@_isOrdered': 'false', '@_changeable': 'none', '@_isNavigable': 'true' },
          style: { '@_value': 'Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Navigable;' },
        },
        model: { '@_ea_localid': String(index + 1) },
        properties: {
          '@_name': relation.label ?? '',
          '@_ea_type': eaType,
          '@_direction': 'Source -> Destination',
        },
        appearance: { '@_linemode': '1', '@_linecolor': '-1', '@_linewidth': '0', '@_seqno': String(index + 1), '@_headStyle': '0', '@_lineStyle': '0' },
      };
    });

    const diagramDiagramElements: Record<string, unknown>[] = [];
    diagram.classes.forEach((umlClass, index) => {
      const cId = classId.get(umlClass.id)!;
      const left = Math.round(umlClass.x + shiftX);
      const top = Math.round(umlClass.y + shiftY);
      const width = Math.round(umlClass.width || Math.max(180, Math.min(300, 120 + umlClass.name.length * 8)));
      const height = Math.round(umlClass.height || Math.max(120, 60 + (umlClass.attributes.length + umlClass.methods.length) * 18));
      const right = left + width;
      const bottom = top + height;
      diagramDiagramElements.push({
        '@_geometry': `Left=${left};Top=${top};Right=${right};Bottom=${bottom};`,
        '@_subject': cId,
        '@_seqno': String(index + 1),
        '@_style': `DUID=${this.safeId(umlClass.id).slice(0, 8).toUpperCase()};`,
      });
    });

    diagram.relations.forEach(relation => {
      const rId = relationIdMap.get(relation.id)!;
      diagramDiagramElements.push({
        '@_geometry': 'SX=0;SY=0;EX=0;EY=0;Path=;',
        '@_subject': rId,
        '@_style': ';Hidden=0;',
      });
    });

    const eaExtension = {
      '@_extender': 'Enterprise Architect',
      '@_extenderID': '6.5',
      elements: { element: eaElements },
      connectors: { connector: eaConnectors },
      diagrams: {
        diagram: {
          '@_xmi:id': diagramXmiId,
          model: { '@_package': modelXmiId, '@_localID': '1', '@_owner': modelXmiId },
          properties: { '@_name': diagram.name, '@_type': 'Logical' },
          project: { '@_author': 'ARQNOVA', '@_version': '1.0', '@_created': new Date().toISOString() },
          style1: { '@_value': 'ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=1;PPgs.cy=1;DocSize.cx=850;DocSize.cy=1098;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=1;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;' },
          style2: { '@_value': 'ExcludeRTF=0;DocAll=0;HideQuals=0;AttPkg=1;ShowTests=0;ShowMaint=0;SuppressFOC=0;INT_ARGS=;INT_RET=;INT_ATT=;SeqTopMargin=50;MatrixActive=0;SwimlanesActive=1;KanbanActive=0;MatrixLineWidth=1;MatrixLineClr=0;MatrixLocked=0;TConnectorNotation=UML 2.1;TExplicitNavigability=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;ProfileData=;MDGDgm=;STBLDgm=;ShowNotes=0;VisibleAttributeDetail=0;ShowOpRetType=1;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;SuppressedCompartments=;Theme=:119;SaveTag=D95F455B;' },
          swimlanes: { '@_value': 'locked=false;orientation=0;width=0;inbar=false;names=false;color=-1;bold=false;fcol=0;tcol=-1;ofCol=-1;ufCol=-1;hl=0;ufh=0;cls=0;SwimlaneFont=lfh:-10,lfw:0,lfi:0,lfu:0,lfs:0,lfface:Calibri,lfe:0,lfo:0,lfchar:1,lfop:0,lfcp:0,lfq:0,lfpf=0,lfWidth=0;' },
          matrixitems: { '@_value': 'locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;' },
          extendedProperties: {},
          elements: { element: diagramDiagramElements },
        },
      },
    };

    const document = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      'xmi:XMI': {
        '@_xmi:version': '2.5.1',
        '@_xmlns:xmi': 'http://www.omg.org/spec/XMI/20131001',
        '@_xmlns:uml': 'http://www.eclipse.org/uml2/5.0.0/UML',
        '@_xmlns:arqnova': 'https://arqnova.local/xmi',
        'xmi:Documentation': { '@_exporter': 'ARQNOVA', '@_exporterVersion': '1.0' },
        'uml:Model': {
          '@_xmi:type': 'uml:Model',
          '@_xmi:id': modelXmiId,
          '@_name': diagram.name,
          packagedElement,
        },
        'xmi:Extension': eaExtension,
      },
    };

    return { filename: `${this.safeFilename(diagram.name)}.xmi`, content: this.builder.build(document) };
  }

  async import(projectId: string, userId: string, file: { buffer: Buffer; originalname: string; size: number }) {
    await this.diagrams.validateProjectAccess(projectId, userId);
    if (!file?.buffer?.length) throw new BadRequestException('Selecciona un archivo XMI válido');
    if (file.size > MAX_XMI_BYTES) throw new BadRequestException('El archivo XMI supera el límite de 2 MB');
    if (!/\.(?:xmi|xml)$/i.test(file.originalname)) throw new BadRequestException('El archivo debe tener extensión .xmi o .xml');
    if (this.collaboration.getLocks(projectId).length) throw new ConflictException('No se puede importar mientras existen elementos en edición');
    const xml = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const model = this.parse(xml);
    const summary = this.summarize(model);

    await this.prisma.$transaction(async transaction => {
      const project = await transaction.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { name: true } });
      if (!project) throw new BadRequestException('Proyecto inexistente');
      const diagram = await transaction.diagram.upsert({ where: { projectId }, create: { projectId, name: model.name || `Diagrama de ${project.name}` }, update: { name: model.name || undefined } });
      await transaction.umlRelation.deleteMany({ where: { diagramId: diagram.id } });
      await transaction.umlClass.deleteMany({ where: { diagramId: diagram.id } });
      const ids = new Map<string, string>();
      for (const umlClass of model.classes) {
        const created = await transaction.umlClass.create({
          data: {
            diagramId: diagram.id,
            name: umlClass.name,
            x: umlClass.x,
            y: umlClass.y,
            isAbstract: umlClass.isAbstract,
            attributes: { create: umlClass.attributes.map((attribute, position) => ({ ...attribute, position })) },
            methods: { create: umlClass.methods.map((method, position) => ({ ...method, position })) },
          },
          select: { id: true },
        });
        ids.set(umlClass.externalId, created.id);
      }
      for (const relation of model.relations) {
        await transaction.umlRelation.create({
          data: {
            diagramId: diagram.id,
            sourceClassId: ids.get(relation.sourceExternalId)!,
            targetClassId: ids.get(relation.targetExternalId)!,
            type: relation.type,
            sourceMultiplicity: relation.sourceMultiplicity,
            targetMultiplicity: relation.targetMultiplicity,
            label: relation.label,
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const diagram = await this.diagrams.getByProject(projectId, userId);
    this.collaboration.publish(projectId, 'uml:diagram:updated', diagram, userId);
    return { imported: summary, diagram };
  }

  parse(xml: string): XmiModel {
    if (!xml.trim() || XMLValidator.validate(xml) !== true) throw new BadRequestException('El archivo XMI contiene XML inválido');
    let parsed: any;
    try { parsed = this.parser.parse(xml); } catch { throw new BadRequestException('El archivo XMI contiene XML inválido'); }
    const root = parsed['xmi:XMI'] ?? parsed.XMI;
    const modelNode = root?.['uml:Model'] ?? root?.Model ?? parsed['uml:Model'] ?? parsed.Model;
    if (!modelNode) throw new BadRequestException('El archivo no contiene un modelo UML');

    // Extract diagram positions and EA element attribute/operation metadata if present
    const eaPositions = new Map<string, { x: number; y: number }>();
    const eaAttrTypes = new Map<string, string>();
    const eaMethodReturnTypes = new Map<string, string>();
    const extensions = this.array(root?.['xmi:Extension'] ?? root?.Extension ?? parsed['xmi:Extension']);
    for (const ext of extensions) {
      const diagrams = this.array(ext?.diagrams?.diagram ?? ext?.diagram);
      for (const d of diagrams) {
        const diagramElements = this.array(d?.elements?.element ?? d?.element);
        for (const de of diagramElements) {
          const subject = String(de?.['@_subject'] ?? de?.['@_xmi:idref'] ?? de?.['@_idref'] ?? '');
          const geometry = String(de?.['@_geometry'] ?? '');
          if (subject && geometry) {
            const leftMatch = geometry.match(/Left=(-?\d+)/i);
            const topMatch = geometry.match(/Top=(-?\d+)/i);
            if (leftMatch && topMatch) {
              eaPositions.set(subject, { x: Number(leftMatch[1]), y: Number(topMatch[1]) });
            }
          }
        }
      }

      const elements = this.array(ext?.elements?.element ?? ext?.element);
      for (const el of elements) {
        const elId = String(el?.['@_xmi:idref'] ?? el?.['@_idref'] ?? '');
        const elAttributes = this.array(el?.attributes?.attribute ?? el?.attribute);
        for (const attr of elAttributes) {
          const attrId = String(attr?.['@_xmi:idref'] ?? attr?.['@_idref'] ?? '');
          const attrName = String(attr?.['@_name'] ?? '');
          const attrType = String(attr?.properties?.['@_type'] ?? attr?.['@_type'] ?? attr?.properties?.type ?? '').trim();
          if (attrType) {
            if (attrId) eaAttrTypes.set(attrId, attrType);
            if (elId && attrName) eaAttrTypes.set(`${elId}:${attrName}`, attrType);
            if (attrName) eaAttrTypes.set(attrName, attrType);
          }
        }
        const elOperations = this.array(el?.operations?.operation ?? el?.operation);
        for (const op of elOperations) {
          const opId = String(op?.['@_xmi:idref'] ?? op?.['@_idref'] ?? '');
          const opName = String(op?.['@_name'] ?? '');
          const retType = String(op?.properties?.['@_returnType'] ?? op?.properties?.['@_type'] ?? op?.['@_returnType'] ?? '').trim();
          if (retType) {
            if (opId) eaMethodReturnTypes.set(opId, retType);
            if (elId && opName) eaMethodReturnTypes.set(`${elId}:${opName}`, retType);
          }
        }
      }
    }

    // Flatten all packagedElement recursively (to handle packages created by EA)
    const allElements: any[] = [];
    const collectElements = (node: any) => {
      if (!node) return;
      for (const item of this.array(node.packagedElement ?? node.element ?? node.ownedMember)) {
        allElements.push(item);
        if (this.localType(item?.['@_xmi:type']) === 'Package' || item?.packagedElement) {
          collectElements(item);
        }
      }
    };
    collectElements(modelNode);

    const typeNames = new Map(allElements.filter(item => this.localType(item?.['@_xmi:type']) === 'PrimitiveType').map(item => [String(item['@_xmi:id']), String(item['@_name'])]));
    const classNodes = allElements.filter(item => this.localType(item?.['@_xmi:type']) === 'Class');
    const classes: XmiClass[] = classNodes.map((item, index) => this.parseClass(item, index, typeNames, eaPositions, eaAttrTypes, eaMethodReturnTypes));
    const externalIds = new Set<string>();
    const names = new Set<string>();
    for (const item of classes) {
      if (externalIds.has(item.externalId) || names.has(this.key(item.name))) throw new BadRequestException('El XMI contiene clases duplicadas');
      externalIds.add(item.externalId);
      names.add(this.key(item.name));
    }

    const relations: XmiRelation[] = [];
    for (const item of allElements) {
      const relation = this.parseRelation(item);
      if (relation) relations.push(relation);
    }

    for (const source of classNodes) {
      for (const generalization of this.array(source.generalization)) {
        relations.push({
          sourceExternalId: this.required(source['@_xmi:id'], 'clase'),
          targetExternalId: this.required(generalization['@_general'] ?? generalization?.general?.['@_xmi:idref'], 'generalización'),
          type: UmlRelationType.INHERITANCE,
          sourceMultiplicity: '1',
          targetMultiplicity: '1',
          label: generalization['@_name'],
        });
      }
    }

    // Also check connectors in EA extension if some associations were only present there
    for (const ext of extensions) {
      const connectors = this.array(ext?.connectors?.connector ?? ext?.connector);
      for (const conn of connectors) {
        const sourceId = conn?.source?.['@_xmi:idref'] ?? conn?.source?.['@_idref'];
        const targetId = conn?.target?.['@_xmi:idref'] ?? conn?.target?.['@_idref'];
        if (sourceId && targetId && externalIds.has(sourceId) && externalIds.has(targetId)) {
          const eaType = conn?.properties?.['@_ea_type'] ?? conn?.['@_ea_type'];
          let relType: UmlRelationType = UmlRelationType.ASSOCIATION;
          if (eaType === 'Generalization') relType = UmlRelationType.INHERITANCE;
          else if (eaType === 'Dependency') relType = UmlRelationType.DEPENDENCY;
          else if (eaType === 'Composition' || conn?.source?.type?.['@_aggregation'] === 'composite' || conn?.target?.type?.['@_aggregation'] === 'composite') relType = UmlRelationType.COMPOSITION;
          else if (eaType === 'Aggregation' || conn?.source?.type?.['@_aggregation'] === 'shared' || conn?.target?.type?.['@_aggregation'] === 'shared') relType = UmlRelationType.AGGREGATION;

          const key = `${sourceId}:${targetId}:${relType}`;
          if (!relations.some(r => `${r.sourceExternalId}:${r.targetExternalId}:${r.type}` === key)) {
            relations.push({
              sourceExternalId: sourceId,
              targetExternalId: targetId,
              type: relType,
              sourceMultiplicity: this.cleanMultiplicity(conn?.source?.type?.['@_multiplicity']),
              targetMultiplicity: this.cleanMultiplicity(conn?.target?.type?.['@_multiplicity']),
              label: conn?.properties?.['@_name'] || undefined,
            });
          }
        }
      }
    }

    const relationKeys = new Set<string>();
    for (const relation of relations) {
      if (!externalIds.has(relation.sourceExternalId) || !externalIds.has(relation.targetExternalId)) throw new BadRequestException('El XMI contiene relaciones con clases inexistentes');
      this.assertMultiplicity(relation.sourceMultiplicity);
      this.assertMultiplicity(relation.targetMultiplicity);
      const key = `${relation.sourceExternalId}:${relation.targetExternalId}:${relation.type}`;
      if (relationKeys.has(key)) throw new BadRequestException('El XMI contiene relaciones duplicadas');
      relationKeys.add(key);
    }

    return { name: String(modelNode['@_name'] ?? 'Diagrama importado').trim(), classes, relations };
  }

  private parseClass(
    item: any,
    index: number,
    typeNames: Map<string, string>,
    eaPositions: Map<string, { x: number; y: number }>,
    eaAttrTypes: Map<string, string>,
    eaMethodReturnTypes: Map<string, string>,
  ): XmiClass {
    const classId = this.required(item['@_xmi:id'], 'clase');
    const attributes = this.array(item.ownedAttribute).map((attribute: any) => {
      const attrId = String(attribute['@_xmi:id'] ?? '');
      const attrName = String(attribute['@_name'] ?? '');
      const rawType = attribute['@_arqnova:typeName'] ??
        attribute.properties?.['@_type'] ??
        attribute.properties?.type ??
        attribute['xmi:Extension']?.properties?.['@_type'] ??
        attribute.Extension?.properties?.['@_type'] ??
        (attrId ? eaAttrTypes.get(attrId) : null) ??
        (classId && attrName ? eaAttrTypes.get(`${classId}:${attrName}`) : null) ??
        typeNames.get(String(attribute['@_type'])) ??
        attribute.type?.['@_href']?.split('#').pop()?.split('/').pop() ??
        attribute['@_type']?.split('#').pop()?.split('/').pop() ??
        attribute.type?.['@_name'] ??
        attribute['@_name:type'] ??
        'String';
      const cleanType = String(rawType).replace(/^UML_PrimitiveTypes::/i, '').replace(/^PrimitiveTypes::/i, '').trim() || 'String';
      return {
        name: this.required(attribute['@_name'], 'atributo'),
        type: cleanType,
        visibility: this.visibility(attribute['@_visibility']),
        isPrimaryKey: attribute['@_arqnova:isPrimaryKey'] === 'true' || attribute['@_isID'] === 'true',
      };
    });

    const methods = this.array(item.ownedOperation).map((method: any) => {
      const methodId = String(method['@_xmi:id'] ?? '');
      const methodName = String(method['@_name'] ?? '');
      const returnParameter = this.array(method.ownedParameter).find((parameter: any) => parameter['@_direction'] === 'return');
      const rawType = method['@_arqnova:returnType'] ??
        method.properties?.['@_returnType'] ??
        method.properties?.['@_type'] ??
        method['xmi:Extension']?.properties?.['@_returnType'] ??
        method['xmi:Extension']?.properties?.['@_type'] ??
        (methodId ? eaMethodReturnTypes.get(methodId) : null) ??
        (classId && methodName ? eaMethodReturnTypes.get(`${classId}:${methodName}`) : null) ??
        (returnParameter ? (
          returnParameter.properties?.['@_type'] ??
          typeNames.get(String(returnParameter['@_type'])) ??
          returnParameter.type?.['@_href']?.split('#').pop()?.split('/').pop() ??
          returnParameter['@_type']?.split('#').pop()?.split('/').pop() ??
          returnParameter.type?.['@_name']
        ) : null) ??
        method['@_returnType'] ??
        'void';
      const cleanType = String(rawType).replace(/^UML_PrimitiveTypes::/i, '').replace(/^PrimitiveTypes::/i, '').trim() || 'void';
      return {
        name: this.required(method['@_name'], 'método'),
        returnType: cleanType,
        visibility: this.visibility(method['@_visibility'] ?? 'public'),
      };
    });

    this.assertUnique(attributes.map(item => item.name), 'atributos');
    this.assertUnique(methods.map(item => item.name), 'métodos');

    const eaPos = eaPositions.get(classId);
    const posX = item['@_arqnova:x'] !== undefined ? this.number(item['@_arqnova:x'], 80 + (index % 4) * 300) : (eaPos ? eaPos.x : 80 + (index % 4) * 300);
    const posY = item['@_arqnova:y'] !== undefined ? this.number(item['@_arqnova:y'], 80 + Math.floor(index / 4) * 240) : (eaPos ? eaPos.y : 80 + Math.floor(index / 4) * 240);

    return {
      externalId: classId,
      name: this.required(item['@_name'], 'clase'),
      x: posX,
      y: posY,
      isAbstract: item['@_isAbstract'] === 'true',
      attributes,
      methods,
    };
  }

  private parseRelation(item: any): XmiRelation | null {
    const local = this.localType(item?.['@_xmi:type']);
    const supported: Record<string, UmlRelationType> = {
      Association: UmlRelationType.ASSOCIATION,
      Aggregation: UmlRelationType.AGGREGATION,
      Composition: UmlRelationType.COMPOSITION,
      Generalization: UmlRelationType.INHERITANCE,
      Dependency: UmlRelationType.DEPENDENCY,
    };
    if (!supported[local]) return null;

    const ends = this.array(item.ownedEnd);
    const memberEnds = this.array(item.memberEnd);
    const source = item['@_arqnova:source'] ?? item['@_source'] ?? item['@_client'] ?? ends[0]?.['@_type'] ?? memberEnds[0]?.['@_type'];
    const target = item['@_arqnova:target'] ?? item['@_target'] ?? item['@_supplier'] ?? ends[1]?.['@_type'] ?? memberEnds[1]?.['@_type'];
    if (!source || !target) return null;

    let type = supported[local];
    const aggregation = ends[0]?.['@_aggregation'] ?? ends[1]?.['@_aggregation'];
    if (aggregation === 'shared') type = UmlRelationType.AGGREGATION;
    if (aggregation === 'composite') type = UmlRelationType.COMPOSITION;

    return {
      sourceExternalId: this.required(source, 'origen de relación'),
      targetExternalId: this.required(target, 'destino de relación'),
      type,
      sourceMultiplicity: item['@_arqnova:sourceMultiplicity'] ?? this.multiplicity(ends[0]),
      targetMultiplicity: item['@_arqnova:targetMultiplicity'] ?? this.multiplicity(ends[1]),
      label: item['@_name'],
    };
  }

  private exportRelation(relation: any, classIds: Map<string, string>, relationIdMap: Map<string, string>) {
    const source = classIds.get(relation.sourceClassId)!;
    const target = classIds.get(relation.targetClassId)!;
    const relId = relationIdMap.get(relation.id)!;
    const typeName = relation.type === UmlRelationType.DEPENDENCY ? 'Dependency' : relation.type === UmlRelationType.INHERITANCE ? 'Generalization' : 'Association';
    const result: any = {
      '@_xmi:type': `uml:${typeName}`,
      '@_xmi:id': relId,
      '@_name': relation.label ?? undefined,
      '@_arqnova:source': source,
      '@_arqnova:target': target,
      '@_arqnova:type': relation.type,
      '@_arqnova:sourceMultiplicity': relation.sourceMultiplicity,
      '@_arqnova:targetMultiplicity': relation.targetMultiplicity,
    };
    if (relation.type === UmlRelationType.DEPENDENCY) {
      result['@_client'] = source;
      result['@_supplier'] = target;
    } else if (relation.type === UmlRelationType.INHERITANCE) {
      result['@_general'] = target;
    } else {
      const srcEndId = `EAID_src_${this.safeId(relation.id)}`;
      const dstEndId = `EAID_dst_${this.safeId(relation.id)}`;
      result.memberEnd = [{ '@_xmi:idref': dstEndId }, { '@_xmi:idref': srcEndId }];
      result.ownedEnd = [
        this.exportEnd(srcEndId, source, relation.sourceMultiplicity, relation.type, relId),
        this.exportEnd(dstEndId, target, relation.targetMultiplicity, undefined, relId),
      ];
    }
    return result;
  }

  private exportEnd(id: string, type: string, multiplicity: string, relationType?: UmlRelationType, associationId?: string) {
    const [lower, upper] = multiplicity.includes('..') ? multiplicity.split('..') : multiplicity === '*' ? ['0', '*'] : [multiplicity, multiplicity];
    return {
      '@_xmi:type': 'uml:Property',
      '@_xmi:id': this.safeId(id),
      '@_type': type,
      '@_association': associationId,
      '@_aggregation': relationType === UmlRelationType.AGGREGATION ? 'shared' : relationType === UmlRelationType.COMPOSITION ? 'composite' : 'none',
      lowerValue: { '@_xmi:type': 'uml:LiteralInteger', '@_value': lower },
      upperValue: { '@_xmi:type': 'uml:LiteralUnlimitedNatural', '@_value': upper },
    };
  }

  private multiplicity(end: any) {
    if (!end) return '1';
    const lower = String(end.lowerValue?.['@_value'] ?? end['@_lower'] ?? '1');
    const upper = String(end.upperValue?.['@_value'] ?? end['@_upper'] ?? lower);
    return lower === upper ? lower : `${lower}..${upper}`;
  }

  private cleanMultiplicity(value: unknown): string {
    const str = String(value ?? '').trim();
    if (!str || str === 'undefined' || str === 'null') return '1';
    return MULTIPLICITY.test(str) ? str : '1';
  }

  private visibility(value: unknown) {
    const result = VISIBILITY[String(value ?? 'private').toLowerCase()];
    if (!result) return UmlVisibility.PUBLIC;
    return result;
  }

  private assertMultiplicity(value: string) {
    if (!MULTIPLICITY.test(value)) throw new BadRequestException('El XMI contiene una multiplicidad inválida');
  }

  private assertUnique(values: string[], label: string) {
    const seen = new Set<string>();
    for (const value of values) {
      const key = this.key(value);
      if (seen.has(key)) throw new BadRequestException(`El XMI contiene ${label} duplicados`);
      seen.add(key);
    }
  }

  private required(value: unknown, label: string) {
    const result = String(value ?? '').trim();
    if (!result) throw new BadRequestException(`El XMI contiene ${label} sin identificar`);
    return result;
  }

  private number(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private array<T>(value: T | T[] | undefined): T[] {
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  }

  private localType(value: unknown) {
    return String(value ?? '').split(':').pop() ?? '';
  }

  private key(value: string) {
    return value.trim().toLocaleLowerCase();
  }

  private summarize(model: XmiModel) {
    return Object.freeze({
      classes: model.classes.length,
      attributes: model.classes.reduce((sum, item) => sum + item.attributes.length, 0),
      methods: model.classes.reduce((sum, item) => sum + item.methods.length, 0),
      relations: model.relations.length,
    });
  }

  private safeFilename(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'arqnova-diagram';
  }

  private safeId(value: string) {
    return value.replaceAll('-', '_');
  }
}

