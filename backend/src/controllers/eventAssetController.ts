import { Request, Response } from 'express';
import { generateEventAsset } from '../services/geminiImageService';
import EventAsset from '../models/EventAsset';
import OrganizationLogo from '../models/OrganizationLogo';
import Meeting from '../models/Meeting';
import User from '../models/User';

/**
 * Generate an event asset (poster, invite, etc.)
 */
export const generateAsset = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        const { meetingId, assetType } = req.body;

        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        if (!meetingId || !assetType) {
            res.status(400).json({ message: 'Meeting ID and asset type are required' });
            return;
        }

        console.log(`[Asset Controller] Generating ${assetType} for meeting ${meetingId}`);

        // Get meeting details
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Get active logo if exists
        const logo = await OrganizationLogo.findOne({
            userId,
            isActive: true
        }).sort({ createdAt: -1 });

        // Format meeting date if available
        let meetingDate = '';
        if (meeting.createdAt) {
            const date = new Date(meeting.createdAt);
            meetingDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Generate the asset
        const generatedAsset = await generateEventAsset({
            meetingTitle: meeting.title,
            meetingDescription: meeting.description,
            meetingDate,
            assetType: assetType as 'poster' | 'invite' | 'social-media' | 'banner',
            logoBase64: logo?.logoData,
            organizationName: user.name
        });

        // Save to database
        const eventAsset = new EventAsset({
            meetingId,
            assetType,
            imageData: generatedAsset.imageBase64,
            mimeType: generatedAsset.mimeType,
            createdBy: userId
        });

        await eventAsset.save();

        console.log(`[Asset Controller] ✅ Asset generated and saved: ${eventAsset._id}`);

        res.status(200).json({
            message: 'Asset generated successfully',
            asset: {
                _id: eventAsset._id,
                meetingId: eventAsset.meetingId,
                assetType: eventAsset.assetType,
                imageData: `data:${eventAsset.mimeType};base64,${eventAsset.imageData}`,
                createdAt: eventAsset.createdAt
            }
        });
    } catch (error: any) {
        console.error('[Asset Controller] Error generating asset:', error);
        res.status(500).json({
            message: 'Failed to generate asset',
            error: error.message
        });
    }
};

/**
 * Get all assets for a meeting
 */
export const getMeetingAssets = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        const { meetingId } = req.params;

        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const assets = await EventAsset.find({ meetingId })
            .sort({ createdAt: -1 })
            .select('assetType mimeType createdAt');

        // Return assets with data URLs
        const assetsWithData = await Promise.all(
            assets.map(async (asset) => {
                const fullAsset = await EventAsset.findById(asset._id);
                return {
                    _id: asset._id,
                    meetingId: asset.meetingId,
                    assetType: asset.assetType,
                    imageData: `data:${asset.mimeType};base64,${fullAsset?.imageData}`,
                    createdAt: asset.createdAt
                };
            })
        );

        res.status(200).json({ assets: assetsWithData });
    } catch (error: any) {
        console.error('[Asset Controller] Error fetching assets:', error);
        res.status(500).json({
            message: 'Failed to fetch assets',
            error: error.message
        });
    }
};

/**
 * Revise an existing asset with new instructions
 */
