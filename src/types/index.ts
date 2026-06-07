export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface ProjectMember {
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface PageSize {
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'in';
  name?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  pageSize: PageSize;
  creatorId: string;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  status: 'draft' | 'reviewing' | 'approved' | 'archived';
}

export interface Layer {
  id: string;
  type: 'rectangle' | 'text' | 'image' | 'shape' | 'group';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  props: Record<string, any>;
  children?: Layer[];
}

export interface Canvas {
  id: string;
  projectId: string;
  version: number;
  layers: Layer[];
  background?: string;
  createdAt: string;
  createdBy: string;
  snapshotName?: string;
}

export type AssetType = 'image' | 'font' | 'color' | 'template' | 'icon';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  thumbnail?: string;
  tags: string[];
  category?: string;
  uploaderId: string;
  size?: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  category?: string;
}

export interface Font {
  id: string;
  name: string;
  family: string;
  weight: string;
  style: string;
  url?: string;
}

export interface Comment {
  id: string;
  projectId: string;
  canvasVersion?: number;
  authorId: string;
  content: string;
  position?: { x: number; y: number };
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  replies?: Comment[];
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface Review {
  id: string;
  projectId: string;
  canvasVersion: number;
  submitterId: string;
  reviewers: string[];
  status: ReviewStatus;
  feedback?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'source';

export interface ExportSpec {
  format: ExportFormat;
  scale?: number;
  quality?: number;
  width?: number;
  height?: number;
  layers?: string[];
}

export interface ExportTask {
  id: string;
  projectId: string;
  canvasVersion: number;
  spec: ExportSpec;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  fileSize?: number;
  createdAt: string;
  completedAt?: string;
  createdBy: string;
}

export type NotificationType = 'comment' | 'review' | 'export' | 'invite' | 'mention' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  relatedId?: string;
  relatedType?: string;
  createdAt: string;
}

export type ActivityType = 'create_project' | 'update_canvas' | 'add_member' | 'comment' | 'review' | 'export' | 'upload_asset';

export interface Activity {
  id: string;
  projectId?: string;
  userId: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface TeamStats {
  teamId: string;
  period: 'day' | 'week' | 'month';
  totalProjects: number;
  totalEdits: number;
  totalExports: number;
  totalMembers: number;
  activeUsers: number;
  storageUsed: number;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
