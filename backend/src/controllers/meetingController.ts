import Meeting from '../models/Meeting';
import { Request, Response } from 'express'; 
import { analyzeMeetingNotes } from '../services/openaiService';

/**
 * Get all meetings sorted by creation date
 */
export const getAllMeetings = async (req: Request, res: Response): Promise<void> => {
    try {
        const meetings = await Meeting.find()
            .sort({ createdAt: -1 })
            .select('title description summary actionItems fileName fileSize fileUrl uploaderName createdAt');
        
        res.status(200).json(meetings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching meetings', error });
    }
};

/**
 * Get a single meeting by ID
 */
export const getMeetingById = async (req: Request, res: Response): Promise<void> => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        
        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        res.status(200).json(meeting);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching meeting', error });
    }
};

/**
 * Create a new meeting by uploading and analyzing meeting notes
 */
export const createMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { fileUrl, fileName, fileSize, fileContent } = req.body;

        if (!fileUrl || !fileName || !fileSize || !fileContent) {
            res.status(400).json({ message: 'File URL, file name, file size, and file content are required' });
            return;
        }

        let analysis;
        try {
            analysis = await analyzeMeetingNotes(fileContent);
        } catch (error) {
            console.error('Error analyzing meeting notes:', error);
            res.status(500).json({ message: 'Failed to analyze meeting notes with AI' });
            return;
        }

        const newMeeting = new Meeting({
            title: analysis.title,
            description: analysis.description,
            summary: analysis.summary,
            actionItems: analysis.actionItems,
            fileUrl,
            fileName,
            fileSize,
            uploadedBy: user.id,
            uploaderName: user.name
        });

        const savedMeeting = await newMeeting.save();
        res.status(201).json(savedMeeting);
    } catch (error: any) {
        res.status(400).json({ message: 'Error creating meeting', error: error.message });
    }
};

/**
 * Update meeting title and description with authorization check
 */
export const updateMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { title, description } = req.body;

        const meeting = await Meeting.findById(req.params.id);
        
        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        if (meeting.uploadedBy.toString() !== user.id && user.role !== 'organisation') {
            res.status(403).json({ message: 'Not authorized to update this meeting' });
            return;
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;

        const updatedMeeting = await Meeting.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedMeeting);
    } catch (error) {
        res.status(400).json({ message: 'Error updating meeting', error });
    }
};

/**
 * Delete a meeting with authorization check
 */
export const deleteMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        if (meeting.uploadedBy.toString() !== user.id && user.role !== 'organisation') {
            res.status(403).json({ message: 'Not authorized to delete this meeting' });
            return;
        }

        await Meeting.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Meeting deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting meeting', error });
    }
};

/**
 * Debug endpoint to verify meeting data format and storage
 */
export const debugMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        
        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        res.json({
            id: meeting._id,
            title: meeting.title,
            fileUrlPrefix: meeting.fileUrl?.substring(0, 50),
            fileUrlLength: meeting.fileUrl?.length,
            hasValidFormat: meeting.fileUrl?.startsWith('data:text/plain;base64,'),
            fileSize: meeting.fileSize
        });
    } catch (error) {
        res.status(500).json({ message: 'Error debugging meeting', error });
    }
};