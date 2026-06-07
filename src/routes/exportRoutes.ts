import { Router } from 'express';
import * as exportController from '../controllers/exportController';

const router = Router();

router.get('/download/:taskId', exportController.downloadExport);
router.get('/tasks/:taskId', exportController.getExportTask);
router.get('/:projectId/preview.png', exportController.getPreviewImage);
router.get('/:projectId/preview.svg', exportController.getPreviewImage);
router.get('/:projectId/tasks', exportController.getExportTasks);
router.post('/:projectId', exportController.createExport);
router.post('/:projectId/preview', exportController.generatePreview);
router.post('/:projectId/by-spec', exportController.exportBySpec);
router.post('/:projectId/source', exportController.exportSource);
router.post('/:projectId/batch', exportController.batchExport);

export default router;
