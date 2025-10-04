import express from 'express';
import {
  scheduleNotetaker,
  getNotetakerSessions,
  getNotetakerSessionById,
  cancelNotetaker,
  handleNotetakerWebhook,
  checkNotetakerStatus
} from '../controllers/notetakerController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/webhook', handleNotetakerWebhook);
router.get('/webhook', handleNotetakerWebhook);

router.post('/', protect, scheduleNotetaker);
router.get('/', protect, getNotetakerSessions);
router.get('/:id', protect, getNotetakerSessionById);
router.delete('/:id', protect, cancelNotetaker);
router.get('/:id/status', protect, checkNotetakerStatus);

export default router;
