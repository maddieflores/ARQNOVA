import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvitationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SystemRole } from '../roles/system-role';
import {
  DashboardResponseDto,
  DashboardStatsDto,
  RecentActivityDto,
  RecentProjectDto,
  SystemStatusDto,
} from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string): Promise<DashboardResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario inexistente');
    }
    if (!user.isActive) {
      throw new ForbiddenException('El usuario no tiene acceso');
    }

    const roleName = user.role.name;
    const isCollaborator = roleName === SystemRole.COLABORADOR;

    // Proyectos accesibles para el usuario
    const projectFilter = isCollaborator
      ? { members: { some: { userId } }, deletedAt: null }
      : {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          deletedAt: null,
        };

    const accessibleProjects = await this.prisma.project.findMany({
      where: projectFilter,
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true } },
        members: { select: { userId: true } },
        diagrams: {
          select: {
            id: true,
            _count: { select: { classes: true } },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

    const accessibleProjectIds = accessibleProjects.map(p => p.id);
    const projectsCount = accessibleProjects.length;

    // Conteo de clases UML en proyectos accesibles
    let classesCount = 0;
    if (accessibleProjectIds.length > 0) {
      classesCount = await this.prisma.umlClass.count({
        where: { diagram: { projectId: { in: accessibleProjectIds } } },
      });
    }

    // Conteo de usuarios únicos involucrados en los proyectos accesibles
    const userIdsSet = new Set<string>();
    for (const p of accessibleProjects) {
      userIdsSet.add(p.ownerId);
      for (const m of p.members) {
        userIdsSet.add(m.userId);
      }
    }
    const usersCount = userIdsSet.size;

    // Conteo de invitaciones pendientes
    const now = new Date();
    const pendingInvitations = await this.prisma.projectInvitation.count({
      where: {
        OR: [
          { invitedUserId: userId },
          ...(isCollaborator ? [] : [{ project: { ownerId: userId, deletedAt: null } }]),
        ],
        status: InvitationStatus.PENDING,
        expiresAt: { gt: now },
      },
    });

    const stats: DashboardStatsDto = {
      projects: projectsCount,
      classes: classesCount,
      users: usersCount,
      pendingInvitations,
    };

    // Proyectos recientes (top 4)
    const recentProjects: RecentProjectDto[] = accessibleProjects.slice(0, 4).map(p => {
      const diagramClasses = p.diagrams.reduce((acc, d) => acc + d._count.classes, 0);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        classesCount: diagramClasses,
        membersCount: p.members.length + 1, // miembros + propietario
        isOwner: p.ownerId === userId,
        ownerName: p.owner.name,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    // Actividad reciente real
    const recentActivity = await this.fetchRecentActivity(userId, accessibleProjectIds);

    // Estado del sistema
    const systemStatus = await this.checkSystemStatus();

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        isActive: user.isActive,
      },
      stats,
      recentProjects,
      recentActivity,
      systemStatus,
    };
  }

  private async fetchRecentActivity(userId: string, accessibleProjectIds: string[]): Promise<RecentActivityDto[]> {
    if (accessibleProjectIds.length === 0) {
      return [];
    }

    const activities: RecentActivityDto[] = [];

    // 1. Proyectos creados o modificados recientemente
    const projects = await this.prisma.project.findMany({
      where: { id: { in: accessibleProjectIds } },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    for (const p of projects) {
      const isNew = Math.abs(p.updatedAt.getTime() - p.createdAt.getTime()) < 1000;
      activities.push({
        id: `proj-${p.id}-${isNew ? 'created' : 'updated'}`,
        type: isNew ? 'PROJECT_CREATED' : 'PROJECT_UPDATED',
        userInitials: this.getInitials(p.owner.name),
        userName: p.owner.name,
        description: isNew
          ? `creó el proyecto`
          : `actualizó el proyecto`,
        projectName: p.name,
        projectId: p.id,
        timestamp: (isNew ? p.createdAt : p.updatedAt).toISOString(),
      });
    }

    // 2. Miembros que se unieron a proyectos
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: { in: accessibleProjectIds } },
      select: {
        id: true,
        joinedAt: true,
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'desc' },
      take: 5,
    });

    for (const m of members) {
      activities.push({
        id: `member-${m.id}`,
        type: 'MEMBER_JOINED',
        userInitials: this.getInitials(m.user.name),
        userName: m.user.name,
        description: `se unió al proyecto`,
        projectName: m.project.name,
        projectId: m.project.id,
        timestamp: m.joinedAt.toISOString(),
      });
    }

    // 3. Clases UML creadas/modificadas
    const classes = await this.prisma.umlClass.findMany({
      where: { diagram: { projectId: { in: accessibleProjectIds } } },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        diagram: {
          select: {
            project: { select: { id: true, name: true, owner: { select: { name: true } } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    for (const c of classes) {
      const isNew = Math.abs(c.updatedAt.getTime() - c.createdAt.getTime()) < 1000;
      activities.push({
        id: `class-${c.id}-${isNew ? 'created' : 'updated'}`,
        type: isNew ? 'CLASS_CREATED' : 'CLASS_UPDATED',
        userInitials: this.getInitials(c.diagram.project.owner.name),
        userName: c.diagram.project.owner.name,
        description: isNew
          ? `agregó la clase ${c.name} en`
          : `modificó la clase ${c.name} en`,
        projectName: c.diagram.project.name,
        projectId: c.diagram.project.id,
        timestamp: (isNew ? c.createdAt : c.updatedAt).toISOString(),
      });
    }

    // Ordenar actividades por fecha descendente y tomar las 6 más recientes
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return activities.slice(0, 6);
  }

  private async checkSystemStatus(): Promise<SystemStatusDto> {
    let databaseStatus: 'Operativo' | 'Inactivo' = 'Inactivo';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'Operativo';
    } catch {
      databaseStatus = 'Inactivo';
    }

    return {
      backend: 'Operativo',
      database: databaseStatus,
      realtime: 'Operativo',
      aiService: 'Operativo',
      codeGenerator: 'Operativo',
    };
  }

  private getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
