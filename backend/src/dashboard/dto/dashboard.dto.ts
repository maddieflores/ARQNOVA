export interface DashboardUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface DashboardStatsDto {
  projects: number;
  classes: number;
  users: number;
  pendingInvitations: number;
}

export interface RecentProjectDto {
  id: string;
  name: string;
  description: string | null;
  classesCount: number;
  membersCount: number;
  isOwner: boolean;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecentActivityDto {
  id: string;
  type: 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'CLASS_CREATED' | 'CLASS_UPDATED' | 'MEMBER_JOINED' | 'INVITATION_ACCEPTED';
  userInitials: string;
  userName: string;
  description: string;
  projectName: string;
  projectId?: string;
  timestamp: string;
}

export interface SystemStatusDto {
  backend: 'Operativo' | 'Degradado' | 'Inactivo';
  database: 'Operativo' | 'Inactivo';
  realtime: 'Operativo' | 'Inactivo';
  aiService: 'Operativo' | 'Inactivo';
  codeGenerator: 'Operativo' | 'Inactivo';
}

export interface DashboardResponseDto {
  user: DashboardUserDto;
  stats: DashboardStatsDto;
  recentProjects: RecentProjectDto[];
  recentActivity: RecentActivityDto[];
  systemStatus: SystemStatusDto;
}
