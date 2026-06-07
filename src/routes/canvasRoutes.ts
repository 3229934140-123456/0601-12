import { Router } from 'express';
import * as canvasController from '../controllers/canvasController';

const router = Router();

router.get('/:projectId/current', canvasController.getCurrentCanvas);
router.get('/:projectId/version/:version', canvasController.getCanvasVersion);
router.post('/:projectId/save', canvasController.saveCanvas);
router.post('/:projectId/layers', canvasController.addLayer);
router.put('/:projectId/layers/:layerId', canvasController.updateLayer);
router.delete('/:projectId/layers/:layerId', canvasController.deleteLayer);
router.post('/:projectId/layers/:layerId/duplicate', canvasController.duplicateLayer);
router.put('/:projectId/layers/reorder', canvasController.reorderLayers);
router.post('/:projectId/snapshot', canvasController.createSnapshot);
router.post('/:projectId/restore/:version', canvasController.restoreVersion);

export default router;
