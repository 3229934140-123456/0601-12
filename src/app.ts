import * as express from 'express';
import * as path from 'path';
import { requestLogger, errorHandler, notFoundHandler, corsMiddleware } from './middleware';
import projectRoutes from './routes/projectRoutes';
import canvasRoutes from './routes/canvasRoutes';
import assetRoutes from './routes/assetRoutes';
import commentRoutes from './routes/commentRoutes';
import reviewRoutes from './routes/reviewRoutes';
import exportRoutes from './routes/exportRoutes';
import notificationRoutes from './routes/notificationRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(corsMiddleware);
app.use(requestLogger);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'Creative Design Platform API'
    }
  });
});

app.use('/api/projects', projectRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/docs', (req, res) => {
  const docs = {
    name: '创意设计平台 API',
    version: '1.0.0',
    description: '为多端绘图产品提供统一的设计协作能力',
    modules: {
      projects: {
        description: '项目管理',
        endpoints: [
          'GET    /api/projects              - 获取项目列表',
          'POST   /api/projects              - 创建项目',
          'GET    /api/projects/:id          - 获取项目详情',
          'PUT    /api/projects/:id          - 更新项目',
          'DELETE /api/projects/:id          - 删除项目',
          'PUT    /api/projects/:id/page-size - 更新页面尺寸',
          'GET    /api/projects/:id/versions  - 获取历史版本列表',
          'GET    /api/projects/:id/members   - 获取成员列表',
          'POST   /api/projects/:id/members   - 邀请成员',
          'PUT    /api/projects/:id/members/:userId - 修改成员角色',
          'DELETE /api/projects/:id/members/:userId - 移除成员'
        ]
      },
      canvas: {
        description: '画布管理',
        endpoints: [
          'GET    /api/canvas/:projectId/current       - 获取当前画布',
          'GET    /api/canvas/:projectId/version/:v    - 获取指定版本画布',
          'POST   /api/canvas/:projectId/save          - 保存画布',
          'POST   /api/canvas/:projectId/layers        - 添加图层',
          'PUT    /api/canvas/:projectId/layers/:id    - 更新图层',
          'DELETE /api/canvas/:projectId/layers/:id    - 删除图层',
          'POST   /api/canvas/:projectId/layers/:id/duplicate - 复制图层',
          'PUT    /api/canvas/:projectId/layers/reorder - 重排图层',
          'POST   /api/canvas/:projectId/snapshot      - 创建快照',
          'POST   /api/canvas/:projectId/restore/:v    - 恢复版本'
        ]
      },
      assets: {
        description: '素材管理',
        endpoints: [
          'GET    /api/assets              - 获取素材列表',
          'GET    /api/assets/categories   - 获取素材分类',
          'GET    /api/assets/tags         - 获取素材标签',
          'GET    /api/assets/colors       - 获取配色方案',
          'GET    /api/assets/fonts        - 获取字体列表',
          'GET    /api/assets/:id          - 获取素材详情',
          'POST   /api/assets              - 上传素材',
          'PUT    /api/assets/:id          - 更新素材',
          'DELETE /api/assets/:id          - 删除素材'
        ]
      },
      comments: {
        description: '评论/批注',
        endpoints: [
          'GET    /api/comments/:projectId           - 获取评论列表',
          'POST   /api/comments/:projectId           - 提交评论',
          'PUT    /api/comments/:projectId/:id       - 更新评论',
          'DELETE /api/comments/:projectId/:id       - 删除评论',
          'POST   /api/comments/:projectId/:id/resolve   - 标记已解决',
          'POST   /api/comments/:projectId/:id/unresolve - 取消解决',
          'POST   /api/comments/:projectId/:id/reply     - 回复评论'
        ]
      },
      reviews: {
        description: '审核流程',
        endpoints: [
          'GET    /api/reviews/mine                 - 我的待审核',
          'GET    /api/reviews/:projectId           - 项目审核列表',
          'GET    /api/reviews/:projectId/:id       - 审核详情',
          'POST   /api/reviews/:projectId           - 发起审核',
          'POST   /api/reviews/:projectId/:id/approve - 通过审核',
          'POST   /api/reviews/:projectId/:id/reject  - 驳回审核',
          'POST   /api/reviews/:projectId/:id/request-changes - 要求修改'
        ]
      },
      export: {
        description: '导出功能',
        endpoints: [
          'GET    /api/export/tasks/:id             - 导出任务详情',
          'GET    /api/export/:projectId/tasks      - 项目导出任务列表',
          'POST   /api/export/:projectId            - 创建导出任务',
          'POST   /api/export/:projectId/preview    - 生成预览图',
          'POST   /api/export/:projectId/by-spec    - 按规格导出',
          'POST   /api/export/:projectId/source     - 打包源文件',
          'POST   /api/export/:projectId/batch      - 批量导出'
        ]
      },
      notifications: {
        description: '通知与统计',
        endpoints: [
          'GET    /api/notifications                - 获取通知列表',
          'GET    /api/notifications/unread-count   - 未读数量',
          'PUT    /api/notifications/:id/read       - 标记已读',
          'PUT    /api/notifications/read-all       - 全部已读',
          'DELETE /api/notifications/clear          - 清空通知',
          'POST   /api/notifications/send           - 发送通知',
          'GET    /api/notifications/activities     - 操作动态',
          'GET    /api/notifications/activities/project/:id - 项目动态',
          'GET    /api/notifications/stats/team/:id - 团队统计'
        ]
      }
    }
  };

  res.json({
    code: 0,
    message: 'success',
    data: docs
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   创意设计平台后端服务启动成功!                            ║
║                                                           ║
║   服务地址:  http://localhost:${PORT}                        ║
║   健康检查:  http://localhost:${PORT}/api/health             ║
║   API 文档:  http://localhost:${PORT}/api/docs               ║
║                                                           ║
║   七类接口:  项目 | 画布 | 素材 | 评论 | 审核 | 导出 | 通知  ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