export const reviseAsset = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        const { assetId, revisionInstructions } = req.body;

        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        if (!assetId || !revisionInstructions) {
            res.status(400).json({ message: 'Asset ID and revision instructions are required' });
            return;
        }

        console.log(`[Asset Controller] Revising asset ${assetId}`);

        // Get the existing asset
        const existingAsset = await EventAsset.findById(assetId);
        if (!existingAsset) {
            res.status(404).json({ message: 'Asset not found' });
            return;
        }

        // Check if user owns this asset
        if (existingAsset.createdBy.toString() !== userId) {
            res.status(403).json({ message: 'Not authorized to revise this asset' });
            return;
        }

        // Get meeting details
        const meeting = await Meeting.findById(existingAsset.meetingId);
        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Get active logo if exists
        const logo = await OrganizationLogo.findOne({
            userId,
            isActive: true
        }).sort({ createdAt: -1 });

        // Format meeting date if available
        let meetingDate = '';
        if (meeting.createdAt) {
            const date = new Date(meeting.createdAt);
            meetingDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Generate revised asset with the same type but new instructions
        const generatedAsset = await generateEventAsset({
            meetingTitle: meeting.title,
            meetingDescription: meeting.description,
            meetingDate,
            assetType: existingAsset.assetType,
            logoBase64: logo?.logoData,
            organizationName: user.name,
            revisionInstructions
        });

        // Update the existing asset
        existingAsset.imageData = generatedAsset.imageBase64;
        existingAsset.mimeType = generatedAsset.mimeType;
        await existingAsset.save();

        console.log(`[Asset Controller] ✅ Asset revised: ${existingAsset._id}`);

        res.status(200).json({
            message: 'Asset revised successfully',
            asset: {
                _id: existingAsset._id,
                meetingId: existingAsset.meetingId,
                assetType: existingAsset.assetType,
                imageData: `data:${existingAsset.mimeType};base64,${existingAsset.imageData}`,
                createdAt: existingAsset.createdAt
            }
        });
    } catch (error: any) {
        console.error('[Asset Controller] Error revising asset:', error);
        res.status(500).json({
            message: 'Failed to revise asset',
            error: error.message
        });
    }
};

/**
 * Delete an asset
 */
export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        const { assetId } = req.params;

        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const asset = await EventAsset.findById(assetId);
        if (!asset) {
            res.status(404).json({ message: 'Asset not found' });
            return;
        }

        // Check if user owns this asset
        if (asset.createdBy.toString() !== userId) {
            res.status(403).json({ message: 'Not authorized to delete this asset' });
            return;
        }

        await EventAsset.findByIdAndDelete(assetId);

        console.log(`[Asset Controller] Asset deleted: ${assetId}`);
        res.status(200).json({ message: 'Asset deleted successfully' });
    } catch (error: any) {
        console.error('[Asset Controller] Error deleting asset:', error);
        res.status(500).json({
            message: 'Failed to delete asset',
            error: error.message
        });
    }
};

/**
 * Upload organization logo
 */
export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        const { logoData, fileName, mimeType, fileSize } = req.body;

        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        if (!logoData || !fileName) {
            res.status(400).json({ message: 'Logo data and filename are required' });
            return;
        }

        console.log(`[Asset Controller] Uploading logo for user ${userId}`);

        // Deactivate previous logos
        await OrganizationLogo.updateMany(
            { userId, isActive: true },
            { isActive: false }
        );

        // Create new logo
        const logo = new OrganizationLogo({
            userId,
            logoData,
            mimeType: mimeType || 'image/png',
            fileName,
            fileSize: fileSize || logoData.length,
            isActive: true
        });

        await logo.save();

        console.log(`[Asset Controller] ✅ Logo uploaded: ${logo._id}`);

        res.status(200).json({
            message: 'Logo uploaded successfully',
            logo: {
                _id: logo._id,
                fileName: logo.fileName,
                createdAt: logo.createdAt
            }
        });
    } catch (error: any) {
        console.error('[Asset Controller] Error uploading logo:', error);
        res.status(500).json({
            message: 'Failed to upload logo',
            error: error.message
        });
    }
};

/**
 * Get active logo
 */
export const getActiveLogo = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const logo = await OrganizationLogo.findOne({
            userId,
            isActive: true
        }).sort({ createdAt: -1 });

        if (!logo) {
            res.status(404).json({ message: 'No active logo found' });
            return;
        }

        res.status(200).json({
            logo: {
                _id: logo._id,
                fileName: logo.fileName,
                imageData: `data:${logo.mimeType};base64,${logo.logoData}`,
                createdAt: logo.createdAt
            }
        });
    } catch (error: any) {
        console.error('[Asset Controller] Error fetching logo:', error);
        res.status(500).json({
            message: 'Failed to fetch logo',
            error: error.message
        });
    }
};

