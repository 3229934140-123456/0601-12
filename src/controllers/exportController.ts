import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, paginate, getCurrentUserId } from '../utils/response';
import { canView, canEdit, isValidExportFormat, canExportSource } from '../utils/permission';
import { ExportTask, ExportSpec } from '../types';

export const getExportTasks = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const status = req.query.status as string;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限查看导出任务', 403);
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

  const previewUrl = `/api/export/${projectId}/preview.png`;
  const now = new Date().toISOString();

  success(res, {
    url: previewUrl,
    width: project.pageSize.width,
    height: project.pageSize.height,
    version: project.currentVersion,
    projectName: project.name,
    createdAt: now,
    format: 'png'
  }, '预览图已生成');
};

export const getPreviewImage = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return res.status(404).send('Project not found');
  }

  if (!canView(project, userId)) {
    return res.status(403).send('Forbidden');
  }

  const { width, height } = project.pageSize;
  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];
  const layers = latestCanvas ? latestCanvas.layers : [];

  const svgContent = generateSvgPreview(width, height, layers, project.name);

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Project-Version', String(project.currentVersion));
  res.setHeader('X-Preview-Width', String(width));
  res.setHeader('X-Preview-Height', String(height));
  res.setHeader('X-Created-At', new Date().toISOString());
  res.send(svgContent);
};

function generateSvgPreview(width: number, height: number, layers: any[], projectName: string): string {
  const layerShapes = layers
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(layer => {
      const opacity = layer.opacity !== undefined ? layer.opacity : 1;
      if (layer.type === 'rectangle' || layer.type === 'shape') {
        const fill = layer.props?.fill || '#cccccc';
        const rx = layer.props?.borderRadius || 0;
        return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" fill="${fill}" opacity="${opacity}" rx="${rx}" />`;
      }
      if (layer.type === 'text') {
        const fontSize = layer.props?.fontSize || 24;
        const fill = layer.props?.fill || '#333333';
        const fontWeight = layer.props?.fontWeight || 'normal';
        const text = layer.props?.text || layer.name || '';
        return `<text x="${layer.x}" y="${layer.y + fontSize}" font-size="${fontSize}" fill="${fill}" font-weight="${fontWeight}" opacity="${opacity}">${text}</text>`;
      }
      if (layer.type === 'image') {
        return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" fill="#e0e0e0" opacity="${opacity}" />
                <text x="${layer.x + 10}" y="${layer.y + 30}" font-size="14" fill="#999" opacity="${opacity}">[图片]</text>`;
      }
      return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" fill="#dddddd" opacity="${opacity}" />`;
    })
    .join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  ${layerShapes}
  <rect x="10" y="${height - 40}" width="200" height="30" fill="rgba(0,0,0,0.5)" rx="4" />
  <text x="20" y="${height - 20}" font-size="14" fill="#ffffff">${projectName} · v${layers.length > 0 ? 'current' : 'empty'}</text>
</svg>`;
}

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

  const formatValidation = isValidExportFormat(format);
  if (!formatValidation.valid) {
    return fail(res, formatValidation.message || '导出格式无效', 400);
  }

  if (format === 'source') {
    return exportSource(req, res);
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
      format,
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

  recordActivity(userId, projectId, 'export', `导出了项目「${project.name}」为 ${format} 格式`);

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

  if (!canExportSource(project, userId)) {
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
  simulateExport(taskId, project, task.spec);

  success(res, { taskId, status: 'processing' }, '源文件打包中');
};

export const downloadExport = (req: Request, res: Response) => {
  const { taskId } = req.params;
  const userId = getCurrentUserId(req);

  const task = store.exportTasks.get(taskId);
  if (!task) {
    return fail(res, '导出任务不存在', 404);
  }

  const project = store.projects.get(task.projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限下载', 403);
  }

  if (task.status !== 'completed') {
    return fail(res, '导出任务尚未完成', 400);
  }

  const format = task.spec.format;
  const fileName = `${project.name}_v${task.canvasVersion}.${format === 'source' ? 'zip' : format}`;

  if (format === 'png' || format === 'jpg') {
    const svg = generateSvgPreview(
      task.spec.width || project.pageSize.width,
      task.spec.height || project.pageSize.height,
      getCanvasLayers(task.projectId, task.canvasVersion),
      project.name
    );
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Export-Version', String(task.canvasVersion));
    res.setHeader('X-Export-Format', format);
    return res.send(svg);
  }

  if (format === 'svg') {
    const svg = generateSvgPreview(
      task.spec.width || project.pageSize.width,
      task.spec.height || project.pageSize.height,
      getCanvasLayers(task.projectId, task.canvasVersion),
      project.name
    );
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(svg);
  }

  if (format === 'pdf') {
    const content = generatePdfMock(project, task);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(content);
  }

  if (format === 'source') {
    const sourceContent = generateSourcePackage(project, task);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(sourceContent);
  }

  fail(res, '不支持的导出格式', 400);
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

function simulateExport(taskId: string, project: any, spec: ExportSpec) {
  const delay = spec.format === 'source' ? 1500 : 600;
  setTimeout(() => {
    const task = store.exportTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.downloadUrl = `/api/export/download/${taskId}`;
      const scale = spec.scale || 1;
      task.fileSize = Math.round(project.pageSize.width * project.pageSize.height * scale * 0.1);
      task.completedAt = new Date().toISOString();
    }
  }, delay);
}

function getCanvasLayers(projectId: string, version: number): any[] {
  const canvases = store.canvases.get(projectId) || [];
  const canvas = canvases.find(c => c.version === version);
  return canvas ? canvas.layers : [];
}

function generatePdfMock(project: any, task: ExportTask): Buffer {
  const content = `%PDF-1.4
% Mock PDF for ${project.name}
% Version: ${task.canvasVersion}
% Format: ${task.spec.format}
% Size: ${task.spec.width || project.pageSize.width} x ${task.spec.height || project.pageSize.height}

1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${task.spec.width || project.pageSize.width} ${task.spec.height || project.pageSize.height}] >>
endobj

xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000109 00000 n 

trailer
<< /Size 4 /Root 1 0 R >>
startxref
210
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

function generateSourcePackage(project: any, task: ExportTask): Buffer {
  const layers = getCanvasLayers(task.projectId, task.canvasVersion);
  const sourceData = {
    project: {
      id: project.id,
      name: project.name,
      pageSize: project.pageSize,
      version: task.canvasVersion
    },
    canvas: {
      version: task.canvasVersion,
      layers
    },
    exportedAt: new Date().toISOString()
  };
  const content = `Creative Design Source File
==========================
Project: ${project.name}
Version: ${task.canvasVersion}
Layers: ${layers.length}
Exported: ${new Date().toISOString()}

JSON Data:
${JSON.stringify(sourceData, null, 2)}
`;
  return Buffer.from(content, 'utf-8');
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
