import { fetchCalendarEvents, fetchCalendars, createCalendarEvent, NylasCalendarEvent } from './nylasService';
import SyncedCalendarEvent from '../models/SyncedCalendarEvent';
import Task from '../models/Task';
import User from '../models/User';

const CALENDAR_SYNC_INTERVAL_MINUTES = parseInt(process.env.CALENDAR_SYNC_INTERVAL_MINUTES || '15', 10);
const NYLAS_GRANT_ID = process.env.NYLAS_GRANT_ID;

interface SyncResult {
    userId: string;
    userEmail: string;
    totalEvents: number;
    tasksCreated: number;
    errors: string[];
}

/**
 * Convert Nylas calendar event time to Date object
 */
function getEventStartTime(event: NylasCalendarEvent): Date | null {
    if (event.when.start_time) {
        return new Date(event.when.start_time * 1000);
    } else if (event.when.start_date) {
        return new Date(event.when.start_date);
    }
    return null;
}

function getEventEndTime(event: NylasCalendarEvent): Date | null {
    if (event.when.end_time) {
        return new Date(event.when.end_time * 1000);
    } else if (event.when.end_date) {
        return new Date(event.when.end_date);
    }
    return null;
}

/**
 * Sync calendar events for a specific user
 */
async function syncCalendarEventsForUser(userId: string, grantId: string): Promise<SyncResult> {
    const result: SyncResult = {
        userId,
        userEmail: '',
        totalEvents: 0,
        tasksCreated: 0,
        errors: []
    };

    try {
        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        result.userEmail = user.email;

        console.log(`[Calendar Sync] Starting sync for user: ${user.email}`);

        // Fetch calendar events for the next 30 days
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysFromNow = now + (30 * 24 * 60 * 60);
        
        const events = await fetchCalendarEvents(grantId, undefined, now, thirtyDaysFromNow, 100);
        result.totalEvents = events.length;

        console.log(`[Calendar Sync] Found ${events.length} calendar events`);

        if (events.length === 0) {
            console.log('[Calendar Sync] No events to sync');
            return result;
        }

        // Process each event
        for (const event of events) {
            try {
                // Check if this event has already been synced for this user
                const existingSync = await SyncedCalendarEvent.findOne({
                    eventId: event.id,
                    userId: userId
                });

                if (existingSync) {
                    console.log(`[Calendar Sync] Event already synced: ${event.title} (${event.id})`);
                    continue;
                }

                // Get event times
                const startTime = getEventStartTime(event);
                const endTime = getEventEndTime(event);

                if (!startTime) {
                    console.log(`[Calendar Sync]  Skipping event without start time: ${event.title}`);
                    continue;
                }

                // Skip events that have already passed
                if (startTime < new Date()) {
                    console.log(`[Calendar Sync]  Skipping past event: ${event.title}`);
                    continue;
                }

                // Create task from calendar event
                console.log(`[Calendar Sync] Creating task from event: ${event.title}`);
                console.log(`[Calendar Sync] Event time: ${startTime.toISOString()}`);
                
                // Build description with all available info
                let descriptionParts = [];
                
                if (event.description) {
                    descriptionParts.push(event.description);
                } else {
                    descriptionParts.push(`Calendar event: ${event.title}`);
                }
                
                if (event.location) {
                    descriptionParts.push(`Location: ${event.location}`);
                }
                
                if (event.participants && event.participants.length > 0) {
                    const participantNames = event.participants.map(p => p.name || p.email).join(', ');
                    descriptionParts.push(`Participants: ${participantNames}`);
                }
                
                const finalDescription = descriptionParts.join('\n\n');

                const newTask = new Task({
                    title: event.title,
                    description: finalDescription,
                    status: 'pending',
                    priority: 'medium', // Default priority for calendar events
                    dueDate: startTime,
                    createdBy: userId,
                    assignedTo: user.role === 'organisation' ? null : userId,
                    isPrivate: false,
                    source: 'calendar' // Add source field to track origin
                });

                const savedTask = await newTask.save();
                console.log(`[Calendar Sync]  Task created successfully: ${savedTask._id}`);

                // Track this sync
                const syncRecord = new SyncedCalendarEvent({
                    eventId: event.id,
                    calendarId: event.calendar_id,
                    userId: userId,
                    grantId: grantId,
                    taskId: savedTask._id,
                    eventTitle: event.title,
                    eventStartTime: startTime,
                    eventEndTime: endTime || undefined,
                });

                await syncRecord.save();
                result.tasksCreated++;

                console.log(`[Calendar Sync]  Sync record created for event: ${event.id}`);

            } catch (error: any) {
                const errorMsg = `Failed to sync event "${event.title}": ${error.message}`;
                console.error(`[Calendar Sync]  ${errorMsg}`);
                result.errors.push(errorMsg);
            }
        }

        console.log(`[Calendar Sync] Completed sync for ${user.email}: ${result.tasksCreated} tasks created from ${result.totalEvents} events`);
        return result;

    } catch (error: any) {
        const errorMsg = `Calendar sync failed for user ${userId}: ${error.message}`;
        console.error(`[Calendar Sync]  ${errorMsg}`);
        result.errors.push(errorMsg);
        return result;
    }
}

/**
 * Sync calendar events for all users
 */
