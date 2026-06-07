import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, paginate, getCurrentUserId } from '../utils/response';
import { canView, canEdit, isOwner, isValidPageSize } from '../utils/permission';
import { Project, PageSize, MemberRole, Activity, ProjectMember } from '../types';

export const getProjects = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const keyword = (req.query.keyword as string) || '';
  const status = req.query.status as string;

  let projects = Array.from(store.projects.values()).filter(p =>
    p.members.some(m => m.userId === userId)
  );

  if (keyword) {
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  if (status) {
    projects = projects.filter(p => p.status === status);
  }

  projects.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  success(res, paginate(projects, page, pageSize));
};

export const getProject = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);
  const project = store.projects.get(id);

  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限访问该项目', 403);
  }

  success(res, project);
};

export const createProject = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { name, description, pageSize, thumbnail } = req.body;

  if (!name) {
    return fail(res, '项目名称不能为空');
  }

  const now = new Date().toISOString();
  const projectId = store.generateId('proj');

  const defaultPageSize: PageSize = pageSize || {
    width: 1080,
    height: 1920,
    unit: 'px',
    name: '手机竖版'
  };

  const project: Project = {
    id: projectId,
    name,
    description: description || '',
    thumbnail: thumbnail || '',
    pageSize: defaultPageSize,
    creatorId: userId,
    members: [{ userId, role: 'owner', joinedAt: now }],
    createdAt: now,
    updatedAt: now,
    currentVersion: 0,
    status: 'draft'
  };

  store.projects.set(projectId, project);
  store.canvases.set(projectId, []);
  store.comments.set(projectId, []);
  store.reviews.set(projectId, []);

  recordActivity(userId, projectId, 'create_project', `创建了项目「${name}」`);

  success(res, project, '创建成功');
};

export const updateProject = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);
  const { name, description, thumbnail, pageSize, status } = req.body;

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (thumbnail !== undefined) project.thumbnail = thumbnail;
  if (pageSize !== undefined) project.pageSize = pageSize;
  if (status !== undefined) project.status = status;

  project.updatedAt = new Date().toISOString();

  success(res, project, '更新成功');
};

export const updatePageSize = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);
  const { width, height, unit, name } = req.body;

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const validation = isValidPageSize(width, height, unit);
  if (!validation.valid) {
    return fail(res, validation.message || '页面尺寸参数无效', 400);
  }

  project.pageSize = {
    width: Number(width),
    height: Number(height),
    unit: unit || 'px',
    name
  };
  project.updatedAt = new Date().toISOString();

  success(res, project.pageSize, '页面尺寸已更新');
};

export const deleteProject = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!isOwner(project, userId)) {
    return fail(res, '只有所有者可以删除项目', 403);
  }

  store.projects.delete(id);
  store.canvases.delete(id);
  store.comments.delete(id);
  store.reviews.delete(id);

  success(res, null, '删除成功');
};

export const getMembers = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限查看成员列表', 403);
  }

  const membersWithUserInfo = project.members.map(m => ({
    ...m,
    user: store.users.get(m.userId)
  }));

  success(res, membersWithUserInfo);
};

export const inviteMember = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);
  const { email, role, userId: inviteUserId } = req.body;

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有邀请权限', 403);
  }

  const targetUserId = inviteUserId || store.generateId('user');

  if (project.members.some(m => m.userId === targetUserId)) {
    return fail(res, '该用户已是项目成员');
  }

  const newMember: ProjectMember = {
    userId: targetUserId,
    role: role || 'viewer',
    joinedAt: new Date().toISOString()
  };

  if (!store.users.has(targetUserId)) {
    store.users.set(targetUserId, {
      id: targetUserId,
      name: email ? email.split('@')[0] : '新成员',
      email: email || '',
      createdAt: new Date().toISOString()
    });
  }

  project.members.push(newMember);
  project.updatedAt = new Date().toISOString();

  recordActivity(userId, id, 'add_member', `邀请了成员加入项目`);

  success(res, newMember, '邀请成功');
};

export const updateMemberRole = (req: Request, res: Response) => {
  const { id, userId: memberUserId } = req.params;
  const userId = getCurrentUserId(req);
  const { role } = req.body;

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const currentMember = project.members.find(m => m.userId === userId);
  if (!currentMember || currentMember.role === 'viewer') {
    return fail(res, '没有权限修改成员角色', 403);
  }

  const targetMember = project.members.find(m => m.userId === memberUserId);
  if (!targetMember) {
    return fail(res, '该用户不是项目成员', 404);
  }

  if (targetMember.role === 'owner') {
    return fail(res, '不能修改所有者的角色');
  }

  targetMember.role = role as MemberRole;
  project.updatedAt = new Date().toISOString();

  success(res, targetMember, '角色已更新');
};

export const removeMember = (req: Request, res: Response) => {
  const { id, userId: memberUserId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const currentMember = project.members.find(m => m.userId === userId);
  if (!currentMember || currentMember.role === 'viewer') {
    return fail(res, '没有权限移除成员', 403);
  }

  const targetIndex = project.members.findIndex(m => m.userId === memberUserId);
  if (targetIndex === -1) {
    return fail(res, '该用户不是项目成员', 404);
  }

  if (project.members[targetIndex].role === 'owner') {
    return fail(res, '不能移除项目所有者');
  }

  project.members.splice(targetIndex, 1);
  project.updatedAt = new Date().toISOString();

  success(res, null, '已移除成员');
};

export const getProjectVersions = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(id);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限查看历史版本', 403);
  }

  const canvases = store.canvases.get(id) || [];
  const versions = canvases.map(c => ({
    version: c.version,
    snapshotName: c.snapshotName,
    createdAt: c.createdAt,
    createdBy: c.createdBy,
    creator: store.users.get(c.createdBy),
    layerCount: c.layers.length
  }));

  success(res, versions.sort((a, b) => b.version - a.version));
};

function recordActivity(userId: string, projectId: string, type: Activity['type'], description: string) {
  store.activities.unshift({
    id: store.generateId('act'),
    projectId,
    userId,
    type,
    description,
    createdAt: new Date().toISOString()
  });
}
