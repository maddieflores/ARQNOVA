import { requestJson } from '../../services/http';

export interface ProjectOwner {
  id: string;
  name: string;
  email: string;
}

export interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
}

export interface ProjectMemberItem {
  id: string;
  userId: string;
  joinedAt: string;
  user: ProjectMemberUser;
}

export interface ProjectDiagramSummary {
  id: string;
  name: string;
  _count?: {
    classes: number;
    relations: number;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: ProjectOwner;
  members?: ProjectMemberItem[];
  diagrams?: ProjectDiagramSummary[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProjectStats {
  totalProjects: number;
  collaborators: number;
  generatedBackends: number;
  umlDiagrams: number;
}

export interface ProjectInput {
  name: string;
  description?: string;
}

export const projectsService = {
  list(search = '', signal?: AbortSignal): Promise<Project[]> {
    return requestJson(`/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`, { signal });
  },
  stats(signal?: AbortSignal): Promise<ProjectStats> {
    return requestJson('/projects/stats', { signal });
  },
  get(id: string, signal?: AbortSignal): Promise<Project> {
    return requestJson(`/projects/${id}`, { signal });
  },
  create(input: ProjectInput): Promise<Project> {
    return requestJson('/projects', { method: 'POST', body: input });
  },
  update(id: string, input: ProjectInput): Promise<Project> {
    return requestJson(`/projects/${id}`, { method: 'PATCH', body: input });
  },
  remove(id: string): Promise<Project> {
    return requestJson(`/projects/${id}`, { method: 'DELETE' });
  },
};
