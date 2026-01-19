
export type TaskStatus = 'ideas' | 'backlog' | 'in_progress' | 'code_review' | 'done' | 'deployed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type VersionStatus = 'planned' | 'in_development' | 'in_stores' | 'deprecated';
export type DocType = 'process' | 'document';

export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  nickname?: string;
  role?: string;
  avatarUrl?: string; // mapped from avatar_url
  createdAt?: string;
}

export interface Project {
  id: string;
  name: string;
  prefix: string;
  color: string;
  createdAt?: string;
}

export interface Version {
  id: string;
  projectId: string;
  name: string;
  status: VersionStatus;
  releaseDate?: string;
  notes?: string;
  ownerId?: string;
  owner?: TeamMember;
  createdAt?: string;
}

export interface Task {
  id: string;
  code: string;
  projectId: string;
  versionId?: string;
  version?: Version;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assignee?: TeamMember;
  createdAt?: string;
  updatedAt?: string;
  images?: string[];
}

export interface Doc {
  id: string;
  title: string;
  type: DocType;
  content?: string;
  flowDiagramJson?: any;
  updatedAt?: string;
  createdAt?: string;
}

export interface Activity {
  id: string;
  userId?: string;
  user?: Profile;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  timestamp?: string;
  createdAt?: string;
  taskCode?: string;
}
