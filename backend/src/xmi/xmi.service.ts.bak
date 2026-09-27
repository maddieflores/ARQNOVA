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

  constructor(private readonly prisma: PrismaService, private readonly diagrams: DiagramsService, private readonly collaboration: CollaborationService) {}

  async export(projectId: string, userId: string) {
    const diagram = await this.diagrams.getOrCreateByProject(projectId, userId);
    const classId = new Map(diagram.classes.map(item => [item.id, `class_${item.id.replaceAll('-', '_')}`]));
    const typeNames = [...new Set(diagram.classes.flatMap(item => [...item.attributes.map(attribute => attribute.type), ...item.methods.map(method => method.returnType)]))];
    const typeIds = new Map(typeNames.map((name, index) => [name, `primitive_${index}_${this.safeFilename(name)}`]));
    const packagedElement: Record<string, unknown>[] = typeNames.map(name => ({ '@_xmi:type': 'uml:PrimitiveType', '@_xmi:id': typeIds.get(name), '@_name': name }));
    packagedElement.push(...diagram.classes.map(umlClass => ({
      '@_xmi:type': 'uml:Class', '@_xmi:id': classId.get(umlClass.id), '@_name': umlClass.name, '@_isAbstract': String(umlClass.isAbstract), '@_arqnova:x': String(umlClass.x), '@_arqnova:y': String(umlClass.y),
      ownedAttribute: umlClass.attributes.map(attribute => ({ '@_xmi:id': `attribute_${attribute.id.replaceAll('-', '_')}`, '@_name': attribute.name, '@_type': typeIds.get(attribute.type), '@_visibility': attribute.visibility.toLowerCase(), '@_arqnova:typeName': attribute.type, '@_arqnova:isPrimaryKey': String(attribute.isPrimaryKey) })),
      ownedOperation: umlClass.methods.map(method => ({ '@_xmi:id': `method_${method.id.replaceAll('-', '_')}`, '@_name': method.name, '@_visibility': method.visibility.toLowerCase(), '@_arqnova:returnType': method.returnType, ownedParameter: { '@_xmi:id': `return_${method.id.replaceAll('-', '_')}`, '@_direction': 'return', '@_type': typeIds.get(method.returnType) } })),
    })));
    for (const relation of diagram.relations) packagedElement.push(this.exportRelation(relation, classId));
    const document = { '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' }, 'xmi:XMI': { '@_xmi:version': '2.5.1', '@_xmlns:xmi': 'http://www.omg.org/spec/XMI/20131001', '@_xmlns:uml': 'http://www.eclipse.org/uml2/5.0.0/UML', '@_xmlns:arqnova': 'https://arqnova.local/xmi', 'uml:Model': { '@_xmi:id': `diagram_${diagram.id.replaceAll('-', '_')}`, '@_name': diagram.name, packagedElement } } };
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
    // El resumen se calcula únicamente después de validar por completo estructura,
    // identificadores y referencias. Ninguna escritura ocurre antes de este punto.
    const summary = this.summarize(model);

    await this.prisma.$transaction(async transaction => {
      const project = await transaction.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { name: true } });
      if (!project) throw new BadRequestException('Proyecto inexistente');
      const diagram = await transaction.diagram.upsert({ where: { projectId }, create: { projectId, name: model.name || `Diagrama de ${project.name}` }, update: { name: model.name || undefined } });
      await transaction.umlRelation.deleteMany({ where: { diagramId: diagram.id } });
      await transaction.umlClass.deleteMany({ where: { diagramId: diagram.id } });
      const ids = new Map<string, string>();
      for (const umlClass of model.classes) {
        const created = await transaction.umlClass.create({ data: { diagramId: diagram.id, name: umlClass.name, x: umlClass.x, y: umlClass.y, isAbstract: umlClass.isAbstract,
          attributes: { create: umlClass.attributes.map((attribute, position) => ({ ...attribute, position })) }, methods: { create: umlClass.methods.map((method, position) => ({ ...method, position })) } }, select: { id: true } });
        ids.set(umlClass.externalId, created.id);
      }
      for (const relation of model.relations) await transaction.umlRelation.create({ data: { diagramId: diagram.id, sourceClassId: ids.get(relation.sourceExternalId)!, targetClassId: ids.get(relation.targetExternalId)!, type: relation.type, sourceMultiplicity: relation.sourceMultiplicity, targetMultiplicity: relation.targetMultiplicity, label: relation.label } });
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
    const modelNode = root?.['uml:Model'] ?? root?.Model ?? parsed['uml:Model'];
    if (!modelNode) throw new BadRequestException('El archivo no contiene un modelo UML');
    const elements = this.array(modelNode.packagedElement);
    const typeNames = new Map(elements.filter(item => this.localType(item?.['@_xmi:type']) === 'PrimitiveType').map(item => [String(item['@_xmi:id']), String(item['@_name'])]));
    const classNodes = elements.filter(item => this.localType(item?.['@_xmi:type']) === 'Class');
    const classes: XmiClass[] = classNodes.map((item, index) => this.parseClass(item, index, typeNames));
    const externalIds = new Set<string>(); const names = new Set<string>();
    for (const item of classes) { if (externalIds.has(item.externalId) || names.has(this.key(item.name))) throw new BadRequestException('El XMI contiene clases duplicadas'); externalIds.add(item.externalId); names.add(this.key(item.name)); }
    const relations: XmiRelation[] = [];
    for (const item of elements) { const relation = this.parseRelation(item); if (relation) relations.push(relation); }
    for (const source of classNodes) for (const generalization of this.array(source.generalization)) relations.push({ sourceExternalId: this.required(source['@_xmi:id'], 'clase'), targetExternalId: this.required(generalization['@_general'], 'generalización'), type: UmlRelationType.INHERITANCE, sourceMultiplicity: '1', targetMultiplicity: '1', label: generalization['@_name'] });
    const relationKeys = new Set<string>();
    for (const relation of relations) { if (!externalIds.has(relation.sourceExternalId) || !externalIds.has(relation.targetExternalId)) throw new BadRequestException('El XMI contiene relaciones con clases inexistentes'); this.assertMultiplicity(relation.sourceMultiplicity); this.assertMultiplicity(relation.targetMultiplicity); const key = `${relation.sourceExternalId}:${relation.targetExternalId}:${relation.type}`; if (relationKeys.has(key)) throw new BadRequestException('El XMI contiene relaciones duplicadas'); relationKeys.add(key); }
    return { name: String(modelNode['@_name'] ?? 'Diagrama importado').trim(), classes, relations };
  }

  private parseClass(item: any, index: number, typeNames: Map<string, string>): XmiClass {
    const attributes = this.array(item.ownedAttribute).map((attribute: any) => ({ name: this.required(attribute['@_name'], 'atributo'), type: String(attribute['@_arqnova:typeName'] ?? typeNames.get(String(attribute['@_type'])) ?? attribute.type?.['@_href']?.split('#').pop() ?? attribute['@_type'] ?? 'String'), visibility: this.visibility(attribute['@_visibility']), isPrimaryKey: attribute['@_arqnova:isPrimaryKey'] === 'true' }));
    const methods = this.array(item.ownedOperation).map((method: any) => { const returnParameter = this.array(method.ownedParameter).find((parameter: any) => parameter['@_direction'] === 'return'); return { name: this.required(method['@_name'], 'método'), returnType: String(method['@_arqnova:returnType'] ?? typeNames.get(String(returnParameter?.['@_type'])) ?? returnParameter?.['@_type'] ?? 'void'), visibility: this.visibility(method['@_visibility'] ?? 'public') }; });
    this.assertUnique(attributes.map(item => item.name), 'atributos'); this.assertUnique(methods.map(item => item.name), 'métodos');
    return { externalId: this.required(item['@_xmi:id'], 'clase'), name: this.required(item['@_name'], 'clase'), x: this.number(item['@_arqnova:x'], 80 + (index % 4) * 300), y: this.number(item['@_arqnova:y'], 80 + Math.floor(index / 4) * 240), isAbstract: item['@_isAbstract'] === 'true', attributes, methods };
  }

  private parseRelation(item: any): XmiRelation | null {
    const local = this.localType(item?.['@_xmi:type']); const supported: Record<string, UmlRelationType> = { Association: UmlRelationType.ASSOCIATION, Aggregation: UmlRelationType.AGGREGATION, Composition: UmlRelationType.COMPOSITION, Generalization: UmlRelationType.INHERITANCE, Dependency: UmlRelationType.DEPENDENCY };
    if (!supported[local]) return null;
    const ends = this.array(item.ownedEnd); const source = item['@_arqnova:source'] ?? item['@_source'] ?? item['@_client'] ?? ends[0]?.['@_type']; const target = item['@_arqnova:target'] ?? item['@_target'] ?? item['@_supplier'] ?? ends[1]?.['@_type'];
    let type = supported[local]; const aggregation = ends[0]?.['@_aggregation'] ?? ends[1]?.['@_aggregation']; if (aggregation === 'shared') type = UmlRelationType.AGGREGATION; if (aggregation === 'composite') type = UmlRelationType.COMPOSITION;
    return { sourceExternalId: this.required(source, 'origen de relación'), targetExternalId: this.required(target, 'destino de relación'), type, sourceMultiplicity: item['@_arqnova:sourceMultiplicity'] ?? this.multiplicity(ends[0]), targetMultiplicity: item['@_arqnova:targetMultiplicity'] ?? this.multiplicity(ends[1]), label: item['@_name'] };
  }

  private exportRelation(relation: any, classIds: Map<string, string>) {
    const source = classIds.get(relation.sourceClassId)!; const target = classIds.get(relation.targetClassId)!; const typeName = relation.type === UmlRelationType.DEPENDENCY ? 'Dependency' : relation.type === UmlRelationType.INHERITANCE ? 'Generalization' : 'Association';
    const result: any = { '@_xmi:type': `uml:${typeName}`, '@_xmi:id': `relation_${relation.id.replaceAll('-', '_')}`, '@_name': relation.label ?? undefined, '@_arqnova:source': source, '@_arqnova:target': target, '@_arqnova:type': relation.type, '@_arqnova:sourceMultiplicity': relation.sourceMultiplicity, '@_arqnova:targetMultiplicity': relation.targetMultiplicity };
    if (relation.type === UmlRelationType.DEPENDENCY) { result['@_client'] = source; result['@_supplier'] = target; }
    else result.ownedEnd = [this.exportEnd(`source_${relation.id}`, source, relation.sourceMultiplicity, relation.type), this.exportEnd(`target_${relation.id}`, target, relation.targetMultiplicity)];
    return result;
  }

  private exportEnd(id: string, type: string, multiplicity: string, relationType?: UmlRelationType) { const [lower, upper] = multiplicity.includes('..') ? multiplicity.split('..') : multiplicity === '*' ? ['0', '*'] : [multiplicity, multiplicity]; return { '@_xmi:id': id.replaceAll('-', '_'), '@_type': type, '@_aggregation': relationType === UmlRelationType.AGGREGATION ? 'shared' : relationType === UmlRelationType.COMPOSITION ? 'composite' : 'none', lowerValue: { '@_xmi:type': 'uml:LiteralInteger', '@_value': lower }, upperValue: { '@_xmi:type': 'uml:LiteralUnlimitedNatural', '@_value': upper } }; }
  private multiplicity(end: any) { if (!end) return '1'; const lower = String(end.lowerValue?.['@_value'] ?? end['@_lower'] ?? '1'); const upper = String(end.upperValue?.['@_value'] ?? end['@_upper'] ?? lower); return lower === upper ? lower : `${lower}..${upper}`; }
  private visibility(value: unknown) { const result = VISIBILITY[String(value ?? 'private').toLowerCase()]; if (!result) throw new BadRequestException('El XMI contiene una visibilidad inválida'); return result; }
  private assertMultiplicity(value: string) { if (!MULTIPLICITY.test(value)) throw new BadRequestException('El XMI contiene una multiplicidad inválida'); }
  private assertUnique(values: string[], label: string) { const seen = new Set<string>(); for (const value of values) { const key = this.key(value); if (seen.has(key)) throw new BadRequestException(`El XMI contiene ${label} duplicados`); seen.add(key); } }
  private required(value: unknown, label: string) { const result = String(value ?? '').trim(); if (!result) throw new BadRequestException(`El XMI contiene ${label} sin identificar`); return result; }
  private number(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  private array<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
  private localType(value: unknown) { return String(value ?? '').split(':').pop() ?? ''; }
  private key(value: string) { return value.trim().toLocaleLowerCase(); }
  private summarize(model: XmiModel) { return Object.freeze({ classes: model.classes.length, attributes: model.classes.reduce((sum, item) => sum + item.attributes.length, 0), methods: model.classes.reduce((sum, item) => sum + item.methods.length, 0), relations: model.relations.length }); }
  private safeFilename(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'arqnova-diagram'; }
}
