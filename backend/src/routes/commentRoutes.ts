import express from 'express';
import {
  getTaskComments,
  createComment,
  updateComment,
  deleteComment
} from '../controllers/commentController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/task/:taskId', protect, getTaskComments);
router.post('/task/:taskId', protect, createComment);
router.put('/:commentId', protect, updateComment);
router.delete('/:commentId', protect, deleteComment);

export default router;