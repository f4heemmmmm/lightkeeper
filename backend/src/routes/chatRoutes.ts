import express from 'express';
import { chatWithMeeting } from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/meeting', protect, chatWithMeeting);

export default router;