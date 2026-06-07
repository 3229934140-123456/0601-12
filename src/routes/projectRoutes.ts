import { Router } from 'express';
import * as projectController from '../controllers/projectController';

const router = Router();

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.put('/:id/page-size', projectController.updatePageSize);
router.get('/:id/versions', projectController.getProjectVersions);
router.get('/:id/members', projectController.getMembers);
router.post('/:id/members', projectController.inviteMember);
router.put('/:id/members/:userId', projectController.updateMemberRole);
router.delete('/:id/members/:userId', projectController.removeMember);

export default router;
