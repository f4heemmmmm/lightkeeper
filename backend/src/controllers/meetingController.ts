import Meeting from '../models/Meeting';
import Task from '../models/Task';
import User from '../models/User';
import { Request, Response } from 'express';
import { analyzeMeetingNotes, translateMeetingNotes } from '../services/openaiService';
import crypto from 'crypto';
import mongoose from 'mongoose';

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
 * Generate SHA-256 hash of file content
 */
const generateFileHash = (content: string): string => {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
};

/**
 * Check if a file with the same hash already exists
 */
const checkDuplicateFile = async (fileHash: string, userId: string): Promise<{ isDuplicate: boolean; existingMeeting?: any }> => {
    const existingMeeting = await Meeting.findOne({ 
        fileHash, 
        uploadedBy: userId 
    }).select('title fileName createdAt');
    
    return {
        isDuplicate: !!existingMeeting,
        existingMeeting
    };
};

/**
 * Get organization members for action item filtering
 */
async function getOrganizationMembers(): Promise<Array<{name: string, email: string}>> {
    try {
        const members = await User.find({ role: 'member' })
            .select('name email')
            .sort({ name: 1 });

        return members.map(m => ({ name: m.name, email: m.email }));
    } catch (error) {
        console.error('[Meeting Controller] Error fetching organization members:', error);
        return [];
    }
}

/**
 * Find user ID by name from organization members
 */