async function syncAllUsersCalendars(): Promise<void> {
    const syncStartTime = new Date();
    console.log('\n' + '='.repeat(80));
    console.log(`[Calendar Sync] AUTOMATED CALENDAR SYNC STARTED`);
    console.log(`[Calendar Sync] Time: ${syncStartTime.toISOString()}`);
    console.log('='.repeat(80));

    try {
        if (!NYLAS_GRANT_ID) {
            console.error('[Calendar Sync] NYLAS_GRANT_ID not configured in environment variables');
            return;
        }

        // Get all users
        const users = await User.find({});
        
        if (users.length === 0) {
            console.log('[Calendar Sync] No users found in database');
            return;
        }

        console.log(`[Calendar Sync] Found ${users.length} user(s) to sync`);

        const results: SyncResult[] = [];

        // Sync calendar for each user
        for (const user of users) {
            try {
                console.log(`\n[Calendar Sync] --- Syncing calendar for user: ${user.email} ---`);
                const result = await syncCalendarEventsForUser(user.id, NYLAS_GRANT_ID);
                results.push(result);
            } catch (error: any) {
                console.error(`[Calendar Sync]  Failed to sync for user ${user.email}:`, error.message);
                results.push({
                    userId: user.id,
                    userEmail: user.email,
                    totalEvents: 0,
                    tasksCreated: 0,
                    errors: [error.message]
                });
            }
        }

        // Print summary
        const syncEndTime = new Date();
        const duration = (syncEndTime.getTime() - syncStartTime.getTime()) / 1000;
        
        console.log('\n' + '='.repeat(80));
        console.log('[Calendar Sync] SYNC SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total users processed: ${results.length}`);
        console.log(`Total events found: ${results.reduce((sum, r) => sum + r.totalEvents, 0)}`);
        console.log(`Total tasks created: ${results.reduce((sum, r) => sum + r.tasksCreated, 0)}`);
        console.log(`Total errors: ${results.reduce((sum, r) => sum + r.errors.length, 0)}`);
        console.log(`Duration: ${duration.toFixed(2)}s`);
        
        results.forEach(r => {
            const statusIcon = r.errors.length > 0 ? '' : '';
            console.log(`\n${statusIcon} ${r.userEmail}:`);
            console.log(`  - Events: ${r.totalEvents}`);
            console.log(`  - Tasks created: ${r.tasksCreated}`);
            if (r.errors.length > 0) {
                console.log(`  - Errors: ${r.errors.length}`);
                r.errors.forEach(err => console.log(`    - ${err}`));
            }
        });
        
        console.log('='.repeat(80) + '\n');

    } catch (error: any) {
        console.error('[Calendar Sync]  Sync failed:', error.message);
        console.error('[Calendar Sync] Stack:', error.stack);
    }
}

/**
 * Start the calendar sync scheduler
 */
export function startCalendarScheduler(): void {
    console.log('CALENDAR SYNC SCHEDULER INITIALIZED');
    console.log(`Sync interval: ${CALENDAR_SYNC_INTERVAL_MINUTES} minute(s)`);
    console.log(`Grant ID: ${NYLAS_GRANT_ID ? ' Configured' : ' Not configured'}`);

    if (!NYLAS_GRANT_ID) {
        console.error(' WARNING: NYLAS_GRANT_ID not set. Calendar sync will not work.');
        console.error(' Please set NYLAS_GRANT_ID in your .env file\n');
        return;
    }

    // Run first sync immediately
    console.log('[Calendar Sync] Running initial calendar sync...');
    syncAllUsersCalendars().catch(err => {
        console.error('[Calendar Sync] Error in initial sync:', err);
    });

    // Schedule recurring syncs
    const intervalMs = CALENDAR_SYNC_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => {
        syncAllUsersCalendars().catch(err => {
            console.error('[Calendar Sync] Error in scheduled sync:', err);
        });
    }, intervalMs);

    console.log(`[Calendar Sync]  Scheduler active - running every ${CALENDAR_SYNC_INTERVAL_MINUTES} minute(s)\n`);
}

/**
 * Manual sync for a specific user (for API endpoint)
 */
export async function manualSyncForUser(userId: string, grantId: string): Promise<SyncResult> {
    console.log(`[Calendar Sync] Manual sync requested for user: ${userId}`);
    return await syncCalendarEventsForUser(userId, grantId);
}

/**
 * Sync a Lightkeeper task to Google Calendar
 */
export async function syncTaskToCalendar(task: any): Promise<void> {
    try {
        if (!NYLAS_GRANT_ID || !task.dueDate) return;

        // Get primary calendar
        const calendars = await fetchCalendars(NYLAS_GRANT_ID);
        const primaryCalendar = calendars.find(cal => cal.is_primary) || calendars[0];
        
        if (!primaryCalendar) return;

        // Check if already synced
        const existingSync = await SyncedCalendarEvent.findOne({
            taskId: task._id,
            syncDirection: 'task_to_calendar'
        });

        if (existingSync) return;

        // Create calendar event
        const calendarEvent = await createCalendarEvent(NYLAS_GRANT_ID, primaryCalendar.id, {
            title: `[Lightkeeper] ${task.title}`,
            description: task.description,
            startTime: task.dueDate,
            endTime: new Date(task.dueDate.getTime() + 60 * 60 * 1000) // 1 hour duration
        });

        // Track the sync
        await new SyncedCalendarEvent({
            eventId: calendarEvent.id,
            calendarId: primaryCalendar.id,
            userId: task.createdBy,
            grantId: NYLAS_GRANT_ID,
            taskId: task._id,
            eventTitle: task.title,
            eventStartTime: task.dueDate,
            syncDirection: 'task_to_calendar'
        }).save();

        console.log(`[Calendar Sync] Task synced to Google Calendar: ${task.title}`);
    } catch (error: any) {
        console.error('[Calendar Sync] Failed to sync task to calendar:', error.message);
    }
}

