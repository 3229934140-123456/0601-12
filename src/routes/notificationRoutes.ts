import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';

const router = Router();

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/clear', notificationController.clearNotifications);
router.post('/send', notificationController.sendNotification);

router.get('/activities', notificationController.getActivities);
router.get('/activities/project/:projectId', notificationController.getProjectActivities);

router.get('/stats/team/:teamId', notificationController.getTeamStats);

export default router;
