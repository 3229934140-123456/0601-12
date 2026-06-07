import { v4 as uuidv4 } from 'uuid';
import {
  Project, Canvas, Layer, Asset, Comment, Review,
  ExportTask, Notification, Activity, User,
  ColorPalette, Font
} from '../types';

class DataStore {
  private static instance: DataStore;

  users: Map<string, User> = new Map();
  projects: Map<string, Project> = new Map();
  canvases: Map<string, Canvas[]> = new Map();
  assets: Map<string, Asset> = new Map();
  comments: Map<string, Comment[]> = new Map();
  reviews: Map<string, Review[]> = new Map();
  exportTasks: Map<string, ExportTask> = new Map();
  notifications: Map<string, Notification[]> = new Map();
  activities: Activity[] = [];
  colorPalettes: ColorPalette[] = [];
  fonts: Font[] = [];

  private constructor() {
    this.initializeMockData();
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private initializeMockData() {
    const now = new Date().toISOString();

    const mockUser: User = {
      id: 'user-001',
      name: '设计师小明',
      email: 'designer@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=designer',
      createdAt: now
    };
    this.users.set(mockUser.id, mockUser);

    const mockUser2: User = {
      id: 'user-002',
      name: '产品经理小红',
      email: 'pm@example.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pm',
      createdAt: now
    };
    this.users.set(mockUser2.id, mockUser2);

    const mockProject: Project = {
      id: 'proj-001',
      name: '品牌宣传海报',
      description: '2024年春季新品发布宣传海报设计',
      thumbnail: '',
      pageSize: { width: 1080, height: 1920, unit: 'px', name: '手机竖版' },
      creatorId: mockUser.id,
      members: [
        { userId: mockUser.id, role: 'owner', joinedAt: now },
        { userId: mockUser2.id, role: 'editor', joinedAt: now }
      ],
      createdAt: now,
      updatedAt: now,
      currentVersion: 1,
      status: 'draft'
    };
    this.projects.set(mockProject.id, mockProject);

    const initialCanvas: Canvas = {
      id: uuidv4(),
      projectId: mockProject.id,
      version: 1,
      layers: [
        {
          id: 'layer-bg',
          type: 'rectangle',
          name: '背景',
          x: 0, y: 0,
          width: 1080, height: 1920,
          rotation: 0, opacity: 1,
          visible: true, locked: false,
          zIndex: 0,
          props: { fill: '#f5f5f5', borderRadius: 0 }
        },
        {
          id: 'layer-title',
          type: 'text',
          name: '主标题',
          x: 100, y: 300,
          width: 880, height: 120,
          rotation: 0, opacity: 1,
          visible: true, locked: false,
          zIndex: 1,
          props: {
            text: '春季新品发布',
            fontSize: 72,
            fontWeight: 'bold',
            fill: '#333333',
            fontFamily: 'PingFang SC'
          }
        }
      ],
      background: '#ffffff',
      createdAt: now,
      createdBy: mockUser.id,
      snapshotName: '初始版本'
    };
    this.canvases.set(mockProject.id, [initialCanvas]);

    const mockAssets: Asset[] = [
      {
        id: 'asset-001',
        name: '品牌Logo',
        type: 'image',
        url: '/uploads/logo.png',
        thumbnail: '/uploads/logo_thumb.png',
        tags: ['logo', 'brand', '官方'],
        category: '品牌素材',
        uploaderId: mockUser.id,
        size: 245000,
        createdAt: now
      },
      {
        id: 'asset-002',
        name: '产品主图',
        type: 'image',
        url: '/uploads/product1.jpg',
        thumbnail: '/uploads/product1_thumb.jpg',
        tags: ['product', '春季'],
        category: '产品图片',
        uploaderId: mockUser.id,
        size: 1200000,
        createdAt: now
      }
    ];
    mockAssets.forEach(a => this.assets.set(a.id, a));

    this.colorPalettes = [
      { id: 'palette-001', name: '品牌主色', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'], category: '官方' },
      { id: 'palette-002', name: '莫兰迪色系', colors: ['#B5B9A6', '#C7B8A0', '#A8B5A0', '#D4C5B0', '#B8A89C'], category: '流行色' },
      { id: 'palette-003', name: '活力橙', colors: ['#FF8C00', '#FFA500', '#FFB733', '#FFD27F', '#FFE4B5'], category: '暖色' }
    ];

    this.fonts = [
      { id: 'font-001', name: '苹方', family: 'PingFang SC', weight: '400', style: 'normal' },
      { id: 'font-002', name: '苹方粗体', family: 'PingFang SC', weight: '700', style: 'normal' },
      { id: 'font-003', name: '思源黑体', family: 'Source Han Sans', weight: '400', style: 'normal' },
      { id: 'font-004', name: '思源宋体', family: 'Source Han Serif', weight: '400', style: 'normal' },
      { id: 'font-005', name: 'Helvetica', family: 'Helvetica', weight: '400', style: 'normal' }
    ];

    this.comments.set(mockProject.id, [
      {
        id: 'comment-001',
        projectId: mockProject.id,
        canvasVersion: 1,
        authorId: mockUser2.id,
        content: '主标题的字体可以再大一些，视觉冲击力不够',
        position: { x: 200, y: 350 },
        resolved: false,
        createdAt: now
      }
    ]);

    this.activities = [
      {
        id: 'act-001',
        projectId: mockProject.id,
        userId: mockUser.id,
        type: 'create_project',
        description: '创建了项目「品牌宣传海报」',
        createdAt: now
      }
    ];
  }

  generateId(prefix?: string): string {
    return prefix ? `${prefix}-${uuidv4().slice(0, 8)}` : uuidv4();
  }
}

export const store = DataStore.getInstance();
