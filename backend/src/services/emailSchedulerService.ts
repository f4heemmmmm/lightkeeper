import { fetchEmails, fetchEmailById } from './nylasService';
import { extractTaskFromEmail } from './openaiService';
import ProcessedEmail from '../models/ProcessedEmail';
import Task from '../models/Task';
import User from '../models/User';

// Configurable scan interval in minutes (default: 1 minute)
const SCAN_INTERVAL_MINUTES = parseInt(process.env.EMAIL_SCAN_INTERVAL_MINUTES || '1', 10);
const NYLAS_GRANT_ID = process.env.NYLAS_GRANT_ID;

interface ScanResult {
    userId: string;
    userEmail: string;
    totalScanned: number;
    tasksFound: number;
    tasksCreated: number;
    errors: string[];
}

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
 * Scan emails for a specific user
 */
async function scanEmailsForUser(userId: string, grantId: string): Promise<ScanResult> {
    const result: ScanResult = {
        userId,
        userEmail: '',
        totalScanned: 0,
        tasksFound: 0,
        tasksCreated: 0,
        errors: []
    };

    try {
        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }

        result.userEmail = user.email;

        console.log(`[Scheduler] Scanning emails for user: ${user.email} (${user.role})`);

        // Get organization members for assignment matching (only for organization accounts)
        let organizationMembers: Array<{name: string, email: string}> = [];
        if (user.role === 'organisation') {
            organizationMembers = await getOrganizationMembers();
            console.log(`[Scheduler] Found ${organizationMembers.length} organization members for assignment matching`);
        }

        // Find the last processed email for this user and grant
        const lastProcessed = await ProcessedEmail.findOne({
            userId: userId,
            grantId: grantId
        }).sort({ emailDate: -1 });

        // Fetch emails received after the last processed email
        let receivedAfter: number | undefined;
        if (lastProcessed) {
            receivedAfter = Math.floor(lastProcessed.emailDate.getTime() / 1000);
            console.log(`[Scheduler] Fetching emails after: ${lastProcessed.emailDate.toISOString()}`);
        } else {
            console.log('[Scheduler] No previously processed emails - fetching recent emails');
        }

        const emails = await fetchEmails(grantId, 50, receivedAfter);
        result.totalScanned = emails.length;

        if (emails.length === 0) {
            console.log('[Scheduler] No new emails to process');
            return result;
        }

        console.log(`[Scheduler] Processing ${emails.length} new emails...`);

        // Process each email
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            try {
                console.log(`[Scheduler] Email ${i + 1}/${emails.length}: ${email.subject}`);

                // Check if already processed
                const alreadyProcessed = await ProcessedEmail.findOne({
                    messageId: email.id,
                    userId: userId
                });

                if (alreadyProcessed) {
                    console.log('[Scheduler] Already processed, skipping...');
                    continue;
                }

                // Fetch full email details
                const fullEmail = await fetchEmailById(grantId, email.id);

                // Extract body text
                const emailBody = fullEmail.body || fullEmail.snippet || '';
                const emailFrom = fullEmail.from && fullEmail.from.length > 0 
                    ? (fullEmail.from[0].name || fullEmail.from[0].email) 
                    : 'Unknown';

                // Analyze with GPT (pass organization members if user is an organization account)
                const extractedTask = await extractTaskFromEmail(
                    fullEmail.subject,
                    emailBody,
                    emailFrom,
                    user.role === 'organisation' ? organizationMembers : undefined
                );

                // Mark as processed
                await ProcessedEmail.create({
                    messageId: email.id,
                    emailDate: new Date(email.date * 1000),
                    userId: userId,
                    grantId: grantId
                });

                // Create task if found with sufficient confidence
                if (extractedTask.hasTask && (extractedTask.confidence || 0) >= 0.5) {
                    result.tasksFound++;

                    console.log(`[Scheduler] ✓ Creating task from email...`);
                    console.log(`[Scheduler]   Title: "${extractedTask.title}"`);
                    console.log(`[Scheduler]   Priority: ${extractedTask.priority || 'medium'}`);
                    console.log(`[Scheduler]   Due Date: ${extractedTask.dueDate || 'None'}`);
                    console.log(`[Scheduler]   Confidence: ${extractedTask.confidence}`);
                    console.log(`[Scheduler]   Assigned To Name: ${extractedTask.assignedToName || 'Unassigned'}`);

                    // Find the user ID if a name was extracted
                    let assignedToId: string | null = null;
                    if (extractedTask.assignedToName && user.role === 'organisation') {
                        assignedToId = await findUserByName(extractedTask.assignedToName);
                        if (assignedToId) {
                            console.log(`[Scheduler]   ✓ Task will be assigned to user ID: ${assignedToId}`);
                        } else {
                            console.log(`[Scheduler]   ⚠ Could not find user matching "${extractedTask.assignedToName}", task will be unassigned`);
                        }
                    }

                    const newTask = new Task({
                        title: extractedTask.title,
                        description: extractedTask.description,
                        priority: extractedTask.priority || 'medium',
                        dueDate: extractedTask.dueDate ? new Date(extractedTask.dueDate) : null,
                        assignedTo: assignedToId,
                        isPrivate: user.role === 'member',
                        createdBy: userId,
                        status: 'pending'
                    });

                    await newTask.save();
                    result.tasksCreated++;
                    
                    const assignmentStatus = assignedToId ? `assigned to ${extractedTask.assignedToName}` : 'unassigned';
                    console.log(`[Scheduler] Task created successfully: "${extractedTask.title}" [${extractedTask.priority} priority, ${assignmentStatus}]`);
                } else {
                    console.log(`[Scheduler] ✗ Email does NOT contain valid task`);
                    console.log(`[Scheduler]   Reason: hasTask=${extractedTask.hasTask}, confidence=${extractedTask.confidence || 0}`);
                    if (!extractedTask.hasTask) {
                        console.log(`[Scheduler]   Decision: Email is informational/not actionable`);
                    } else if ((extractedTask.confidence || 0) < 0.5) {
                        console.log(`[Scheduler]   Decision: Confidence too low to create task`);
                    }
                }
            } catch (emailError: any) {
                const errorMsg = `Error processing email ${email.id}: ${emailError.message}`;
                console.error(`[Scheduler] ${errorMsg}`);
                result.errors.push(errorMsg);
            }
        }

        return result;
    } catch (error: any) {
        console.error(`[Scheduler] Error scanning emails for user ${userId}:`, error.message);
        result.errors.push(error.message);
        return result;
    }
}

