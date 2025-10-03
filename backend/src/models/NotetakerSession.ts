import mongoose, { Document, Schema } from 'mongoose';

export interface INotetakerSession extends Document {
    nylasSessionId: string;
    meetingUrl: string;
    meetingTitle?: string;
    status: 'scheduled' | 'joining' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    scheduledBy: mongoose.Types.ObjectId;
    scheduledByName: string;
    startedAt?: Date;
    completedAt?: Date;
    transcriptUrl?: string;
    recordingUrl?: string;
    summaryUrl?: string;
    meetingId?: mongoose.Types.ObjectId;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const notetakerSessionSchema = new Schema<INotetakerSession>(
    {
        nylasSessionId: {
            type: String,
            required: true,
            unique: true
        },
        meetingUrl: {
            type: String,
            required: true
        },
        meetingTitle: {
            type: String
        },
        status: {
            type: String,
            enum: ['scheduled', 'joining', 'in_progress', 'completed', 'failed', 'cancelled'],
            default: 'scheduled'
        },
        scheduledBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        scheduledByName: {
            type: String,
            required: true
        },
        startedAt: {
            type: Date
        },
        completedAt: {
            type: Date
        },
        transcriptUrl: {
            type: String
        },
        recordingUrl: {
            type: String
        },
        summaryUrl: {
            type: String
        },
        meetingId: {
            type: Schema.Types.ObjectId,
            ref: 'Meeting'
        },
        error: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model<INotetakerSession>('NotetakerSession', notetakerSessionSchema);