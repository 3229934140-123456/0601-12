import { Request, Response } from 'express';
import { store } from '../store';
import { success, fail, paginate, getCurrentUserId } from '../utils/response';
import { Review, Project, Notification } from '../types';

export const getReviews = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const status = req.query.status as string;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  let reviews = store.reviews.get(projectId) || [];

  if (status) {
    reviews = reviews.filter(r => r.status === status);
  }

  reviews.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const reviewsWithUsers = reviews.map(r => ({
    ...r,
    submitter: store.users.get(r.submitterId),
    reviewerUsers: r.reviewers.map(id => store.users.get(id)).filter(Boolean)
  }));

  success(res, paginate(reviewsWithUsers, page, pageSize));
};

export const getReview = (req: Request, res: Response) => {
  const { projectId, reviewId } = req.params;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const reviews = store.reviews.get(projectId) || [];
  const review = reviews.find(r => r.id === reviewId);

  if (!review) {
    return fail(res, '审核不存在', 404);
  }

  success(res, {
    ...review,
    submitter: store.users.get(review.submitterId),
    reviewerUsers: review.reviewers.map(id => store.users.get(id)).filter(Boolean)
  });
};

export const createReview = (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = getCurrentUserId(req);
  const { reviewers, canvasVersion, feedback } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  if (!canEdit(project, userId)) {
    return fail(res, '没有权限发起审核', 403);
  }

  if (!reviewers || reviewers.length === 0) {
    return fail(res, '请至少指定一位审核人');
  }

  const now = new Date().toISOString();
  const review: Review = {
    id: store.generateId('review'),
    projectId,
    canvasVersion: canvasVersion || project.currentVersion,
    submitterId: userId,
    reviewers: Array.isArray(reviewers) ? reviewers : [reviewers],
    status: 'pending',
    feedback: feedback || '',
    createdAt: now
  };

  const reviews = store.reviews.get(projectId) || [];
  reviews.push(review);
  store.reviews.set(projectId, reviews);

  project.status = 'reviewing';
  project.updatedAt = now;

  review.reviewers.forEach(reviewerId => {
    sendNotification(
      reviewerId,
      'review',
      '新的审核请求',
      `项目「${project.name}」提交了审核，请及时处理`,
      review.id,
      'review'
    );
  });

  success(res, review, '审核已提交');
};

export const approveReview = (req: Request, res: Response) => {
  const { projectId, reviewId } = req.params;
  const userId = getCurrentUserId(req);
  const { feedback } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const reviews = store.reviews.get(projectId) || [];
  const review = reviews.find(r => r.id === reviewId);

  if (!review) {
    return fail(res, '审核不存在', 404);
  }

  if (!review.reviewers.includes(userId)) {
    return fail(res, '您不是审核人，没有权限操作', 403);
  }

  if (review.status !== 'pending') {
    return fail(res, '该审核已处理');
  }

  review.status = 'approved';
  review.feedback = feedback || review.feedback;
  review.reviewedAt = new Date().toISOString();
  review.reviewedBy = userId;

  project.status = 'approved';
  project.updatedAt = new Date().toISOString();

  sendNotification(
    review.submitterId,
    'review',
    '审核已通过',
    `项目「${project.name}」的审核已通过`,
    review.id,
    'review'
  );

  success(res, review, '审核已通过');
};

export const rejectReview = (req: Request, res: Response) => {
  const { projectId, reviewId } = req.params;
  const userId = getCurrentUserId(req);
  const { feedback } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const reviews = store.reviews.get(projectId) || [];
  const review = reviews.find(r => r.id === reviewId);

  if (!review) {
    return fail(res, '审核不存在', 404);
  }

  if (!review.reviewers.includes(userId)) {
    return fail(res, '您不是审核人，没有权限操作', 403);
  }

  if (review.status !== 'pending') {
    return fail(res, '该审核已处理');
  }

  review.status = 'rejected';
  review.feedback = feedback || review.feedback;
  review.reviewedAt = new Date().toISOString();
  review.reviewedBy = userId;

  project.status = 'draft';
  project.updatedAt = new Date().toISOString();

  sendNotification(
    review.submitterId,
    'review',
    '审核未通过',
    `项目「${project.name}」的审核未通过，请查看反馈`,
    review.id,
    'review'
  );

  success(res, review, '审核已驳回');
};

export const requestChanges = (req: Request, res: Response) => {
  const { projectId, reviewId } = req.params;
  const userId = getCurrentUserId(req);
  const { feedback } = req.body;

  const project = store.projects.get(projectId);
  if (!project) {
    return fail(res, '项目不存在', 404);
  }

  const reviews = store.reviews.get(projectId) || [];
  const review = reviews.find(r => r.id === reviewId);

  if (!review) {
    return fail(res, '审核不存在', 404);
  }

  if (!review.reviewers.includes(userId)) {
    return fail(res, '您不是审核人，没有权限操作', 403);
  }

  if (review.status !== 'pending') {
    return fail(res, '该审核已处理');
  }

  review.status = 'changes_requested';
  review.feedback = feedback || review.feedback;
  review.reviewedAt = new Date().toISOString();
  review.reviewedBy = userId;

  project.status = 'draft';
  project.updatedAt = new Date().toISOString();

  sendNotification(
    review.submitterId,
    'review',
    '需要修改',
    `项目「${project.name}」的审核需要修改，请查看反馈`,
    review.id,
    'review'
  );

  success(res, review, '已要求修改');
};

export const getMyReviews = (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const status = req.query.status as string;

  let allReviews: Review[] = [];
  store.reviews.forEach(reviews => {
    reviews.forEach(review => {
      if (review.reviewers.includes(userId)) {
        allReviews.push(review);
      }
    });
  });

  if (status) {
    allReviews = allReviews.filter(r => r.status === status);
  }

  allReviews.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const reviewsWithProjects = allReviews.map(r => ({
    ...r,
    project: store.projects.get(r.projectId),
    submitter: store.users.get(r.submitterId)
  }));

  success(res, paginate(reviewsWithProjects, page, pageSize));
};

function canEdit(project: Project, userId: string): boolean {
  const member = project.members.find(m => m.userId === userId);
  return !!member && (member.role === 'owner' || member.role === 'editor');
}

function sendNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  content: string,
  relatedId: string,
  relatedType: string
) {
  const notification: Notification = {
    id: store.generateId('notif'),
    userId,
    type,
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
}