/**
 * Scan emails for all users
 */
async function scanAllUsers(): Promise<void> {
    const scanStartTime = new Date();
    console.log('\n' + '='.repeat(80));
    console.log(`[Scheduler] AUTOMATED EMAIL SCAN STARTED`);
    console.log(`[Scheduler] Time: ${scanStartTime.toISOString()}`);
    console.log('='.repeat(80));

    try {
        if (!NYLAS_GRANT_ID) {
            console.error('[Scheduler] NYLAS_GRANT_ID not configured in environment variables');
            return;
        }

        // Get all users (you can filter by role or other criteria if needed)
        const users = await User.find({});
        
        if (users.length === 0) {
            console.log('[Scheduler] No users found in database');
            return;
        }

        console.log(`[Scheduler] Found ${users.length} user(s) to scan`);

        const results: ScanResult[] = [];

        // Scan emails for each user
        for (const user of users) {
            try {
                console.log(`\n[Scheduler] --- Scanning for user: ${user.email} ---`);
                const result = await scanEmailsForUser(user.id, NYLAS_GRANT_ID);
                results.push(result);
            } catch (error: any) {
                console.error(`[Scheduler] ✗ Failed to scan for user ${user.email}:`, error.message);
                results.push({
                    userId: user.id,
                    userEmail: user.email,
                    totalScanned: 0,
                    tasksFound: 0,
                    tasksCreated: 0,
                    errors: [error.message]
                });
            }
        }

        // Print summary
        const scanEndTime = new Date();
        const duration = (scanEndTime.getTime() - scanStartTime.getTime()) / 1000;
        
        console.log('\n' + '='.repeat(80));
        console.log('[Scheduler] SCAN SUMMARY');
        console.log('='.repeat(80));
        console.log(`Duration: ${duration.toFixed(2)} seconds`);
        console.log(`Users scanned: ${results.length}`);
        
        const totalScanned = results.reduce((sum, r) => sum + r.totalScanned, 0);
        const totalTasksFound = results.reduce((sum, r) => sum + r.tasksFound, 0);
        const totalTasksCreated = results.reduce((sum, r) => sum + r.tasksCreated, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

        console.log(`Total emails scanned: ${totalScanned}`);
        console.log(`Total tasks found: ${totalTasksFound}`);
        console.log(`Total tasks created: ${totalTasksCreated}`);
        console.log(`Total errors: ${totalErrors}`);

        // Per-user breakdown
        if (results.length > 0) {
            console.log('\nPer-user breakdown:');
            results.forEach(r => {
                console.log(`  • ${r.userEmail}:`);
                console.log(`      Scanned: ${r.totalScanned}, Created: ${r.tasksCreated}, Errors: ${r.errors.length}`);
            });
        }

        console.log('='.repeat(80));
        console.log(`[Scheduler] Next scan in ${SCAN_INTERVAL_MINUTES} minute(s)`);
        console.log('='.repeat(80) + '\n');

    } catch (error: any) {
        console.error('[Scheduler] ✗ Fatal error in email scanning:', error);
        console.error(error.stack);
    }
}

/**
 * Start the email scanning scheduler
 */
export function startEmailScheduler(): void {
    console.log('EMAIL SCANNING SCHEDULER INITIALIZED');
    console.log(`Scan interval: ${SCAN_INTERVAL_MINUTES} minute(s)`);
    console.log(`Grant ID: ${NYLAS_GRANT_ID ? '✓ Configured' : '✗ Not configured'}`);

    if (!NYLAS_GRANT_ID) {
        console.error('⚠ WARNING: NYLAS_GRANT_ID not set. Email scanning will not work.');
        console.error('⚠ Please set NYLAS_GRANT_ID in your .env file\n');
        return;
    }

    // Run first scan immediately
    console.log('[Scheduler] Running initial email scan...');
    scanAllUsers().catch(err => {
        console.error('[Scheduler] Error in initial scan:', err);
    });

    // Schedule recurring scans
    const intervalMs = SCAN_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => {
        scanAllUsers().catch(err => {
            console.error('[Scheduler] Error in scheduled scan:', err);
        });
    }, intervalMs);

    console.log(`[Scheduler] ✓ Scheduler active - running every ${SCAN_INTERVAL_MINUTES} minute(s)\n`);
}

/**
 * Manual trigger for email scan (for API endpoint)
 */
export async function manualScanForUser(userId: string, grantId: string): Promise<ScanResult> {
    console.log('[Manual Scan] Triggered manual scan for user:', userId);
    return await scanEmailsForUser(userId, grantId);
}