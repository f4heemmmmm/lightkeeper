import express from 'express';
import { syncCalendar, getSyncStats, getCalendarEvents, getCalendars, syncTasksToCalendar } from '../controllers/calendarController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Manual sync trigger
router.post('/sync', protect, syncCalendar);

// Get sync statistics
router.get('/sync-stats', protect, getSyncStats);

// Get calendar events from Nylas
router.get('/events', protect, getCalendarEvents);

// Get all calendars
router.get('/calendars', protect, getCalendars);

// Sync tasks to Google Calendar
router.post('/sync-to-calendar', protect, syncTasksToCalendar);

export default router;

