import { Router } from 'express';
import * as exportController from '../controllers/exportController';

const router = Router();

router.get('/tasks/:taskId', exportController.getExportTask);
router.get('/:projectId/tasks', exportController.getExportTasks);
router.post('/:projectId', exportController.createExport);
router.post('/:projectId/preview', exportController.generatePreview);
router.post('/:projectId/by-spec', exportController.exportBySpec);
router.post('/:projectId/source', exportController.exportSource);
router.post('/:projectId/batch', exportController.batchExport);

export default router;
