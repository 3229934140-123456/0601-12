import { Router } from 'express';
import * as commentController from '../controllers/commentController';

const router = Router();

router.get('/:projectId', commentController.getComments);
router.post('/:projectId', commentController.createComment);
router.put('/:projectId/:commentId', commentController.updateComment);
router.delete('/:projectId/:commentId', commentController.deleteComment);
router.post('/:projectId/:commentId/resolve', commentController.resolveComment);
router.post('/:projectId/:commentId/unresolve', commentController.unresolveComment);
router.post('/:projectId/:commentId/reply', commentController.replyComment);

export default router;
