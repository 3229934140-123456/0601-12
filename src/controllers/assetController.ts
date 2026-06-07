import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, paginate, getCurrentUserId } from '../utils/response';
import { Asset, ColorPalette, Font } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const getAssets = (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const type = req.query.type as string;
  const keyword = (req.query.keyword as string) || '';
  const category = req.query.category as string;
  const tag = req.query.tag as string;

  let assets = Array.from(store.assets.values());

  if (type) {
    assets = assets.filter(a => a.type === type);
  }

  if (keyword) {
    const kw = keyword.toLowerCase();
    assets = assets.filter(a =>
      a.name.toLowerCase().includes(kw) ||
      a.tags.some(t => t.toLowerCase().includes(kw))
    );
  }

  if (category) {
    assets = assets.filter(a => a.category === category);
  }

  if (tag) {
    assets = assets.filter(a => a.tags.includes(tag));
  }

  assets.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  success(res, paginate(assets, page, pageSize));
};

export const getAsset = (req: Request, res: Response) => {
  const { id } = req.params;
  const asset = store.assets.get(id);

  if (!asset) {
    return fail(res, '素材不存在', 404);
  }

  success(res, asset);
};

export const uploadAsset = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { name, type, tags, category, metadata } = req.body;

  if (!req.file) {
    return fail(res, '请上传文件');
  }

  const assetId = store.generateId('asset');
  const now = new Date().toISOString();

  const asset: Asset = {
    id: assetId,
    name: name || req.file.originalname,
    type: (type as Asset['type']) || 'image',
    url: `/uploads/${req.file.filename}`,
    thumbnail: `/uploads/${req.file.filename}`,
    tags: tags ? JSON.parse(tags) : [],
    category: category,
    uploaderId: userId,
    size: req.file.size,
    metadata: metadata ? JSON.parse(metadata) : {},
    createdAt: now
  };

  store.assets.set(assetId, asset);

  recordActivity(userId, undefined, 'upload_asset', `上传了素材「${asset.name}」`);

  success(res, asset, '上传成功');
};

export const updateAsset = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);
  const { name, tags, category } = req.body;

  const asset = store.assets.get(id);
  if (!asset) {
    return fail(res, '素材不存在', 404);
  }

  if (asset.uploaderId !== userId) {
    return fail(res, '没有权限修改', 403);
  }

  if (name !== undefined) asset.name = name;
  if (tags !== undefined) asset.tags = tags;
  if (category !== undefined) asset.category = category;

  success(res, asset, '更新成功');
};

export const deleteAsset = (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getCurrentUserId(req);

  const asset = store.assets.get(id);
  if (!asset) {
    return fail(res, '素材不存在', 404);
  }

  if (asset.uploaderId !== userId) {
    return fail(res, '没有权限删除', 403);
  }

  store.assets.delete(id);
  success(res, null, '删除成功');
};

export const getColorPalettes = (req: Request, res: Response) => {
  const keyword = (req.query.keyword as string) || '';
  const category = req.query.category as string;

  let palettes = [...store.colorPalettes];

  if (keyword) {
    const kw = keyword.toLowerCase();
    palettes = palettes.filter(p => p.name.toLowerCase().includes(kw));
  }

  if (category) {
    palettes = palettes.filter(p => p.category === category);
  }

  success(res, palettes);
};

export const getFonts = (req: Request, res: Response) => {
  const keyword = (req.query.keyword as string) || '';
  const family = req.query.family as string;

  let fonts = [...store.fonts];

  if (keyword) {
    const kw = keyword.toLowerCase();
    fonts = fonts.filter(f =>
      f.name.toLowerCase().includes(kw) ||
      f.family.toLowerCase().includes(kw)
    );
  }

  if (family) {
    fonts = fonts.filter(f => f.family === family);
  }

  success(res, fonts);
};

export const getAssetCategories = (req: Request, res: Response) => {
  const categories = new Set<string>();
  store.assets.forEach(asset => {
    if (asset.category) {
      categories.add(asset.category);
    }
  });

  success(res, Array.from(categories));
};

export const getAssetTags = (req: Request, res: Response) => {
  const tags = new Set<string>();
  store.assets.forEach(asset => {
    asset.tags.forEach(tag => tags.add(tag));
  });

  success(res, Array.from(tags));
};

function recordActivity(userId: string, projectId: string | undefined, type: any, description: string) {
  store.activities.unshift({
    id: store.generateId('act'),
    projectId,
    userId,
    type,
    description,
    createdAt: new Date().toISOString()
  });
}
