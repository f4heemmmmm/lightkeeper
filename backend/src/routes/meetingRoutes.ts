import express from 'express';
import {
  getAllMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting
} from '../controllers/meetingController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/', protect, getAllMeetings);
router.get('/:id', protect, getMeetingById);
router.post('/', protect, createMeeting);
router.put('/:id', protect, updateMeeting);
router.delete('/:id', protect, deleteMeeting);

export default router;