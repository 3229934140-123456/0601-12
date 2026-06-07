import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';

const router = Router();

router.get('/mine', reviewController.getMyReviews);
router.get('/:projectId', reviewController.getReviews);
router.get('/:projectId/:reviewId', reviewController.getReview);
router.post('/:projectId', reviewController.createReview);
router.post('/:projectId/:reviewId/approve', reviewController.approveReview);
router.post('/:projectId/:reviewId/reject', reviewController.rejectReview);
router.post('/:projectId/:reviewId/request-changes', reviewController.requestChanges);

export default router;
