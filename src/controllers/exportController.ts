import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, paginate, getCurrentUserId } from '../utils/response';
import { ExportTask, ExportSpec, Project } from '../types';

export const getExportTasks = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const status = req.query.status as string;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  let tasks: ExportTask[] = [];
  store.exportTasks.forEach(task => {
    if (task.projectId === projectId) {
      tasks.push(task);
    }
  });

  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }

  tasks.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  success(res, paginate(tasks, page, pageSize));
};

export const getExportTask = (req: Request, res: Response) => {
  const { taskId } = req.params;

  const task = store.exportTasks.get(taskId);
  if (!task) {
    return fail(res, '导出任务不存在', 404);
  }

  success(res, task);
};

export const createExport = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const spec: ExportSpec = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '没有权限导出', 403);
  }

  if (!spec.format) {
    return fail(res, '请指定导出格式');
  }

  const now = new Date().toISOString();
  const taskId = store.generateId('export');

  const task: ExportTask = {
    id: taskId,
    projectId,
    canvasVersion: project.currentVersion,
    spec,
    status: 'processing',
    createdAt: now,
    createdBy: userId
  };

  store.exportTasks.set(taskId, task);

  simulateExport(taskId, project, spec);

  success(res, { taskId, status: 'processing' }, '导出任务已创建');
};

export const generatePreview = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '没有权限', 403);
  }

  const previewUrl = `/api/projects/${projectId}/preview.png`;

  success(res, {
    url: previewUrl,
    width: project.pageSize.width,
    height: project.pageSize.height,
    version: project.currentVersion
  }, '预览图已生成');
};

export const exportBySpec = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const { format, scale, quality, width, height } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '没有权限导出', 403);
  }

  const exportWidth = width || project.pageSize.width * (scale || 1);
  const exportHeight = height || project.pageSize.height * (scale || 1);

  const now = new Date().toISOString();
  const taskId = store.generateId('export');

  const task: ExportTask = {
    id: taskId,
    projectId,
    canvasVersion: project.currentVersion,
    spec: {
      format: format || 'png',
      scale: scale || 1,
      quality: quality || 90,
      width: exportWidth,
      height: exportHeight
    },
    status: 'processing',
    createdAt: now,
    createdBy: userId
  };

  store.exportTasks.set(taskId, task);
  simulateExport(taskId, project, task.spec);

  recordActivity(userId, projectId, 'export', `导出了项目「${project.name}」`);

  success(res, {
    taskId,
    status: 'processing',
    spec: task.spec
  }, '已按指定规格开始导出');
};

export const exportSource = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有权限导出源文件', 403);
  }

  const now = new Date().toISOString();
  const taskId = store.generateId('export');

  const task: ExportTask = {
    id: taskId,
    projectId,
    canvasVersion: project.currentVersion,
    spec: { format: 'source' },
    status: 'processing',
    createdAt: now,
    createdBy: userId
  };

  store.exportTasks.set(taskId, task);

  setTimeout(() => {
    const t = store.exportTasks.get(taskId);
    if (t) {
      t.status = 'completed';
      t.downloadUrl = `/downloads/${projectId}_source.zip`;
      t.fileSize = 2048000;
      t.completedAt = new Date().toISOString();
    }
  }, 1500);

  success(res, { taskId, status: 'processing' }, '源文件打包中');
};

export const batchExport = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const { specs } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '没有权限导出', 403);
  }

  if (!specs || !Array.isArray(specs) || specs.length === 0) {
    return fail(res, '请指定导出规格列表');
  }

  const taskIds: string[] = [];
  const now = new Date().toISOString();

  specs.forEach((spec: ExportSpec) => {
    const taskId = store.generateId('export');
    const task: ExportTask = {
      id: taskId,
      projectId,
      canvasVersion: project.currentVersion,
      spec,
      status: 'processing',
      createdAt: now,
      createdBy: userId
    };
    store.exportTasks.set(taskId, task);
    taskIds.push(taskId);
    simulateExport(taskId, project, spec);
  });

  success(res, { taskIds, count: taskIds.length }, '批量导出任务已创建');
};

function simulateExport(taskId: string, project: Project, spec: ExportSpec) {
  const delay = spec.format === 'source' ? 2000 : 800;
  setTimeout(() => {
    const task = store.exportTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.downloadUrl = `/downloads/${project.id}_v${task.canvasVersion}.${spec.format}`;
      const scale = spec.scale || 1;
      task.fileSize = Math.round(project.pageSize.width * project.pageSize.height * scale * 0.1);
      task.completedAt = new Date().toISOString();
    }
  }, delay);
}

function canView(project: Project, userId: string): boolean {
  return project.members.some(m => m.userId === userId);
}

function canEdit(project: Project, userId: string): boolean {
  const member = project.members.find(m => m.userId === userId);
  return !!member && (member.role === 'owner' || member.role === 'editor');
}

function recordActivity(userId: string, projectId: string, type: any, description: string) {
  store.activities.unshift({
    id: store.generateId('act'),
    projectId,
    userId,
    type,
    description,
    createdAt: new Date().toISOString()
  });
}
