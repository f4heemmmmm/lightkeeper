import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganizationLogo extends Document {
    userId: mongoose.Types.ObjectId;
    logoData: string; // base64
    mimeType: string;
    fileName: string;
    fileSize: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const organizationLogoSchema = new Schema<IOrganizationLogo>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        logoData: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        fileName: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

organizationLogoSchema.index({ userId: 1 });
organizationLogoSchema.index({ isActive: 1 });

export default mongoose.model<IOrganizationLogo>('OrganizationLogo', organizationLogoSchema);

