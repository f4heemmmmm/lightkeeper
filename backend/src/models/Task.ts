import mongoose, { Document, Schema } from 'mongoose';

export interface ITask extends Document {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'completed';
    dueDate?: Date | null;
    assignedTo?: mongoose.Types.ObjectId | null;
    isPrivate: boolean;
    createdBy: mongoose.Types.ObjectId;
    source?: 'manual' | 'email' | 'calendar' | 'meeting';
    sourceMeetingId?: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
    {
        title: {
            type: String,
            required: [true, 'Task title is required'],
            trim: true,
            maxlength: [100, 'Title cannot exceed 100 characters']
        },
        description: {
            type: String,
            required: [true, 'Task description is required'],
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters']
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        status: {
            type: String,
            enum: ['pending', 'completed'],
            default: 'pending'
        },
    dueDate: {
        type: Date,
        required: false,
        default: null
    },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        isPrivate: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        source: {
            type: String,
            enum: ['manual', 'email', 'calendar', 'meeting'],
            default: 'manual'
        },
        sourceMeetingId: {
            type: Schema.Types.ObjectId,
            ref: 'Meeting',
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Add post-save middleware to sync new tasks to calendar
taskSchema.post('save', async function(doc) {
    if (this.isNew && doc.dueDate && doc.source !== 'calendar') {
        // Sync this task to Google Calendar
        try {
            const { syncTaskToCalendar } = require('../services/calendarSchedulerService');
            await syncTaskToCalendar(doc);
        } catch (error) {
            console.error('Failed to sync task to calendar:', error);
        }
    }
});

export default mongoose.model<ITask>('Task', taskSchema);
