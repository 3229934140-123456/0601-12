import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, paginate, getCurrentUserId } from '../utils/response';
import { canView, canEdit, isValidCommentContent } from '../utils/permission';
import { Comment, Project, Notification } from '../types';

export const getComments = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const resolved = req.query.resolved as string;
  const version = req.query.version as string;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '无权限查看评论', 403);
  }

  let comments = store.comments.get(projectId) || [];

  if (resolved !== undefined) {
    comments = comments.filter(c => c.resolved === (resolved === 'true'));
  }

  if (version) {
    comments = comments.filter(c => c.canvasVersion === parseInt(version));
  }

  comments.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const commentsWithAuthor = comments.map(c => ({
    ...c,
    author: store.users.get(c.authorId)
  }));

  success(res, paginate(commentsWithAuthor, page, pageSize));
};

export const createComment = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const { content, position, canvasVersion } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '没有权限评论', 403);
  }

  if (!content || !content.trim()) {
    return fail(res, '评论内容不能为空');
  }

  const now = new Date().toISOString();
  const comment: Comment = {
    id: store.generateId('comment'),
    projectId,
    canvasVersion: canvasVersion || project.currentVersion,
    authorId: userId,
    content: content.trim(),
    position: position || undefined,
    resolved: false,
    createdAt: now,
    replies: []
  };

  const comments = store.comments.get(projectId) || [];
  comments.push(comment);
  store.comments.set(projectId, comments);

  notifyProjectMembers(project, userId, 'comment', '新的评论', content, comment.id, 'comment');

  success(res, comment, '评论成功');
};

export const updateComment = (req: Request, res: Response) => {
  const { projectId, commentId } = req.params;
  const userId = getCurrentUserId(req);
  const { content } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const comments = store.comments.get(projectId) || [];
  const comment = comments.find(c => c.id === commentId);

  if (!comment) {
    return fail(res, '评论不存在', 404);
  }

  if (comment.authorId !== userId) {
    return fail(res, '没有权限修改', 403);
  }

  const validation = isValidCommentContent(content);
  if (!validation.valid) {
    return fail(res, validation.message || '评论内容无效', 400);
  }

  comment.content = content.trim();
  success(res, comment, '更新成功');
};

export const deleteComment = (req: Request, res: Response) => {
  const { projectId, commentId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const comments = store.comments.get(projectId) || [];
  const index = comments.findIndex(c => c.id === commentId);

  if (index === -1) {
    return fail(res, '评论不存在', 404);
  }

  const comment = comments[index];
  const isOwner = project.members.find(m => m.userId === userId)?.role === 'owner';

  if (comment.authorId !== userId && !isOwner) {
    return fail(res, '没有权限删除', 403);
  }

  comments.splice(index, 1);
  success(res, null, '删除成功');
};

export const resolveComment = (req: Request, res: Response) => {
  const { projectId, commentId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有权限操作', 403);
  }

  const comments = store.comments.get(projectId) || [];
  const comment = comments.find(c => c.id === commentId);

  if (!comment) {
    return fail(res, '评论不存在', 404);
  }

  comment.resolved = true;
  comment.resolvedBy = userId;
  comment.resolvedAt = new Date().toISOString();

  success(res, comment, '已标记为已解决');
};

export const unresolveComment = (req: Request, res: Response) => {
  const { projectId, commentId } = req.params;
  const userId = getCurrentUserId(req);

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有权限操作', 403);
  }

  const comments = store.comments.get(projectId) || [];
  const comment = comments.find(c => c.id === commentId);

  if (!comment) {
    return fail(res, '评论不存在', 404);
  }

  comment.resolved = false;
  comment.resolvedBy = undefined;
  comment.resolvedAt = undefined;

  success(res, comment, '已重新打开');
};

export const replyComment = (req: Request, res: Response) => {
  const { projectId, commentId } = req.params;
  const userId = getCurrentUserId(req);
  const { content } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canView(project, userId)) {
    return fail(res, '没有权限评论', 403);
  }

  if (!content || !content.trim()) {
    return fail(res, '回复内容不能为空');
  }

  const comments = store.comments.get(projectId) || [];
  const comment = comments.find(c => c.id === commentId);

  if (!comment) {
    return fail(res, '评论不存在', 404);
  }

  const reply: Comment = {
    id: store.generateId('reply'),
    projectId,
    authorId: userId,
    content: content.trim(),
    resolved: false,
    createdAt: new Date().toISOString(),
    replies: []
  };

  if (!comment.replies) {
    comment.replies = [];
  }
  comment.replies.push(reply);

  success(res, reply, '回复成功');
};

function notifyProjectMembers(
  project: Project,
  excludeUserId: string,
  type: Notification['type'],
  title: string,
  content: string,
  relatedId: string,
  relatedType: string
) {
  const now = new Date().toISOString();
  project.members.forEach(member => {
    if (member.userId === excludeUserId) return;

    const notification: Notification = {
      id: store.generateId('notif'),
      userId: member.userId,
      type,
      title,
      content,
      read: false,
      relatedId,
      relatedType,
      createdAt: now
    };

    const userNotifications = store.notifications.get(member.userId) || [];
    userNotifications.unshift(notification);
    store.notifications.set(member.userId, userNotifications);
  });
}
