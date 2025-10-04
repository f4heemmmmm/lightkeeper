import { Request, Response } from 'express';
import { manualScanForUser } from '../services/emailSchedulerService';
import ProcessedEmail from '../models/ProcessedEmail';
import { fetchEmailById } from '../services/nylasService';
import { extractTaskFromEmail } from '../services/openaiService';
import Task from '../models/Task';
import User from '../models/User';

/**
 * Helper function to match assignee name to a user ID
 */
async function findUserByName(assigneeName: string | undefined): Promise<string | null> {
    if (!assigneeName) return null;
    
    try {
        const nameLower = assigneeName.toLowerCase().trim();
        
        // Find all members (not organization accounts)
        const users = await User.find({ role: 'member' });
        
        // Try to match by full name, first name, or last name
        for (const user of users) {
            const userNameLower = user.name.toLowerCase().trim();
            const nameParts = userNameLower.split(' ');
            
            // Exact match
            if (userNameLower === nameLower) {
                console.log(`[Assignment] ✓ Matched "${assigneeName}" to user: ${user.name} (${user.email})`);
                return user.id;
            }
            
            // First name match
            if (nameParts.length > 0 && nameParts[0] === nameLower) {
                console.log(`[Assignment] ✓ Matched "${assigneeName}" to user by first name: ${user.name} (${user.email})`);
                return user.id;
            }
            
            // Last name match
            if (nameParts.length > 1 && nameParts[nameParts.length - 1] === nameLower) {
                console.log(`[Assignment] ✓ Matched "${assigneeName}" to user by last name: ${user.name} (${user.email})`);
                return user.id;
            }
            
            // Partial match (name contains the search term)
            if (userNameLower.includes(nameLower)) {
                console.log(`[Assignment] ✓ Matched "${assigneeName}" to user by partial match: ${user.name} (${user.email})`);
                return user.id;
            }
        }
        
        console.log(`[Assignment] ✗ No user found matching "${assigneeName}"`);
        return null;
    } catch (error) {
        console.error(`[Assignment] Error finding user by name "${assigneeName}":`, error);
        return null;
    }
}

/**
 * Get organization members for task assignment
 */
async function getOrganizationMembers(): Promise<Array<{name: string, email: string}>> {
    try {
        const members = await User.find({ role: 'member' })
            .select('name email')
            .sort({ name: 1 });
        
        return members.map(m => ({ name: m.name, email: m.email }));
    } catch (error) {
        console.error('[Assignment] Error fetching organization members:', error);
        return [];
    }
}

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

        // Get organization members if user is an organization account
        let organizationMembers: Array<{name: string, email: string}> = [];
        if (user.role === 'organisation') {
            organizationMembers = await getOrganizationMembers();
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
            emailFrom,
            user.role === 'organisation' ? organizationMembers : undefined
        );

        if (!extractedTask.hasTask || (extractedTask.confidence || 0) < 0.5) {
            res.status(200).json({
                message: 'No actionable task found in this email',
                taskData: extractedTask
            });
            return;
        }

        // Find the user ID if a name was extracted
        let assignedToId: string | null = null;
        if (extractedTask.assignedToName && user.role === 'organisation') {
            assignedToId = await findUserByName(extractedTask.assignedToName);
        }

        // Create the task
        const newTask = new Task({
            title: extractedTask.title,
            description: extractedTask.description,
            priority: extractedTask.priority || 'medium',
            dueDate: extractedTask.dueDate ? new Date(extractedTask.dueDate) : null,
            assignedTo: assignedToId,
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
            extractedData: {
                ...extractedTask,
                assignedToUserId: assignedToId
            }
        });
    } catch (error: any) {
        console.error('Error processing specific email:', error);
        res.status(500).json({ 
            message: 'Error processing email', 
            error: error.message 
        });
    }
};