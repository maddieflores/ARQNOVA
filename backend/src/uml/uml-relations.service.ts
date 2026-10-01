import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { validateDto } from '../common/validate-dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUmlRelationDto, UpdateUmlRelationDto } from './dto/uml-relation.dto';
import { DiagramsService } from './diagrams.service';

@Injectable()
export class UmlRelationsService {
  constructor(private readonly prisma: PrismaService, private readonly diagrams: DiagramsService) {}

  async list(diagramId: string, userId: string) {
    await this.diagrams.verifyAccess(diagramId, userId);
    return this.prisma.umlRelation.findMany({ where: { diagramId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  async create(diagramId: string, userId: string, input: CreateUmlRelationDto) {
    const dto = validateDto(CreateUmlRelationDto, input);
    await this.diagrams.verifyAccess(diagramId, userId);
    await this.verifyEndpoints(diagramId, dto.sourceClassId, dto.targetClassId, dto.associationClassId);
    return this.prisma.umlRelation.create({ data: { ...dto, label: dto.label?.trim(), diagramId } });
  }

  async update(id: string, userId: string, input: UpdateUmlRelationDto, expectedDiagramId?: string) {
    const dto = validateDto(UpdateUmlRelationDto, input);
    if (!Object.values(dto).some(value => value !== undefined)) throw new BadRequestException('Indica al menos un campo para actualizar');
    const relation = await this.find(id);
    if (expectedDiagramId && relation.diagramId !== expectedDiagramId) throw new NotFoundException('Relación UML inexistente');
    await this.diagrams.verifyAccess(relation.diagramId, userId);
    if (dto.associationClassId) await this.verifyEndpoints(relation.diagramId, relation.sourceClassId, relation.targetClassId, dto.associationClassId);
    return this.prisma.umlRelation.update({ where: { id }, data: { ...dto, label: dto.label?.trim() } });
  }

  async remove(id: string, userId: string, expectedDiagramId?: string) {
    const relation = await this.find(id);
    if (expectedDiagramId && relation.diagramId !== expectedDiagramId) throw new NotFoundException('Relación UML inexistente');
    await this.diagrams.verifyAccess(relation.diagramId, userId);
    return this.prisma.umlRelation.delete({ where: { id } });
  }

  private async verifyEndpoints(diagramId: string, sourceClassId: string, targetClassId: string, associationClassId?: string | null) {
    if (associationClassId && (associationClassId === sourceClassId || associationClassId === targetClassId)) {
      throw new BadRequestException('La clase de asociación debe ser distinta de los extremos de la asociación');
    }
    const classes = await this.prisma.umlClass.findMany({
      where: { id: { in: [...new Set([sourceClassId, targetClassId, ...(associationClassId ? [associationClassId] : [])])] } },
      select: { id: true, diagramId: true },
    });
    const source = classes.find(item => item.id === sourceClassId);
    const target = classes.find(item => item.id === targetClassId);
    const associationClass = associationClassId ? classes.find(item => item.id === associationClassId) : undefined;
    if (!source || !target) throw new NotFoundException('Clase de origen o destino inexistente');
    if (source.diagramId !== diagramId || target.diagramId !== diagramId) {
      throw new BadRequestException('Las clases de una relación deben pertenecer al mismo diagrama');
    }
    if (associationClassId && (!associationClass || associationClass.diagramId !== diagramId)) {
      throw new BadRequestException('La clase de asociación debe pertenecer al mismo diagrama');
    }
  }

  private async find(id: string) {
    if (!isUUID(id, '4')) throw new BadRequestException('ID de relación UML inválido');
    const relation = await this.prisma.umlRelation.findUnique({ where: { id } });
    if (!relation) throw new NotFoundException('Relación UML inexistente');
    return relation;
  }
}
