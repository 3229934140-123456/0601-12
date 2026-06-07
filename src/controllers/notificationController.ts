import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, paginate, getCurrentUserId } from '../utils/response';
import { Notification, Activity, TeamStats } from '../types';

export const getNotifications = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const type = req.query.type as string;
  const unreadOnly = req.query.unreadOnly === 'true';

  let notifications = store.notifications.get(userId) || [];

  if (type) {
    notifications = notifications.filter(n => n.type === type);
  }

  if (unreadOnly) {
    notifications = notifications.filter(n => !n.read);
  }

  notifications.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  success(res, paginate(notifications, page, pageSize));
};

export const getUnreadCount = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const notifications = store.notifications.get(userId) || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  success(res, { unreadCount });
};

export const markAsRead = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { id } = req.params;

  const notifications = store.notifications.get(userId) || [];
  const notification = notifications.find(n => n.id === id);

  if (!notification) {
    return fail(res, '通知不存在', 404);
  }

  notification.read = true;
  success(res, notification, '已标记为已读');
};

export const markAllAsRead = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const notifications = store.notifications.get(userId) || [];
  notifications.forEach(n => {
    n.read = true;
  });

  success(res, { count: notifications.length }, '全部标记为已读');
};

export const clearNotifications = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  store.notifications.set(userId, []);
  success(res, null, '已清空所有通知');
};

export const sendNotification = (req: Request, res: Response) => {
  const { userId, type, title, content, relatedId, relatedType } = req.body;

  if (!userId || !title || !content) {
    return fail(res, '缺少必要参数');
  }

  const notification: Notification = {
    id: store.generateId('notif'),
    userId,
    type: type || 'system',
    title,
    content,
    read: false,
    relatedId,
    relatedType,
    createdAt: new Date().toISOString()
  };

  const userNotifications = store.notifications.get(userId) || [];
  userNotifications.unshift(notification);
  store.notifications.set(userId, userNotifications);

  success(res, notification, '通知已发送');
};

export const getActivities = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const projectId = req.query.projectId as string;
  const type = req.query.type as string;

  let activities = [...store.activities];

  if (projectId) {
    activities = activities.filter(a => a.projectId === projectId);
  }

  if (type) {
    activities = activities.filter(a => a.type === type);
  }

  const projectIds = new Set<string>();
  activities.forEach(a => {
    if (a.projectId) projectIds.add(a.projectId);
  });

  let hasAccess = true;
  if (projectId) {
    const project = store.projects.get(projectId);
    hasAccess = project ? project.members.some(m => m.userId === userId) : false;
  }

  if (!hasAccess) {
    return fail(res, '没有权限查看', 403);
  }

  activities.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const activitiesWithUser = activities.map(a => ({
    ...a,
    user: store.users.get(a.userId)
  }));

  success(res, paginate(activitiesWithUser, page, pageSize));
};

export const getTeamStats = (req: Request, res: Response) => {
  const { teamId } = req.params;
  const period = (req.query.period as 'day' | 'week' | 'month') || 'week';

  const projects = Array.from(store.projects.values());
  const totalProjects = projects.length;

  let totalEdits = 0;
  let totalExports = 0;
  let totalMembers = 0;
  const activeUsers = new Set<string>();

  projects.forEach(p => {
    totalEdits += p.currentVersion;
    totalMembers += p.members.length;
    p.members.forEach(m => activeUsers.add(m.userId));
  });

  store.exportTasks.forEach(task => {
    if (task.status === 'completed') {
      totalExports++;
    }
  });

  const stats: TeamStats = {
    teamId: teamId || 'default',
    period,
    totalProjects,
    totalEdits,
    totalExports,
    totalMembers,
    activeUsers: activeUsers.size,
    storageUsed: 0
  };

  store.assets.forEach(asset => {
    stats.storageUsed += asset.size || 0;
  });

  const now = new Date();
  const projectTrend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 5) + 1
    };
  });

  success(res, {
    stats,
    projectTrend,
    topProjects: projects.slice(0, 5).map(p => ({
      id: p.id,
      name: p.name,
      edits: p.currentVersion,
      members: p.members.length
    }))
  });
};

export const getProjectActivities = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!project.members.some(m => m.userId === userId)) {
    return fail(res, '没有权限查看', 403);
  }

  let activities = store.activities.filter(a => a.projectId === projectId);

  activities.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const activitiesWithUser = activities.map(a => ({
    ...a,
    user: store.users.get(a.userId)
  }));

  success(res, paginate(activitiesWithUser, page, pageSize));
};
