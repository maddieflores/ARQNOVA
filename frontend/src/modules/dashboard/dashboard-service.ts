import { requestJson } from '../../services/http';

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface DashboardStats {
  projects: number;
  classes: number;
  users: number;
  pendingInvitations: number;
}

export interface RecentProject {
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

export interface RecentActivity {
  id: string;
  type: 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'CLASS_CREATED' | 'CLASS_UPDATED' | 'MEMBER_JOINED' | 'INVITATION_ACCEPTED';
  userInitials: string;
  userName: string;
  description: string;
  projectName: string;
  projectId?: string;
  timestamp: string;
}

export interface SystemStatus {
  backend: 'Operativo' | 'Degradado' | 'Inactivo';
  database: 'Operativo' | 'Inactivo';
  realtime: 'Operativo' | 'Inactivo';
  aiService: 'Operativo' | 'Inactivo';
  codeGenerator: 'Operativo' | 'Inactivo';
}

export interface DashboardData {
  user: DashboardUser;
  stats: DashboardStats;
  recentProjects: RecentProject[];
  recentActivity: RecentActivity[];
  systemStatus: SystemStatus;
}

export const dashboardService = {
  getDashboard(signal?: AbortSignal): Promise<DashboardData> {
    return requestJson<DashboardData>('/dashboard', { signal });
  },
};
