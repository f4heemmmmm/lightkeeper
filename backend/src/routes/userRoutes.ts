import express from 'express';
import { protect } from '../middleware/auth';
import { getAllMembers } from '../controllers/userController';

const router = express.Router();

router.get('/members', protect, getAllMembers);

export default router;