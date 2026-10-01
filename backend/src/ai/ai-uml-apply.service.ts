import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UmlRelationType, UmlVisibility } from '@prisma/client';
import { CollaborationService } from '../collaboration/collaboration.service';
import { validateDto } from '../common/validate-dto';
import { PrismaService } from '../prisma/prisma.service';
import { DiagramsService } from '../uml/diagrams.service';
import { AiUmlProposalService } from './ai-uml-proposal.service';
import { ApplyUmlProposalDto } from './dto/apply-uml-proposal.dto';
import { AiActionType, AiUmlActionDto } from './dto/ai-uml-proposal.dto';

const GRID_COLUMNS = 4;
const GRID_X = 300;
const GRID_Y = 240;
const GRID_MARGIN = 80;

@Injectable()
export class AiUmlApplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagrams: DiagramsService,
    private readonly proposals: AiUmlProposalService,
    private readonly collaboration: CollaborationService,
  ) {}

  async apply(projectId: string, userId: string, input: ApplyUmlProposalDto) {
    const dto = validateDto(ApplyUmlProposalDto, input);
    try {
      this.proposals.validateSemantics(dto.proposal);
    } catch (error) {
      if (error instanceof BadGatewayException) throw new BadRequestException('La propuesta UML no es válida');
      throw error;
    }
    const project = await this.diagrams.validateProjectAccess(projectId, userId);

    let counts: { classes: number; attributes: number; methods: number; relations: number };
    try {
      counts = await this.prisma.$transaction(async transaction => {
        const diagram = await transaction.diagram.upsert({
          where: { projectId },
          create: { projectId, name: `Diagrama de ${project.name}` },
          update: {},
          include: {
            classes: {
              include: {
                attributes: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
                methods: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
            relations: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          },
        });

        // Caso 1: La propuesta contiene acciones estructuradas
        if (dto.proposal.actions && dto.proposal.actions.length > 0) {
          return await this.applyActions(transaction, diagram, dto.proposal.actions);
        }

        // Caso 2: Propuesta tradicional aditiva de clases y relaciones
        if (dto.proposal.classes && dto.proposal.classes.length > 0) {
          this.assertNoConflicts(diagram, dto.proposal);

          const baseY = diagram.classes.length === 0 ? GRID_MARGIN : Math.max(...diagram.classes.map(item => item.y)) + GRID_Y;
          const classIds = new Map<string, string>();
          let attributeCount = 0;
          let methodCount = 0;
          for (const [index, proposed] of dto.proposal.classes.entries()) {
            const created = await transaction.umlClass.create({
              data: {
                diagramId: diagram.id,
                name: proposed.name.trim(),
                isAbstract: proposed.isAbstract ?? false,
                x: GRID_MARGIN + (index % GRID_COLUMNS) * GRID_X,
                y: baseY + Math.floor(index / GRID_COLUMNS) * GRID_Y,
                attributes: {
                  create: proposed.attributes.map((attribute, position) => ({
                    ...attribute,
                    name: attribute.name.trim(),
                    type: attribute.type.trim(),
                    visibility: attribute.visibility ?? UmlVisibility.PRIVATE,
                    isPrimaryKey: attribute.isPrimaryKey ?? false,
                    position,
                  })),
                },
                methods: {
                  create: proposed.methods.map((method, position) => ({
                    ...method,
                    name: method.name.trim(),
                    returnType: method.returnType.trim(),
                    visibility: method.visibility ?? UmlVisibility.PUBLIC,
                    position,
                  })),
                },
              },
              select: { id: true },
            });
            classIds.set(this.key(proposed.name), created.id);
            attributeCount += proposed.attributes.length;
            methodCount += proposed.methods.length;
          }

          if (dto.proposal.relations) {
            for (const relation of dto.proposal.relations) {
              const sourceId = classIds.get(this.key(relation.sourceClassName));
              const targetId = classIds.get(this.key(relation.targetClassName));
              const associationClassId = relation.associationClassName ? classIds.get(this.key(relation.associationClassName)) : undefined;
              if (!sourceId || !targetId) {
                throw new BadRequestException('La propuesta contiene relaciones con clases inexistentes');
              }
              if (relation.associationClassName && !associationClassId) throw new BadRequestException('La clase de asociación no existe');
              await transaction.umlRelation.create({
                data: {
                  diagramId: diagram.id,
                  sourceClassId: sourceId,
                  targetClassId: targetId,
                  associationClassId,
                  type: relation.type,
                  sourceMultiplicity: relation.sourceMultiplicity ?? '1',
                  targetMultiplicity: relation.targetMultiplicity ?? '1',
                  label: relation.label?.trim() || null,
                },
              });
            }
          }
          return {
            classes: dto.proposal.classes.length,
            attributes: attributeCount,
            methods: methodCount,
            relations: dto.proposal.relations?.length ?? 0,
          };
        }

        return { classes: 0, attributes: 0, methods: 0, relations: 0 };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw new ConflictException('La propuesta entra en conflicto con el diagrama actual');
      }
      throw error;
    }

    const diagram = await this.diagrams.getByProject(projectId, userId);
    this.collaboration.publish(projectId, 'uml:diagram:updated', diagram, userId);
    return { created: counts, diagram };
  }

  private async applyActions(
    tx: Prisma.TransactionClient,
    diagram: any,
    actions: AiUmlActionDto[],
  ) {
    let classCount = 0;
    let attributeCount = 0;
    let methodCount = 0;
    let relationCount = 0;

    // Obtener estado fresco de clases y relaciones
    let currentClasses = await tx.umlClass.findMany({
      where: { diagramId: diagram.id },
      include: {
        attributes: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        methods: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      },
    });

    let currentRelations = await tx.umlRelation.findMany({
      where: { diagramId: diagram.id },
    });

    const findClass = (id?: string, name?: string) => {
      if (id) {
        const found = currentClasses.find(c => c.id === id);
        if (found) return found;
      }
      if (name) {
        const keyName = this.key(name);
        return currentClasses.find(c => this.key(c.name) === keyName);
      }
      return undefined;
    };

    for (const [index, action] of actions.entries()) {
      switch (action.action) {
        case AiActionType.ADD_CLASS: {
          const className = (action.className || '').trim();
          if (!className) throw new BadRequestException('El nombre de la clase es obligatorio');
          if (findClass(undefined, className)) {
            throw new ConflictException(`La clase '${className}' ya existe`);
          }

          const baseY = currentClasses.length === 0 ? GRID_MARGIN : Math.max(...currentClasses.map(item => item.y)) + GRID_Y;
          const initialAttributes = action.attributes || (action.attribute ? [action.attribute] : []);
          const initialMethods = action.methods || (action.method ? [action.method] : []);

          const created = await tx.umlClass.create({
            data: {
              diagramId: diagram.id,
              name: className,
              isAbstract: action.isAbstract ?? false,
              x: GRID_MARGIN + ((currentClasses.length + index) % GRID_COLUMNS) * GRID_X,
              y: baseY,
              attributes: {
                create: initialAttributes.map((attr, pos) => ({
                  name: attr.name.trim(),
                  type: attr.type.trim(),
                  visibility: attr.visibility ?? UmlVisibility.PRIVATE,
                  isPrimaryKey: attr.isPrimaryKey ?? false,
                  position: pos,
                })),
              },
              methods: {
                create: initialMethods.map((meth, pos) => ({
                  name: meth.name.trim(),
                  returnType: meth.returnType.trim(),
                  visibility: meth.visibility ?? UmlVisibility.PUBLIC,
                  position: pos,
                })),
              },
            },
            include: { attributes: true, methods: true },
          });
          currentClasses.push(created);
          classCount++;
          attributeCount += initialAttributes.length;
          methodCount += initialMethods.length;
          break;
        }

        case AiActionType.UPDATE_CLASS: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente`);
          }
          const newName = (action.className || '').trim();
          if (newName && this.key(newName) !== this.key(target.name)) {
            const conflict = findClass(undefined, newName);
            if (conflict && conflict.id !== target.id) {
              throw new ConflictException(`Ya existe una clase con el nombre '${newName}'`);
            }
          }

          const updated = await tx.umlClass.update({
            where: { id: target.id },
            data: {
              name: newName || target.name,
              isAbstract: action.isAbstract ?? target.isAbstract,
            },
            include: { attributes: true, methods: true },
          });
          currentClasses = currentClasses.map(c => (c.id === target.id ? updated : c));
          classCount++;
          break;
        }

        case AiActionType.DELETE_CLASS: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente`);
          }
          await tx.umlRelation.deleteMany({
            where: { OR: [{ sourceClassId: target.id }, { targetClassId: target.id }] },
          });
          await tx.umlClass.delete({ where: { id: target.id } });
          currentClasses = currentClasses.filter(c => c.id !== target.id);
          currentRelations = currentRelations.filter(r => r.sourceClassId !== target.id && r.targetClassId !== target.id);
          classCount++;
          break;
        }

        case AiActionType.ADD_ATTRIBUTE: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente para agregar atributo`);
          }
          const attrName = (action.attributeName || action.attribute?.name || '').trim();
          const attrType = (action.attributeType || action.attribute?.type || 'String').trim();
          if (!attrName) throw new BadRequestException('El nombre del atributo es obligatorio');

          if (target.attributes.some(a => this.key(a.name) === this.key(attrName))) {
            throw new BadRequestException(`La clase '${target.name}' ya contiene el atributo '${attrName}'`);
          }

          const nextPos = target.attributes.length > 0 ? Math.max(...target.attributes.map(a => a.position)) + 1 : 0;
          const created = await tx.umlAttribute.create({
            data: {
              umlClassId: target.id,
              name: attrName,
              type: attrType,
              visibility: action.attributeVisibility || action.attribute?.visibility || UmlVisibility.PRIVATE,
              isPrimaryKey: action.isPrimaryKey ?? action.attribute?.isPrimaryKey ?? false,
              position: nextPos,
            },
          });
          target.attributes.push(created);
          attributeCount++;
          break;
        }

        case AiActionType.UPDATE_ATTRIBUTE: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente`);
          }
          const attr = action.attributeId
            ? target.attributes.find(a => a.id === action.attributeId)
            : target.attributes.find(a => this.key(a.name) === this.key(action.attributeName || ''));
          if (!attr) {
            throw new NotFoundException(`Atributo '${action.attributeName || action.attributeId}' inexistente en clase '${target.name}'`);
          }

          const newName = (action.attributeName || '').trim();
          if (newName && this.key(newName) !== this.key(attr.name)) {
            if (target.attributes.some(a => a.id !== attr.id && this.key(a.name) === this.key(newName))) {
              throw new BadRequestException(`Ya existe un atributo con el nombre '${newName}' en la clase '${target.name}'`);
            }
          }

          const updated = await tx.umlAttribute.update({
            where: { id: attr.id },
            data: {
              name: newName || attr.name,
              type: (action.attributeType || action.attribute?.type || attr.type).trim(),
              visibility: action.attributeVisibility || action.attribute?.visibility || attr.visibility,
              isPrimaryKey: action.isPrimaryKey ?? action.attribute?.isPrimaryKey ?? attr.isPrimaryKey,
            },
          });
          target.attributes = target.attributes.map(a => (a.id === attr.id ? updated : a));
          attributeCount++;
          break;
        }

        case AiActionType.DELETE_ATTRIBUTE: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente`);
          }
          const attr = action.attributeId
            ? target.attributes.find(a => a.id === action.attributeId)
            : target.attributes.find(a => this.key(a.name) === this.key(action.attributeName || ''));
          if (!attr) {
            throw new NotFoundException(`Atributo '${action.attributeName || action.attributeId}' inexistente`);
          }
          await tx.umlAttribute.delete({ where: { id: attr.id } });
          target.attributes = target.attributes.filter(a => a.id !== attr.id);
          attributeCount++;
          break;
        }

        case AiActionType.ADD_METHOD: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente para agregar método`);
          }
          const methName = (action.methodName || action.method?.name || '').trim();
          const methRet = (action.methodReturnType || action.method?.returnType || 'void').trim();
          if (!methName) throw new BadRequestException('El nombre del método es obligatorio');

          if (target.methods.some(m => this.key(m.name) === this.key(methName))) {
            throw new BadRequestException(`La clase '${target.name}' ya contiene el método '${methName}'`);
          }

          const nextPos = target.methods.length > 0 ? Math.max(...target.methods.map(m => m.position)) + 1 : 0;
          const created = await tx.umlMethod.create({
            data: {
              umlClassId: target.id,
              name: methName,
              returnType: methRet,
              visibility: action.methodVisibility || action.method?.visibility || UmlVisibility.PUBLIC,
              position: nextPos,
            },
          });
          target.methods.push(created);
          methodCount++;
          break;
        }

        case AiActionType.UPDATE_METHOD: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente`);
          }
          const meth = action.methodId
            ? target.methods.find(m => m.id === action.methodId)
            : target.methods.find(m => this.key(m.name) === this.key(action.methodName || ''));
          if (!meth) {
            throw new NotFoundException(`Método '${action.methodName || action.methodId}' inexistente en clase '${target.name}'`);
          }

          const newName = (action.methodName || '').trim();
          if (newName && this.key(newName) !== this.key(meth.name)) {
            if (target.methods.some(m => m.id !== meth.id && this.key(m.name) === this.key(newName))) {
              throw new BadRequestException(`Ya existe un método con el nombre '${newName}' en la clase '${target.name}'`);
            }
          }

          const updated = await tx.umlMethod.update({
            where: { id: meth.id },
            data: {
              name: newName || meth.name,
              returnType: (action.methodReturnType || action.method?.returnType || meth.returnType).trim(),
              visibility: action.methodVisibility || action.method?.visibility || meth.visibility,
            },
          });
          target.methods = target.methods.map(m => (m.id === meth.id ? updated : m));
          methodCount++;
          break;
        }

        case AiActionType.DELETE_METHOD: {
          const target = findClass(action.classId, action.className);
          if (!target) {
            throw new NotFoundException(`Clase '${action.className || action.classId}' inexistente`);
          }
          const meth = action.methodId
            ? target.methods.find(m => m.id === action.methodId)
            : target.methods.find(m => this.key(m.name) === this.key(action.methodName || ''));
          if (!meth) {
            throw new NotFoundException(`Método '${action.methodName || action.methodId}' inexistente`);
          }
          await tx.umlMethod.delete({ where: { id: meth.id } });
          target.methods = target.methods.filter(m => m.id !== meth.id);
          methodCount++;
          break;
        }

        case AiActionType.ADD_RELATION: {
          const source = findClass(action.sourceClassId, action.sourceClassName);
          const target = findClass(action.targetClassId, action.targetClassName);
          const associationClass = action.associationClassId || action.associationClassName
            ? findClass(action.associationClassId, action.associationClassName)
            : undefined;
          if (!source || !target) {
            throw new BadRequestException('Clases de origen o destino inexistentes para la relación');
          }
          if ((action.associationClassId || action.associationClassName) && !associationClass) throw new BadRequestException('Clase de asociación inexistente');
          const relType = action.relationType || UmlRelationType.ASSOCIATION;

          const created = await tx.umlRelation.create({
            data: {
              diagramId: diagram.id,
              sourceClassId: source.id,
              targetClassId: target.id,
              associationClassId: associationClass?.id,
              type: relType,
              sourceMultiplicity: action.sourceMultiplicity || '1',
              targetMultiplicity: action.targetMultiplicity || '1',
              label: action.label?.trim() || null,
            },
          });
          currentRelations.push(created);
          relationCount++;
          break;
        }

        case AiActionType.UPDATE_RELATION: {
          let rel: any;
          if (action.relationId) {
            rel = currentRelations.find(r => r.id === action.relationId);
          } else {
            const source = findClass(action.sourceClassId, action.sourceClassName);
            const target = findClass(action.targetClassId, action.targetClassName);
            if (source && target) {
              rel = currentRelations.find(r => 
                (r.sourceClassId === source.id && r.targetClassId === target.id) ||
                (r.sourceClassId === target.id && r.targetClassId === source.id)
              );
            }
          }
          if (!rel) {
            throw new NotFoundException('Relación inexistente para actualizar');
          }

          const updated = await tx.umlRelation.update({
            where: { id: rel.id },
            data: {
              type: action.relationType || rel.type,
              sourceMultiplicity: action.sourceMultiplicity || rel.sourceMultiplicity,
              targetMultiplicity: action.targetMultiplicity || rel.targetMultiplicity,
              label: action.label !== undefined ? action.label?.trim() || null : rel.label,
            },
          });
          currentRelations = currentRelations.map(r => (r.id === rel.id ? updated : r));
          relationCount++;
          break;
        }

        case AiActionType.DELETE_RELATION: {
          let rel: any;
          if (action.relationId) {
            rel = currentRelations.find(r => r.id === action.relationId);
          } else {
            const source = findClass(action.sourceClassId, action.sourceClassName);
            const target = findClass(action.targetClassId, action.targetClassName);
            if (source && target) {
              rel = currentRelations.find(r => 
                (r.sourceClassId === source.id && r.targetClassId === target.id) ||
                (r.sourceClassId === target.id && r.targetClassId === source.id)
              );
            }
          }
          if (!rel) {
            throw new NotFoundException('Relación inexistente para eliminar');
          }
          await tx.umlRelation.delete({ where: { id: rel.id } });
          currentRelations = currentRelations.filter(r => r.id !== rel.id);
          relationCount++;
          break;
        }
      }
    }

    return {
      classes: classCount,
      attributes: attributeCount,
      methods: methodCount,
      relations: relationCount,
    };
  }

  private assertNoConflicts(diagram: { classes: Array<{ name: string }> }, proposal: ApplyUmlProposalDto['proposal']) {
    const existing = new Set(diagram.classes.map(item => this.key(item.name)));
    if (proposal.classes?.some(item => existing.has(this.key(item.name)))) {
      throw new ConflictException('La propuesta entra en conflicto con el diagrama actual');
    }
  }

  private key(value: string) {
    return value.trim().toLocaleLowerCase();
  }
}
