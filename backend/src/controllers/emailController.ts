import { Request, Response } from 'express';
import { manualScanForUser } from '../services/emailSchedulerService';
import ProcessedEmail from '../models/ProcessedEmail';
import { fetchEmailById } from '../services/nylasService';
import { extractTaskFromEmail } from '../services/openaiService';
import Task from '../models/Task';

/**
 * Scan emails for new messages and extract tasks
 * This endpoint allows manual triggering of email scan for the authenticated user
 */
export const scanEmails = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { grantId } = req.body;

        console.log('=== MANUAL EMAIL SCAN TRIGGERED ===');
        console.log('User ID:', user.id);
        console.log('User Email:', user.email);
        console.log('User Role:', user.role);
        console.log('Grant ID:', grantId);

        if (!grantId) {
            console.log('ERROR: No grant ID provided');
            res.status(400).json({ message: 'Grant ID is required' });
            return;
        }

        // Use the scheduler service for consistency
        const result = await manualScanForUser(user.id, grantId);

        res.status(200).json({
            message: 'Email scan completed',
            results: {
                totalScanned: result.totalScanned,
                tasksFound: result.tasksFound,
                tasksCreated: result.tasksCreated,
                errors: result.errors
            }
        });
    } catch (error: any) {
        console.error('Error in manual email scan:', error);
        res.status(500).json({ 
            message: 'Error scanning emails', 
            error: error.message 
        });
    }
};

/**
 * Get email scanning statistics for the user
 */
export const getScanStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        const totalProcessed = await ProcessedEmail.countDocuments({
            userId: user.id
        });

        const lastProcessed = await ProcessedEmail.findOne({
            userId: user.id
        }).sort({ processedAt: -1 });

        res.status(200).json({
            totalEmailsProcessed: totalProcessed,
            lastProcessedAt: lastProcessed?.processedAt || null,
            lastEmailDate: lastProcessed?.emailDate || null
        });
    } catch (error: any) {
        console.error('Error fetching scan stats:', error);
        res.status(500).json({ 
            message: 'Error fetching scan statistics', 
            error: error.message 
        });
    }
};

/**
 * Manual trigger to process a specific email by ID
 */
export const processSpecificEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { grantId, messageId } = req.body;

        if (!grantId || !messageId) {
            res.status(400).json({ message: 'Grant ID and Message ID are required' });
            return;
        }

        // Fetch the specific email
        const email = await fetchEmailById(grantId, messageId);

        // Extract body text
        const emailBody = email.body || email.snippet || '';
        const emailFrom = email.from && email.from.length > 0 
            ? (email.from[0].name || email.from[0].email) 
            : 'Unknown';

        // Use GPT to check if there's a task
        const extractedTask = await extractTaskFromEmail(
            email.subject,
            emailBody,
            emailFrom
        );

        if (!extractedTask.hasTask || (extractedTask.confidence || 0) < 0.5) {
            res.status(200).json({
                message: 'No actionable task found in this email',
                taskData: extractedTask
            });
            return;
        }

        // Create the task
        const newTask = new Task({
            title: extractedTask.title,
            description: extractedTask.description,
            priority: extractedTask.priority || 'medium',
            dueDate: extractedTask.dueDate ? new Date(extractedTask.dueDate) : null,
            assignedTo: null,
            isPrivate: user.role === 'member',
            createdBy: user.id,
            status: 'pending'
        });

        const savedTask = await newTask.save();

        // Mark email as processed
        await ProcessedEmail.create({
            messageId: email.id,
            emailDate: new Date(email.date * 1000),
            userId: user.id,
            grantId: grantId
        });

        res.status(201).json({
            message: 'Task created successfully from email',
            task: savedTask,
            extractedData: extractedTask
        });
    } catch (error: any) {
        console.error('Error processing specific email:', error);
        res.status(500).json({ 
            message: 'Error processing email', 
            error: error.message 
        });
    }
};