const findUserByName = async (assigneeName: string): Promise<string | null> => {
    if (!assigneeName) return null;
    
    try {
        const nameLower = assigneeName.toLowerCase().trim();
        
        // Find all members (not organization accounts)
        const users = await User.find({ role: 'member' });
        
        // Try exact name match first
        let matchedUser = users.find(user => 
            user.name.toLowerCase() === nameLower
        );
        
        // If no exact match, try partial matching
        if (!matchedUser) {
            matchedUser = users.find(user => {
                const userNameLower = user.name.toLowerCase();
                const userNameParts = userNameLower.split(' ');
                const assigneeNameParts = nameLower.split(' ');
                
                // Check if any part of the assignee name matches any part of user name
                return assigneeNameParts.some(assigneePart => 
                    userNameParts.some(userPart => 
                        userPart.includes(assigneePart) || assigneePart.includes(userPart)
                    )
                );
            });
        }
        
        return matchedUser ? (matchedUser._id as mongoose.Types.ObjectId).toString() : null;
    } catch (error) {
        console.error('Error finding user by name:', error);
        return null;
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
            : fileContent;

        // Generate hash of the file content
        const fileHash = generateFileHash(decodedContent);
        
        // Check for duplicate files
        const duplicateCheck = await checkDuplicateFile(fileHash, user.id);
        if (duplicateCheck.isDuplicate) {
            res.status(409).json({ 
                message: 'This file has already been uploaded',
                existingMeeting: {
                    title: duplicateCheck.existingMeeting.title,
                    fileName: duplicateCheck.existingMeeting.fileName,
                    uploadedAt: duplicateCheck.existingMeeting.createdAt
                }
            });
            return;
        }

        let analysis;
        try {
            // Get organization members for action item filtering (only for organization accounts)
            let organizationMembers: Array<{name: string, email: string}> = [];
            if (user.role === 'organisation') {
                organizationMembers = await getOrganizationMembers();
                console.log(`[Meeting Analysis] Found ${organizationMembers.length} organization members for action item filtering`);
            }

            analysis = await analyzeMeetingNotes(decodedContent, organizationMembers);
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
            fileHash,
            uploadedBy: user.id,
            uploaderName: user.name
        });

        const savedMeeting = await newMeeting.save();

        // Automatically create tasks from action items
        if (analysis.actionItems && analysis.actionItems.length > 0) {
            const tasks = [];
            
            for (const actionItem of analysis.actionItems) {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7); // Default 7 days
                
                let assignedToId: string | null = null;
                let finalDueDate: Date = dueDate;
                
                // If actionItem is an object with assignee and date info
                if (typeof actionItem === 'object' && actionItem !== null && 'task' in actionItem) {
                    const structuredItem = actionItem as {
                        task: string;
                        assignedToName?: string;
                        dueDate?: string;
                        dueDateTime?: string;
                    };
                    
                    // Find user ID if assignee is specified
                    if (structuredItem.assignedToName) {
                        assignedToId = await findUserByName(structuredItem.assignedToName);
                    }
                    
                    // Use specified due date if available
                    if (structuredItem.dueDateTime) {
                        finalDueDate = new Date(structuredItem.dueDateTime);
                    } else if (structuredItem.dueDate) {
                        finalDueDate = new Date(structuredItem.dueDate);
                    }
                    
                    const taskTitle = structuredItem.task.length > 100 ? 
                        structuredItem.task.substring(0, 97) + '...' : 
                        structuredItem.task;
                    
                    tasks.push(new Task({
                        title: taskTitle,
                        description: `Task created from meeting: "${savedMeeting.title}"\n\nOriginal action item: ${structuredItem.task}${structuredItem.assignedToName ? `\nAssigned to: ${structuredItem.assignedToName}` : ''}`,
                        priority: 'medium',
                        dueDate: finalDueDate,
                        assignedTo: assignedToId ? new mongoose.Types.ObjectId(assignedToId) : null,
                        isPrivate: false,
                        createdBy: new mongoose.Types.ObjectId(user.id),
                        status: 'pending',
                        source: 'meeting',
                        sourceMeetingId: savedMeeting._id
                    }));
                } else {
                    // Fallback for simple string action items
                    const actionItemString = typeof actionItem === 'string' ? actionItem : String(actionItem);
                    const taskTitle = actionItemString.length > 100 ? 
                        actionItemString.substring(0, 97) + '...' : 
                        actionItemString;
                    
                    tasks.push(new Task({
                        title: taskTitle,
                        description: `Task created from meeting: "${savedMeeting.title}"\n\nOriginal action item: ${actionItemString}`,
                        priority: 'medium',
                        dueDate: finalDueDate,
                        assignedTo: null,
                        isPrivate: false,
                        createdBy: new mongoose.Types.ObjectId(user.id),
                        status: 'pending',
                        source: 'meeting',
                        sourceMeetingId: savedMeeting._id
                    }));
                }
            }

            try {
                const createdTasks = await Task.insertMany(tasks);
                console.log(`Successfully created ${createdTasks.length} tasks from action items`);
            } catch (taskError) {
                console.error('Error creating tasks from action items:', taskError);
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

        // Find all meetings with action items (from both uploads and notetaker)
        const meetings = await Meeting.find({ 
            actionItems: { $exists: true, $ne: [] },
            uploadedBy: user.id 
        });

        let totalTasksCreated = 0;
        const results = [];

        for (const meeting of meetings) {
            if (meeting.actionItems && meeting.actionItems.length > 0) {
                console.log(`Processing meeting: ${meeting.title} with ${meeting.actionItems.length} action items`);
                
                // Check if tasks already exist for this meeting using sourceMeetingId
                const existingTasks = await Task.find({
                    sourceMeetingId: meeting._id
                });

                if (existingTasks.length > 0) {
                    console.log(`Tasks already migrated for meeting: ${meeting.title} (${existingTasks.length} tasks)`);
                    continue;
                }

                const tasks = [];
                
                for (const actionItem of meeting.actionItems) {
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + 7); // Default 7 days
                    
                    let assignedToId: string | null = null;
                    let finalDueDate: Date = dueDate;
                    
                    // If actionItem is an object with assignee and date info
                    if (typeof actionItem === 'object' && actionItem !== null && 'task' in actionItem) {
                        const structuredItem = actionItem as {
                            task: string;
                            assignedToName?: string;
                            dueDate?: string;
                            dueDateTime?: string;
                        };
                        
                        // Find user ID if assignee is specified
                        if (structuredItem.assignedToName) {
                            assignedToId = await findUserByName(structuredItem.assignedToName);
                        }
                        
                        // Use specified due date if available
                        if (structuredItem.dueDateTime) {
                            finalDueDate = new Date(structuredItem.dueDateTime);
                        } else if (structuredItem.dueDate) {
                            finalDueDate = new Date(structuredItem.dueDate);
                        }
                        
                        const taskTitle = structuredItem.task.length > 100 ? 
                            structuredItem.task.substring(0, 97) + '...' : 
                            structuredItem.task;
                        
                        tasks.push(new Task({
                            title: taskTitle,
                            description: `Task created from meeting: "${meeting.title}"\n\nOriginal action item: ${structuredItem.task}${structuredItem.assignedToName ? `\nAssigned to: ${structuredItem.assignedToName}` : ''}`,
                            priority: 'medium',
                            dueDate: finalDueDate,
                            assignedTo: assignedToId ? new mongoose.Types.ObjectId(assignedToId) : null,
                            isPrivate: false,
                            createdBy: new mongoose.Types.ObjectId(user.id),
                            status: 'pending',
                            source: 'meeting',
                            sourceMeetingId: meeting._id
                        }));
                    } else {
                        // Fallback for simple string action items
                        const actionItemString = typeof actionItem === 'string' ? actionItem : String(actionItem);
                        const taskTitle = actionItemString.length > 100 ? 
                            actionItemString.substring(0, 97) + '...' : 
                            actionItemString;
                        
                        tasks.push(new Task({
                            title: taskTitle,
                            description: `Task created from meeting: "${meeting.title}"\n\nOriginal action item: ${actionItemString}`,
                            priority: 'medium',
                            dueDate: finalDueDate,
                            assignedTo: null,
                            isPrivate: false,
                            createdBy: new mongoose.Types.ObjectId(user.id),
                            status: 'pending',
                            source: 'meeting',
                            sourceMeetingId: meeting._id
                        }));
                    }
                }

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
 * Delete a meeting with authorization check and cascade delete related tasks
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

        // Delete all tasks related to this meeting
        const deletedTasks = await Task.deleteMany({ sourceMeetingId: req.params.id });
        console.log(`Deleted ${deletedTasks.deletedCount} tasks related to meeting ${req.params.id}`);

        // Delete the meeting
        await Meeting.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: 'Meeting deleted successfully',
            deletedTasksCount: deletedTasks.deletedCount
        });
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
