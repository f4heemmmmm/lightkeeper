import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface MeetingAnalysis {
    title: string;
    description: string;
    summary: string;
    actionItems: string[];
}

/**
 * Analyze meeting notes/transcript using OpenAI to extract structured information
 */
export const analyzeMeetingNotes = async (content: string): Promise<MeetingAnalysis> => {
    try {
        const systemPrompt = `### Instruction ###
You are an AI assistant specialized in analyzing meeting transcripts and notes. 
Your task is to extract and structure key information into a JSON object. 
You MUST follow the requirements exactly.

### Requirements ###
1. Generate output in valid JSON with the following structure:
{
  "title": "string, max 100 characters",
  "description": "string, max 500 characters",
  "summary": "string, comprehensive but concise summary of the meeting",
  "actionItems": ["array of specific, actionable tasks"]
}

2. Extraction priorities:
- "title": Concise, descriptive, and reflective of the meeting's primary purpose (avoid generic titles like "Team Meeting").
- "description": Brief overview highlighting outcomes and decisions (not just topics discussed).
- "summary": Prioritize decisions made, agreements, and conclusions over general discussions.
- "actionItems": MUST contain only specific, assignable tasks. Include WHO does WHAT by WHEN (if present). 
   - Exclude vague, aspirational, or open-ended ideas unless explicitly assigned.
   - Distinguish between "discussed" and "agreed to do."
   - If no clear commitments exist, output an empty array.

3. Robustness requirements:
- Handle various input styles (structured agendas, transcripts, bullet notes, timestamps).
- Work with incomplete information (missing attendees or unclear phrasing).
- Infer implicit action items only if they clearly represent commitments.
- Ignore off-topic conversations, parking lot items, and exploratory brainstorming.

4. Edge Cases:
- If no action items exist, return "actionItems": [].
- Support meetings with multiple topics or follow-up vs new tasks.
- Ignore future considerations unless converted into commitments.

### Output Rules ###
- JSON must be strictly valid (no trailing commas).
- "actionItems" entries should be clear task statements.
- Do not fabricate details if missing.
- Each action item should be a complete, standalone statement.

### Critical Guidelines for Action Items ###
Action items are THE MOST IMPORTANT part of this analysis. Follow these rules strictly:
- Only extract items where someone explicitly agreed to take action
- Look for commitment language: "I'll...", "We'll...", "X will...", "Let's make sure to..."
- Include deadline information if mentioned: "by Friday", "before the next meeting", "this week"
- Include assignee if mentioned: "Sarah will...", "John agreed to..."
- Format: "[Person] will [action] [by when]" or "[Action] [by when]" if person unknown
- If an item lacks a clear owner or action, it's likely NOT an action item
- Discussion points, questions raised, or ideas mentioned are NOT action items unless someone commits to them

Examples of VALID action items:
- "Sarah will send the budget proposal by Friday"
- "Follow up with the client about contract terms by end of week"
- "Schedule the Q2 planning meeting"
- "Review the updated design mockups before next Wednesday"

Examples of INVALID action items (do NOT include these):
- "We discussed the new marketing strategy" (discussion, not action)
- "Consider updating the website" (aspirational, no commitment)
- "It would be good to improve response times" (vague desire, not committed task)
- "What about the vendor contracts?" (question, not action)

### Output Primer ###
Begin your response with:
{
  "title":`;

        const userPrompt = `Analyze the following meeting notes and extract the required information:

${content}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ],
            temperature: 0.3,
            max_tokens: 2500,
            response_format: { type: 'json_object' }
        });

        const result = response.choices[0].message.content;
        if (!result) {
            throw new Error('No response from OpenAI');
        }

        const analysis: MeetingAnalysis = JSON.parse(result);

        analysis.title = analysis.title.substring(0, 100);
        analysis.description = analysis.description.substring(0, 500);

        if (!Array.isArray(analysis.actionItems)) {
            analysis.actionItems = [];
        }

        return analysis;
    } catch (error) {
        console.error('Error analyzing meeting notes:', error);
        throw new Error('Failed to analyze meeting notes');
    }
};

export interface ExtractedTask {
    hasTask: boolean;
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: string; // ISO date string if found
    confidence?: number; // 0-1 confidence score
}

/**
 * Analyze an email to extract task information using OpenAI
 * @param emailSubject - The subject line of the email
 * @param emailBody - The body content of the email
 * @param emailFrom - Who sent the email
 */
export const extractTaskFromEmail = async (
    emailSubject: string,
    emailBody: string,
    emailFrom?: string
): Promise<ExtractedTask> => {
    try {
        console.log('[OpenAI] Analyzing email for tasks...');
        console.log('[OpenAI] Subject:', emailSubject);
        console.log('[OpenAI] From:', emailFrom);
        console.log('[OpenAI] Body length:', emailBody.length);
        
        // Get current date for context when interpreting relative dates
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentDateTime = now.toISOString();
        
        console.log('[OpenAI] Current date for context:', currentDate);
        
        const systemPrompt = `### Instruction ###
You are an AI assistant specialized in analyzing emails to identify actionable tasks.
Your task is to determine if an email contains a task or action item, and if so, extract structured task information.

### Requirements ###
1. Generate output in valid JSON with the following structure:
{
  "hasTask": boolean,
  "title": "string, max 100 characters (only if hasTask is true)",
  "description": "string, max 500 characters (only if hasTask is true)",
  "priority": "low" | "medium" | "high" (only if hasTask is true)",
  "dueDate": "ISO date string if mentioned, null otherwise",
  "confidence": number between 0 and 1
}

2. Task identification criteria:
- Look for explicit requests, assignments, or calls to action
- Common indicators: "please", "can you", "need you to", "by [date]", "deadline", "urgent", "asap"
- Distinguish between informational emails and actionable requests
- Calendar invites, meeting requests, and RSVPs can be tasks if they require action
- Follow-up requests are tasks

3. Task extraction priorities:
- "title": Create a clear, concise task title that captures the main action (e.g., "Review Q4 budget proposal", "Send contract to client")
- "description": Provide a comprehensive summary including:
  * What needs to be done
  * Key context from the email
  * Any specific requirements or details
  * Why this matters (if mentioned)
  * Note: Keep it clear and actionable
- "priority": CRITICAL - Carefully assess and justify priority based on:
  - "high": Urgent language (ASAP, urgent, critical, STAT), tight deadlines (today, tomorrow, by end of day), executive/VIP requests, time-sensitive business impact, explicit urgency markers
  - "medium": Standard business requests, reasonable timeframes (this week, next few days), normal work priority, some time sensitivity but not critical
  - "low": No deadline mentioned, routine tasks, informational with optional action, flexible timing, no urgency indicators, "when you get a chance" type requests
- "dueDate": CRITICAL - Only extract dates that are EXPLICITLY mentioned in the email
  - DO NOT make up or assume dates if not mentioned
  - DO NOT generate arbitrary future dates
  - If NO date is mentioned, set to null
  - If a date IS mentioned, convert to ISO format (YYYY-MM-DD)
  - For relative dates (e.g., "Friday", "tomorrow", "next week"), use the current date provided to calculate the actual date
  - For partial dates (e.g., "the 15th" without month), use current month/year to complete it
  - Examples:
    * "by Friday" → Calculate which Friday is next from current date
    * "tomorrow" → Current date + 1 day
    * "next Monday" → Calculate next Monday from current date
    * "by the 15th" → Use current month and year, day 15
    * "by December 25th" → Use current year, December 25
    * "NO MENTION" → null (DO NOT GENERATE)
- "confidence": How confident you are this is a VALID, ACTIONABLE task (0.0-1.0)
  - 0.9-1.0: Clear action request with explicit assignment, definite task
  - 0.7-0.89: Strong indicators of task but some ambiguity
  - 0.5-0.69: Possible task but could be informational
  - Below 0.5: Likely not a task (set hasTask to false)
  
### CRITICAL DECISION LOGIC ###
Before setting hasTask to true, ask yourself:
1. Is there a clear action required?
2. Is someone being asked/told to do something?
3. Is this actionable (not just informational)?
4. Can this be completed as a specific task?

If ALL answers are YES → hasTask = true (with appropriate confidence)
If ANY answer is NO → hasTask = false

Only valid, actionable tasks should result in hasTask = true.

4. Edge cases and exclusions:
- Newsletter updates, marketing emails, automated notifications: NOT tasks
- FYI/informational emails with no action required: NOT tasks
- Replies that are just acknowledgments: NOT tasks
- Calendar invites: ARE tasks if they require confirmation or preparation
- Email threads: Focus on the most recent message's intent

5. Examples of VALID tasks:
- "Can you review the attached proposal by Friday?"
- "Please send me the updated contract"
- "Need you to follow up with the client about payment"
- "Reminder: Submit your timesheet by EOD"
- "Could you prepare the presentation for Monday's meeting?"

6. Examples of NOT tasks:
- "Thanks for the update" (acknowledgment)
- "FYI - here's the latest report" (informational)
- "Weekly newsletter: Top 10 tips" (newsletter)
- "Your order has shipped" (notification)
- "Just checking in to say hi" (casual conversation)

### Output Rules ###
- JSON must be strictly valid
- If hasTask is false, you may omit title, description, priority, and dueDate
- If hasTask is true, title and description are required
- Use the email sender's name/context when helpful for clarity
- NEVER fabricate information; extract only what's explicitly stated or clearly implied
- MOST IMPORTANT: Do NOT invent due dates. Only extract dates explicitly mentioned in the email
- If no deadline is mentioned, dueDate MUST be null

### Output Primer ###
Begin your response with:
{
  "hasTask":`;

        const userPrompt = `Analyze the following email and determine if it contains a task.

IMPORTANT: Today's date is ${currentDate} (${currentDateTime}). Use this to interpret any relative dates mentioned in the email.

From: ${emailFrom || 'Unknown'}
Subject: ${emailSubject}

Body:
${emailBody}

DECISION CHECKLIST:
1. Does this email contain a VALID, ACTIONABLE task? (hasTask: true/false)
2. If YES, how confident are you? (confidence: 0.0-1.0)
3. What is the priority level based on urgency/importance? (priority: low/medium/high)
4. Is there an explicit deadline mentioned? (dueDate: null or YYYY-MM-DD)

Remember: 
- Only set hasTask=true for VALID, ACTIONABLE tasks
- Only extract dates that are EXPLICITLY mentioned in the email
- If no deadline/date is mentioned, set dueDate to null
- Use today's date (${currentDate}) to calculate relative dates like "Friday", "tomorrow", "next week", etc.
- For partial dates like "the 15th", use the current month/year to complete the date
- Provide a clear, comprehensive description that includes all relevant context`;

        console.log('[OpenAI] Sending request to GPT-4o-mini...');
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ],
            temperature: 0.2,
            max_tokens: 1000,
            response_format: { type: 'json_object' }
        });

        console.log('[OpenAI]  Received response from GPT');
        const result = response.choices[0].message.content;
        if (!result) {
            console.error('[OpenAI]  No content in response');
            throw new Error('No response from OpenAI');
        }

        console.log('[OpenAI] Raw response:', result);
        const extracted: ExtractedTask = JSON.parse(result);
        console.log('[OpenAI] Parsed result:', JSON.stringify(extracted, null, 2));

        // Validate and sanitize
        if (extracted.hasTask) {
            console.log('[OpenAI]  VALID TASK DETECTED!');
            console.log('[OpenAI] Decision Details:');
            console.log(`  - Confidence: ${extracted.confidence || 0} (threshold: 0.5)`);
            console.log(`  - Priority: ${extracted.priority || 'medium'}`);
            console.log(`  - Has Deadline: ${extracted.dueDate ? 'Yes' : 'No'}`);
            
            if (!extracted.title || !extracted.description) {
                // If marked as hasTask but missing required fields, treat as no task
                console.log('[OpenAI]  Task missing required fields, treating as INVALID');
                return { hasTask: false, confidence: 0 };
            }

            // Check confidence threshold
            if ((extracted.confidence || 0) < 0.5) {
                console.log(`[OpenAI]  Confidence too low (${extracted.confidence}), treating as INVALID`);
                return { hasTask: false, confidence: extracted.confidence || 0 };
            }

            extracted.title = extracted.title.substring(0, 100);
            extracted.description = extracted.description.substring(0, 500);
            
            // Validate priority
            if (!['low', 'medium', 'high'].includes(extracted.priority || '')) {
                console.log('[OpenAI]  Invalid priority, defaulting to medium');
                extracted.priority = 'medium';
            }
            
            // Log date extraction result
            if (extracted.dueDate) {
                console.log(`[OpenAI] Due date extracted: ${extracted.dueDate}`);
            } else {
                console.log('[OpenAI] No due date mentioned in email');
            }
            
            console.log('[OpenAI] Task validation PASSED - Will create task');
            console.log(`[OpenAI] Task Summary: "${extracted.title}" [${extracted.priority} priority]`);
        } else {
            console.log('[OpenAI] NO VALID TASK detected in email');
            console.log(`[OpenAI] Reason: Email is informational, not actionable, or confidence too low`);
        }

        return extracted;
    } catch (error) {
        console.error('[OpenAI]  Error extracting task from email:', error);
        if (error instanceof Error) {
            console.error('[OpenAI] Error stack:', error.stack);
        }
        throw new Error('Failed to extract task from email');
    }
};