import mongoose, { Document, Schema } from 'mongoose';

export interface IMeeting extends Document {
    title: string;
    description?: string;
    summary?: string;
    actionItems?: string[];
    tags?: string[];
    internalTags?: string[];
    fileUrl: string;
    fileName: string;
    fileSize: number;
    uploadedBy: mongoose.Types.ObjectId;
    uploaderName: string;
    createdAt: Date;
    updatedAt: Date;
}

const meetingSchema = new Schema<IMeeting>(
    {
        title: {
            type: String,
            required: [true, 'Meeting title is required'],
            trim: true,
            maxlength: [100, 'Title cannot exceed 100 characters']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters']
        },
        summary: {
            type: String,
            trim: true
        },
        actionItems: {
            type: [String],
            default: []
        },
        tags: {
            type: [String],
            default: []
        },
        internalTags: {
            type: [String],
            default: []
        },
        fileUrl: {
            type: String,
            required: [true, 'File URL is required']
        },
        fileName: {
            type: String,
            required: [true, 'File name is required']
        },
        fileSize: {
            type: Number,
            required: [true, 'File size is required']
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        uploaderName: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

meetingSchema.index({ createdAt: -1 });
meetingSchema.index({ uploadedBy: 1 });
meetingSchema.index({ tags: 1 });
meetingSchema.index({ internalTags: 1 });

export default mongoose.model<IMeeting>('Meeting', meetingSchema);