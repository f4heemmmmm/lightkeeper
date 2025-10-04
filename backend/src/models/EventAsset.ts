import mongoose, { Document, Schema } from 'mongoose';

export interface IEventAsset extends Document {
    meetingId: mongoose.Types.ObjectId;
    assetType: 'poster' | 'invite' | 'social-media' | 'banner';
    imageData: string; // base64
    mimeType: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const eventAssetSchema = new Schema<IEventAsset>(
    {
        meetingId: {
            type: Schema.Types.ObjectId,
            ref: 'Meeting',
            required: true
        },
        assetType: {
            type: String,
            enum: ['poster', 'invite', 'social-media', 'banner'],
            required: true
        },
        imageData: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true,
            default: 'image/png'
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
);

eventAssetSchema.index({ meetingId: 1 });
eventAssetSchema.index({ createdBy: 1 });
eventAssetSchema.index({ assetType: 1 });

export default mongoose.model<IEventAsset>('EventAsset', eventAssetSchema);

