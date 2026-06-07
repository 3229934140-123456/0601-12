import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, getCurrentUserId } from '../utils/response';
import { canView, canEdit } from '../utils/permission';
import { Canvas, Layer } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const getCurrentCanvas = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限查看画布', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];

  if (!latestCanvas && project.currentVersion === 0) {
    const emptyCanvas: Canvas = {
      id: uuidv4(),
      projectId,
      version: 1,
      layers: [],
      background: '#ffffff',
      createdAt: new Date().toISOString(),
      createdBy: userId
    };
    return success(res, emptyCanvas);
  }

  const sortedLayers = latestCanvas ? [...latestCanvas.layers].sort((a, b) => a.zIndex - b.zIndex) : [];
  success(res, { ...latestCanvas, layers: sortedLayers });
};

export const getCanvasVersion = (req: Request, res: Response) => {
  const { projectId, version } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限查看画布', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const canvas = canvases.find(c => c.version === parseInt(version));

  if (!canvas) {
    return fail(res, '版本不存在', 404);
  }

  const sortedLayers = [...canvas.layers].sort((a, b) => a.zIndex - b.zIndex);
  success(res, { ...canvas, layers: sortedLayers });
};

export const saveCanvas = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const { layers, background, snapshotName } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const newVersion = project.currentVersion + 1;

  const newCanvas: Canvas = {
    id: uuidv4(),
    projectId,
    version: newVersion,
    layers: layers || [],
    background: background || '#ffffff',
    createdAt: new Date().toISOString(),
    createdBy: userId,
    snapshotName: snapshotName || `版本 ${newVersion}`
  };

  canvases.push(newCanvas);
  store.canvases.set(projectId, canvases);

  project.currentVersion = newVersion;
  project.updatedAt = new Date().toISOString();

  recordActivity(userId, projectId, 'update_canvas', `保存了画布第 ${newVersion} 版`);

  success(res, {
    version: newVersion,
    canvas: newCanvas
  }, '保存成功');
};

export const addLayer = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const layerData = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];

  if (!latestCanvas) {
    return fail(res, '画布不存在');
  }

  const newLayer: Layer = {
    id: uuidv4(),
    type: layerData.type || 'rectangle',
    name: layerData.name || `图层 ${latestCanvas.layers.length + 1}`,
    x: layerData.x || 0,
    y: layerData.y || 0,
    width: layerData.width || 100,
    height: layerData.height || 100,
    rotation: layerData.rotation || 0,
    opacity: layerData.opacity !== undefined ? layerData.opacity : 1,
    visible: layerData.visible !== undefined ? layerData.visible : true,
    locked: layerData.locked || false,
    zIndex: latestCanvas.layers.length,
    props: layerData.props || {},
    children: layerData.children
  };

  latestCanvas.layers.push(newLayer);
  project.updatedAt = new Date().toISOString();

  success(res, newLayer, '图层已添加');
};

export const updateLayer = (req: Request, res: Response) => {
  const { projectId, layerId } = req.params;
  const userId = getCurrentUserId(req);
  const updates = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];

  if (!latestCanvas) {
    return fail(res, '画布不存在');
  }

  const layer = findLayerById(latestCanvas.layers, layerId);
  if (!layer) {
    return fail(res, '图层不存在', 404);
  }

  Object.assign(layer, updates);
  project.updatedAt = new Date().toISOString();

  success(res, layer, '图层已更新');
};

export const deleteLayer = (req: Request, res: Response) => {
  const { projectId, layerId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];

  if (!latestCanvas) {
    return fail(res, '画布不存在');
  }

  const index = findLayerIndexById(latestCanvas.layers, layerId);
  if (index === -1) {
    return fail(res, '图层不存在', 404);
  }

  latestCanvas.layers.splice(index, 1);
  project.updatedAt = new Date().toISOString();

  success(res, null, '图层已删除');
};

export const reorderLayers = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const { layerIds } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  if (!layerIds || !Array.isArray(layerIds) || layerIds.length === 0) {
    return fail(res, '请提供图层 ID 顺序数组');
  }

  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];

  if (!latestCanvas) {
    return fail(res, '画布不存在');
  }

  const layerMap = new Map<string, Layer>();
  latestCanvas.layers.forEach(layer => {
    layerMap.set(layer.id, layer);
  });

  const reorderedLayers: Layer[] = [];

  layerIds.forEach((id: string, index: number) => {
    const layer = layerMap.get(id);
    if (layer) {
      layer.zIndex = index;
      reorderedLayers.push(layer);
      layerMap.delete(id);
    }
  });

  layerMap.forEach(layer => {
    layer.zIndex = reorderedLayers.length;
    reorderedLayers.push(layer);
  });

  latestCanvas.layers = reorderedLayers;
  project.updatedAt = new Date().toISOString();

  const sortedLayers = [...reorderedLayers].sort((a, b) => a.zIndex - b.zIndex);
  success(res, sortedLayers, '图层层级已更新');
};

export const duplicateLayer = (req: Request, res: Response) => {
  const { projectId, layerId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];

  if (!latestCanvas) {
    return fail(res, '画布不存在');
  }

  const layer = findLayerById(latestCanvas.layers, layerId);
  if (!layer) {
    return fail(res, '图层不存在', 404);
  }

  const duplicated = JSON.parse(JSON.stringify(layer));
  duplicated.id = uuidv4();
  duplicated.name = `${layer.name} 副本`;
  duplicated.x = layer.x + 20;
  duplicated.y = layer.y + 20;
  duplicated.zIndex = latestCanvas.layers.length;

  latestCanvas.layers.push(duplicated);
  project.updatedAt = new Date().toISOString();

  success(res, duplicated, '图层已复制');
};

export const createSnapshot = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const { name } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const latestCanvas = canvases[canvases.length - 1];

  if (!latestCanvas) {
    return fail(res, '画布不存在');
  }

  const newVersion = project.currentVersion + 1;
  const snapshot: Canvas = {
    ...JSON.parse(JSON.stringify(latestCanvas)),
    id: uuidv4(),
    version: newVersion,
    snapshotName: name || `快照 ${newVersion}`,
    createdAt: new Date().toISOString(),
    createdBy: userId
  };

  canvases.push(snapshot);
  store.canvases.set(projectId, canvases);
  project.currentVersion = newVersion;
  project.updatedAt = new Date().toISOString();

  success(res, snapshot, '快照已创建');
};

export const restoreVersion = (req: Request, res: Response) => {
  const { projectId, version } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有编辑权限', 403);
  }

  const canvases = store.canvases.get(projectId) || [];
  const targetCanvas = canvases.find(c => c.version === parseInt(version));

  if (!targetCanvas) {
    return fail(res, '版本不存在', 404);
  }

  const newVersion = project.currentVersion + 1;
  const restoredCanvas: Canvas = {
    ...JSON.parse(JSON.stringify(targetCanvas)),
    id: uuidv4(),
    version: newVersion,
    snapshotName: `恢复自版本 ${version}`,
    createdAt: new Date().toISOString(),
    createdBy: userId
  };

  canvases.push(restoredCanvas);
  store.canvases.set(projectId, canvases);
  project.currentVersion = newVersion;
  project.updatedAt = new Date().toISOString();

  success(res, restoredCanvas, '版本已恢复');
};

function findLayerById(layers: Layer[], id: string): Layer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.children) {
      const found = findLayerById(layer.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findLayerIndexById(layers: Layer[], id: string): number {
  return layers.findIndex(l => l.id === id);
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
