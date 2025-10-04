import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedEmail extends Document {
    messageId: string;
    emailDate: Date;
    userId: mongoose.Types.ObjectId;
    grantId: string;
    processedAt: Date;
}

const processedEmailSchema = new Schema<IProcessedEmail>(
    {
        messageId: {
            type: String,
            required: true,
            index: true
        },
        emailDate: {
            type: Date,
            required: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        grantId: {
            type: String,
            required: true
        },
        processedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Create compound index for efficient lookups
processedEmailSchema.index({ messageId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IProcessedEmail>('ProcessedEmail', processedEmailSchema);

