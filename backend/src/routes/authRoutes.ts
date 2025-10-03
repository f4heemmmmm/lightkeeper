import express from 'express';
import { protect } from '../middleware/auth';
import { register, login, getCurrentUser } from '../controllers/authController';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getCurrentUser);

export default router;