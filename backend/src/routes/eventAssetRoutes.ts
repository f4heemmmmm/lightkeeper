import express from 'express';
import {
    generateAsset,
    getMeetingAssets,
    deleteAsset,
    reviseAsset,
    uploadLogo,
    getActiveLogo
} from '../controllers/eventAssetController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Asset generation
router.post('/generate', protect, generateAsset);
router.post('/revise', protect, reviseAsset);
router.get('/meeting/:meetingId', protect, getMeetingAssets);
router.delete('/:assetId', protect, deleteAsset);

// Logo management
router.post('/logo', protect, uploadLogo);
router.get('/logo', protect, getActiveLogo);

export default router;

