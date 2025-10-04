import { Request, Response } from 'express';
import { manualSyncForUser } from '../services/calendarSchedulerService';
import { fetchCalendarEvents, fetchCalendars } from '../services/nylasService';
import SyncedCalendarEvent from '../models/SyncedCalendarEvent';

const NYLAS_GRANT_ID = process.env.NYLAS_GRANT_ID;

/**
 * Manually trigger calendar sync for the authenticated user
 */
export const syncCalendar = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        if (!NYLAS_GRANT_ID) {
            res.status(500).json({ message: 'Nylas grant ID not configured' });
            return;
        }

        console.log(`[Calendar API] Manual sync requested by user: ${userId}`);
        
        const result = await manualSyncForUser(userId, NYLAS_GRANT_ID);
        
        res.status(200).json({
            message: 'Calendar sync completed',
            result: {
                totalEvents: result.totalEvents,
                tasksCreated: result.tasksCreated,
                errors: result.errors
            }
        });
    } catch (error: any) {
        console.error('[Calendar API] Sync error:', error);
        res.status(500).json({ 
            message: 'Calendar sync failed', 
            error: error.message 
        });
    }
};

/**
 * Get sync statistics for the authenticated user
 */
export const getSyncStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const syncedEvents = await SyncedCalendarEvent.find({ userId })
            .populate('taskId')
            .sort({ eventStartTime: -1 })
            .limit(50);

        const stats = {
            totalSyncedEvents: syncedEvents.length,
            upcomingEvents: syncedEvents.filter(e => e.eventStartTime > new Date()).length,
            pastEvents: syncedEvents.filter(e => e.eventStartTime <= new Date()).length,
            recentSyncs: syncedEvents.slice(0, 10).map(sync => ({
                eventId: sync.eventId,
                eventTitle: sync.eventTitle,
                eventStartTime: sync.eventStartTime,
                taskId: sync.taskId,
                syncedAt: sync.createdAt
            }))
        };

        res.status(200).json(stats);
    } catch (error: any) {
        console.error('[Calendar API] Stats error:', error);
        res.status(500).json({ 
            message: 'Failed to get sync stats', 
            error: error.message 
        });
    }
};

/**
 * Fetch calendar events from Nylas (not synced, just fetched for display)
 */
export const getCalendarEvents = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        if (!NYLAS_GRANT_ID) {
            res.status(500).json({ message: 'Nylas grant ID not configured' });
            return;
        }

        // Get query parameters
        const startTime = req.query.start ? parseInt(req.query.start as string) : undefined;
        const endTime = req.query.end ? parseInt(req.query.end as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

        console.log(`[Calendar API] Fetching calendar events for user: ${userId}`);
        
        const events = await fetchCalendarEvents(
            NYLAS_GRANT_ID,
            undefined,
            startTime,
            endTime,
            limit
        );
        
        res.status(200).json({
            events,
            count: events.length
        });
    } catch (error: any) {
        console.error('[Calendar API] Fetch events error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch calendar events', 
            error: error.message 
        });
    }
};

/**
 * Get all calendars for the authenticated user
 */
export const getCalendars = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        if (!NYLAS_GRANT_ID) {
            res.status(500).json({ message: 'Nylas grant ID not configured' });
            return;
        }

        console.log(`[Calendar API] Fetching calendars for user: ${userId}`);
        
        const calendars = await fetchCalendars(NYLAS_GRANT_ID);
        
        res.status(200).json({
            calendars,
            count: calendars.length
        });
    } catch (error: any) {
        console.error('[Calendar API] Fetch calendars error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch calendars', 
            error: error.message 
        });
    }
};

