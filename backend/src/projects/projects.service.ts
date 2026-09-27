import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { validateDto } from '../common/validate-dto';
import { PrismaService } from '../prisma/prisma.service';
import { SystemRole } from '../roles/system-role';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PROJECT_SELECT } from './project.select';
import { ListProjectsDto } from './dto/list-projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, input: CreateProjectDto) {
    this.validateId(ownerId, 'propietario');
    const dto = validateDto(CreateProjectDto, input);
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { isActive: true, role: { select: { name: true } } } });
    if (!owner) throw new NotFoundException('Usuario propietario inexistente');
    if (!owner.isActive || owner.role.name !== SystemRole.ANFITRION) throw new ForbiddenException('Solo un anfitrión activo puede ser propietario de un proyecto');
    return this.prisma.project.create({ data: { ...dto, ownerId }, select: PROJECT_SELECT });
  }

  async findById(id: string) {
    this.validateId(id, 'proyecto');
    const project = await this.prisma.project.findFirst({ where: { id, deletedAt: null }, select: PROJECT_SELECT });
    if (!project) throw new NotFoundException('Proyecto inexistente');
    return project;
  }

  listByOwner(userId: string, input: ListProjectsDto = {}) {
    this.validateId(userId, 'usuario');
    const { search } = validateDto(ListProjectsDto, input);
    return this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      select: PROJECT_SELECT,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async getStats(userId: string) {
    this.validateId(userId, 'usuario');
    const accessibleProjects = await this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        deletedAt: null,
      },
      select: {
        id: true,
        ownerId: true,
        members: { select: { userId: true } },
      },
    });

    const accessibleProjectIds = accessibleProjects.map(p => p.id);
    const totalProjects = accessibleProjects.length;

    const collaboratorIds = new Set<string>();
    for (const p of accessibleProjects) {
      for (const m of p.members) {
        if (m.userId !== userId) {
          collaboratorIds.add(m.userId);
        }
      }
    }
    const collaborators = collaboratorIds.size;

    let umlDiagrams = 0;
    if (accessibleProjectIds.length > 0) {
      umlDiagrams = await this.prisma.diagram.count({
        where: { projectId: { in: accessibleProjectIds } },
      });
    }

    return {
      totalProjects,
      collaborators,
      generatedBackends: 0,
      umlDiagrams,
    };
  }

  async verifyOwner(projectId: string, userId: string) {
    this.validateId(userId, 'usuario');
    const project = await this.findById(projectId);
    if (project.ownerId !== userId) throw new ForbiddenException('Solo el propietario puede administrar este proyecto');
    await this.verifyActiveUser(userId);
    return project;
  }

  async validateAccess(projectId: string, userId: string) {
    this.validateId(userId, 'usuario');
    const project = await this.findById(projectId);
    if (project.ownerId === userId) {
      await this.verifyActiveUser(userId);
      return project;
    }
    const membership = await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { user: { select: { isActive: true } } } });
    if (!membership?.user.isActive) throw new ForbiddenException('El usuario no tiene acceso al proyecto');
    return project;
  }

  async update(projectId: string, ownerId: string, input: UpdateProjectDto) {
    const dto = validateDto(UpdateProjectDto, input);
    if (!Object.values(dto).some(value => value !== undefined)) throw new BadRequestException('Indica al menos un campo para actualizar');
    await this.verifyOwner(projectId, ownerId);
    return this.prisma.project.update({ where: { id: projectId }, data: dto, select: PROJECT_SELECT });
  }

  async remove(projectId: string, ownerId: string) {
    await this.verifyOwner(projectId, ownerId);
    return this.prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() }, select: PROJECT_SELECT });
  }

  private validateId(id: string, label: string) {
    if (!isUUID(id, '4')) throw new BadRequestException(`ID de ${label} inválido`);
  }

  private async verifyActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user?.isActive) throw new ForbiddenException('El usuario no tiene acceso al proyecto');
  }
}
