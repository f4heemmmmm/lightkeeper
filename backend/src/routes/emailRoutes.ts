import express from 'express';
import { scanEmails, getScanStats, processSpecificEmail } from '../controllers/emailController';
import { protect } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/emails/scan
 * @desc    Scan linked email account for new emails and extract tasks
 * @access  Private
 */
router.post('/scan', protect, scanEmails);

/**
 * @route   GET /api/emails/stats
 * @desc    Get email scanning statistics for the authenticated user
 * @access  Private
 */
router.get('/stats', protect, getScanStats);

/**
 * @route   POST /api/emails/process
 * @desc    Manually process a specific email by ID
 * @access  Private
 */
router.post('/process', protect, processSpecificEmail);

export default router;

