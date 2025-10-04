import Meeting from '../models/Meeting';
import Task from '../models/Task';
import { Request, Response } from 'express'; 
import { analyzeMeetingNotes, translateMeetingNotes } from '../services/openaiService';

/**
 * Decode base64 content with proper UTF-8 handling
 */
const decodeFileContent = (fileContent: string): string => {
    try {
        const base64Content = fileContent.replace(/^data:text\/plain;base64,/, '');
        const buffer = Buffer.from(base64Content, 'base64');
        return buffer.toString('utf-8');
    } catch (error) {
        console.error('Error decoding file content:', error);
        return fileContent;
    }
};

/**
 * Get all meetings sorted by creation date
 */
export const getAllMeetings = async (req: Request, res: Response): Promise<void> => {
    try {
        const meetings = await Meeting.find()
            .sort({ createdAt: -1 })
            .select('title description summary actionItems tags internalTags fileName fileSize fileUrl uploaderName createdAt');
        
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

        const decodedContent = fileContent.startsWith('data:') 
            ? decodeFileContent(fileContent)
            : fileContent; // Use raw content if not base64
        let analysis;
        
        try {
            analysis = await analyzeMeetingNotes(decodedContent);
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
            tags: analysis.tags || [],
            internalTags: analysis.internalTags || [],
            fileUrl,
            fileName,
            fileSize,
            uploadedBy: user.id,
            uploaderName: user.name
        });

        const savedMeeting = await newMeeting.save();

        // Automatically create tasks from action items
        console.log('Action items from AI analysis:', analysis.actionItems);
        console.log('Action items count:', analysis.actionItems?.length || 0);
        
        if (analysis.actionItems && analysis.actionItems.length > 0) {
            console.log('Creating tasks from action items:', analysis.actionItems.length);
            
            const tasks = analysis.actionItems.map((actionItem, index) => {
                console.log(`Processing action item ${index + 1}:`, actionItem);
                
                // Set due date to 7 days from now by default
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7);
                
                const task = new Task({
                    title: actionItem.length > 100 ? actionItem.substring(0, 97) + '...' : actionItem,
                    description: `Task created from meeting: "${savedMeeting.title}"\n\nOriginal action item: ${actionItem}`,
                    priority: 'medium',
                    dueDate: dueDate,
                    assignedTo: null,
                    isPrivate: false,
                    createdBy: user.id,
                    status: 'pending'
                });
                
                console.log(`Created task object ${index + 1}:`, {
                    title: task.title,
                    description: task.description.substring(0, 100) + '...',
                    createdBy: task.createdBy
                });
                
                return task;
            });

            try {
                const createdTasks = await Task.insertMany(tasks);
                console.log(`Successfully created ${createdTasks.length} tasks from action items`);
                console.log('Created task IDs:', createdTasks.map((t: any) => t._id));
            } catch (taskError) {
                console.error('Error creating tasks from action items:', taskError);
                // Don't fail the meeting creation if task creation fails
            }
        }

        res.status(201).json(savedMeeting);
    } catch (error: any) {
        res.status(400).json({ message: 'Error creating meeting', error: error.message });
    }
};

/**
 * Create tasks from action items for existing meetings (migration function)
 */
export const createTasksFromExistingMeetings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        
        if (user.role !== 'organisation') {
            res.status(403).json({ message: 'Only organisation users can run this migration' });
            return;
        }

        // Find all meetings with action items that don't have corresponding tasks
        const meetings = await Meeting.find({ 
            actionItems: { $exists: true, $ne: [] },
            uploadedBy: user.id 
        });

        let totalTasksCreated = 0;
        const results = [];

        for (const meeting of meetings) {
            if (meeting.actionItems && meeting.actionItems.length > 0) {
                console.log(`Processing meeting: ${meeting.title} with ${meeting.actionItems.length} action items`);
                
                // Check if tasks already exist for this meeting
                const existingTasks = await Task.find({
                    description: { $regex: `Task created from meeting: "${meeting.title}"` }
                });

                if (existingTasks.length > 0) {
                    console.log(`Tasks already exist for meeting: ${meeting.title}`);
                    continue;
                }

                const tasks = meeting.actionItems.map((actionItem) => {
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + 7);
                    
                    return new Task({
                        title: actionItem.length > 100 ? actionItem.substring(0, 97) + '...' : actionItem,
                        description: `Task created from meeting: "${meeting.title}"\n\nOriginal action item: ${actionItem}`,
                        priority: 'medium',
                        dueDate: dueDate,
                        assignedTo: null,
                        isPrivate: false,
                        createdBy: user.id,
                        status: 'pending'
                    });
                });

                try {
                    const createdTasks = await Task.insertMany(tasks);
                    totalTasksCreated += createdTasks.length;
                    results.push({
                        meetingId: meeting._id,
                        meetingTitle: meeting.title,
                        tasksCreated: createdTasks.length
                    });
                    console.log(`Created ${createdTasks.length} tasks for meeting: ${meeting.title}`);
                } catch (taskError) {
                    console.error(`Error creating tasks for meeting ${meeting.title}:`, taskError);
                }
            }
        }

        res.status(200).json({
            message: `Migration completed. Created ${totalTasksCreated} tasks from ${results.length} meetings.`,
            totalTasksCreated,
            meetingsProcessed: results.length,
            results
        });
    } catch (error: any) {
        console.error('Error in migration:', error);
        res.status(500).json({ message: 'Error running migration', error: error.message });
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
/**
 * Translate meeting notes to a target language
 */
export const translateMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { targetLanguage } = req.body;

        if (!targetLanguage) {
            res.status(400).json({ message: 'Target language is required' });
            return;
        }

        console.log(`[Translation] Translating meeting ${id} to ${targetLanguage}`);

        const meeting = await Meeting.findById(id);
        
        if (!meeting) {
            res.status(404).json({ message: 'Meeting not found' });
            return;
        }

        // Translate the meeting notes
        const translation = await translateMeetingNotes(
            meeting.title,
            meeting.description || '',
            meeting.summary || '',
            meeting.actionItems || [],
            targetLanguage
        );

        console.log(`[Translation] Successfully translated meeting ${id}`);

        res.status(200).json({
            message: 'Translation completed successfully',
            translation: {
                title: translation.translatedTitle,
                description: translation.translatedDescription,
                summary: translation.translatedSummary,
                actionItems: translation.translatedActionItems,
                detectedSourceLanguage: translation.detectedSourceLanguage,
                targetLanguage: translation.targetLanguage
            }
        });
    } catch (error) {
        console.error('[Translation] Error translating meeting:', error);
        res.status(500).json({ 
            message: 'Error translating meeting', 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
