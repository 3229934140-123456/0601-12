import { Project, MemberRole } from '../types';
import { store } from '../store';

export const SUPPORTED_EXPORT_FORMATS = ['png', 'jpg', 'svg', 'pdf', 'source'];
export const SUPPORTED_UNITS = ['px', 'mm', 'in'];

export function isProjectMember(projectId: string, userId: string): boolean {
  const project = store.projects.get(projectId);
  if (!project) return false;
  return project.members.some(m => m.userId === userId);
}

export function getMemberRole(projectId: string, userId: string): MemberRole | null {
  const project = store.projects.get(projectId);
  if (!project) return null;
  const member = project.members.find(m => m.userId === userId);
  return member ? member.role : null;
}

export function canView(project: Project, userId: string): boolean {
  return project.members.some(m => m.userId === userId);
}

export function canEdit(project: Project, userId: string): boolean {
  const member = project.members.find(m => m.userId === userId);
  return !!member && (member.role === 'owner' || member.role === 'editor');
}

export function isOwner(project: Project, userId: string): boolean {
  const member = project.members.find(m => m.userId === userId);
  return !!member && member.role === 'owner';
}

export function canExportSource(project: Project, userId: string): boolean {
  return canEdit(project, userId);
}

export function isValidPageSize(width: any, height: any, unit: any): { valid: boolean; message?: string } {
  if (width === undefined || width === null || width === '') {
    return { valid: false, message: '宽度不能为空' };
  }
  if (height === undefined || height === null || height === '') {
    return { valid: false, message: '高度不能为空' };
  }
  const w = Number(width);
  const h = Number(height);
  if (isNaN(w) || w <= 0) {
    return { valid: false, message: '宽度必须是大于 0 的数字' };
  }
  if (isNaN(h) || h <= 0) {
    return { valid: false, message: '高度必须是大于 0 的数字' };
  }
  if (unit && !SUPPORTED_UNITS.includes(unit)) {
    return { valid: false, message: `单位不支持，仅支持 ${SUPPORTED_UNITS.join('、')}` };
  }
  return { valid: true };
}

export function isValidExportFormat(format: string): { valid: boolean; message?: string } {
  if (!format) {
    return { valid: false, message: '导出格式不能为空' };
  }
  if (!SUPPORTED_EXPORT_FORMATS.includes(format)) {
    return { valid: false, message: `不支持的导出格式，仅支持 ${SUPPORTED_EXPORT_FORMATS.join('、')}` };
  }
  return { valid: true };
}

export function isValidCommentContent(content: string): { valid: boolean; message?: string } {
  if (content === undefined || content === null) {
    return { valid: false, message: '评论内容不能为空' };
  }
  if (typeof content !== 'string') {
    return { valid: false, message: '评论内容必须是字符串' };
  }
  if (content.trim() === '') {
    return { valid: false, message: '评论内容不能为空字符串' };
  }
  return { valid: true };
}
