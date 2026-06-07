import { Router } from 'express';
import * as multer from 'multer';
import * as path from 'path';
import * as assetController from '../controllers/assetController';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

router.get('/', assetController.getAssets);
router.get('/categories', assetController.getAssetCategories);
router.get('/tags', assetController.getAssetTags);
router.get('/colors', assetController.getColorPalettes);
router.get('/fonts', assetController.getFonts);
router.get('/:id', assetController.getAsset);
router.post('/', upload.single('file'), assetController.uploadAsset);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);

export default router;
