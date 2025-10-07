import mongoose, { Document, Schema } from 'mongoose';

export interface ISyncedCalendarEvent extends Document {
    eventId: string;
    calendarId: string;
    userId: mongoose.Types.ObjectId;
    grantId: string;
    taskId: mongoose.Types.ObjectId;
    eventTitle: string;
    eventStartTime: Date;
    eventEndTime?: Date;
    syncDirection: 'calendar_to_task' | 'task_to_calendar';
    createdAt: Date;
    updatedAt: Date;
}

const syncedCalendarEventSchema = new Schema<ISyncedCalendarEvent>(
    {
        eventId: { type: String, required: true },
        calendarId: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        grantId: { type: String, required: true },
        taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
        eventTitle: { type: String, required: true },
        eventStartTime: { type: Date, required: true },
        eventEndTime: { type: Date, required: false },
        syncDirection: { 
            type: String, 
            enum: ['calendar_to_task', 'task_to_calendar'],
            default: 'calendar_to_task'
        },
    },
    {
        timestamps: true
    }
);

// Add a compound unique index to ensure a calendar event is only synced once per user
syncedCalendarEventSchema.index({ eventId: 1, userId: 1 }, { unique: true });
syncedCalendarEventSchema.index({ eventStartTime: -1 }); // Index for sorting by date
syncedCalendarEventSchema.index({ taskId: 1 }); // Index for looking up by task

export default mongoose.model<ISyncedCalendarEvent>('SyncedCalendarEvent', syncedCalendarEventSchema);

