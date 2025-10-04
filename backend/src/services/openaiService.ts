import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface OrganizationMember {
    name: string;
    email: string;
}

export interface MeetingAnalysis {
    title: string;
    description: string;
    summary: string;
    actionItems: string[];
}

/**
 * Analyze meeting notes/transcript using OpenAI to extract structured information
 */
export const analyzeMeetingNotes = async (
    content: string,
    organizationMembers?: OrganizationMember[]
): Promise<MeetingAnalysis> => {
    try {
        // Build the member context for the AI
        const hasMemberContext = organizationMembers && organizationMembers.length > 0;
        const memberList = hasMemberContext 
            ? organizationMembers.map(m => `- ${m.name} (${m.email})`).join('\n')
            : '';

        const memberFilteringInstruction = hasMemberContext ? `

### CRITICAL: ORGANIZATION MEMBER FILTERING ###

**ONLY extract action items for these organization members:**
${memberList}

**FILTERING RULES:**
1. **Speaker Identification**: Carefully identify who is being assigned each task in the transcript
2. **Name Matching**: Match speaker names/identifiers to the organization members list above
   - Look for first names, last names, full names, or email addresses
   - Be flexible with variations (e.g., "John" matches "John Smith")
   - Check for informal names or nicknames that might refer to organization members
3. **EXCLUDE external participants**: If a task is assigned to someone NOT in the organization member list, DO NOT include it as an action item
4. **Unknown assignments**: If you cannot determine who a task is for, or if it's clearly for someone outside the organization, EXCLUDE it
5. **Group tasks**: If a task says "we" or "the team", only include it if it's clear organization members are involved
6. **Verification**: Before including each action item, verify the assignee is in the organization member list

**Example Decision Process:**
- Transcript says: "Sarah will send the proposal to the client"
- Check: Is "Sarah" in the organization member list?
- YES → Include: "Sarah will send the proposal to the client"
- NO → EXCLUDE this action item

- Transcript says: "John from Acme Corp will review the contract"  
- Check: Is "John" in the organization member list?
- NO (external vendor) → EXCLUDE this action item

**FORMAT for organization action items:**
When an organization member has an action item, format as:
"[Member Name] will [action] by [deadline]"

This ensures you only track tasks for YOUR team members, not external participants.` : '';

        const systemPrompt = `### Instruction ###
You are an AI assistant specialized in analyzing meeting transcripts and notes. 
Your task is to extract and structure key information into a JSON object.
${memberFilteringInstruction}

### Requirements ###
1. Generate output in valid JSON with the following structure:
{
  "title": "string, max 100 characters",
  "description": "string, max 500 characters",
  "summary": "string, comprehensive but concise summary of the meeting",
  "actionItems": ["array of specific, actionable tasks${hasMemberContext ? ' - ONLY for organization members listed above' : ''}"]
}

2. Extraction priorities:
- "title": Concise, descriptive, and reflective of the meeting's primary purpose
- "description": Brief overview highlighting outcomes and decisions
- "summary": Prioritize decisions made, agreements, and conclusions
- "actionItems": CRITICAL - See detailed extraction rules below

### ACTION ITEM EXTRACTION - HIGHEST PRIORITY ###

**CORE PRINCIPLE: When in doubt, include it.**
Favor recall over precision. It's better to capture an ambiguous commitment than to miss a real one.
${hasMemberContext ? '\n**CRITICAL OVERRIDE: However, ONLY include tasks for organization members listed above. External participant tasks must be excluded.**\n' : ''}

**PRIMARY COMMITMENT SIGNALS:**
1. Direct: "I'll...", "I will...", "I'm going to...", "I can..."
2. Team: "We'll...", "We will...", "Let's...", "We should..." + affirmation
3. Assignment: "X will...", "Can you...", "Could you..."
4. Acceptance: "Sure", "Okay", "Yes", "I'll do that", "Consider it done", "On it"
5. Volunteering: "I'll take care of that", "I'll handle it", "Leave it to me"

**MULTI-TURN COMMITMENTS (CRITICAL):**
Track commitments that develop across multiple exchanges:
- Initial mention → Discussion → Someone accepts = ACTION ITEM
- Question → Exploration → Agreement = ACTION ITEM
- Problem → Multiple comments → Owner emerges = ACTION ITEM
${hasMemberContext ? '**VERIFY the owner is an organization member before including**\n' : ''}

Example:
A: "We need the dashboard updated"
B: "What changes specifically?"
A: "Add the new metrics we discussed"
[5 lines later]
B: "I can work on that this week"
${hasMemberContext ? '→ Check if B is in organization member list\n→ If YES: "Update dashboard with new metrics (Owner: B, Timeline: this week)"\n→ If NO: EXCLUDE this action item\n' : '→ "Update dashboard with new metrics (Owner: B, Timeline: this week)"'}

**REFINED/EVOLVED COMMITMENTS:**
When a task gets refined in conversation, capture the FINAL scope:
A: "Can you email them?"
B: "Sure"
A: "And include the pricing breakdown"
→ "Email with pricing breakdown" (not just "email them")
${hasMemberContext ? '**But only if B is an organization member**\n' : ''}

**IMPLICIT DEADLINE PATTERNS:**
- "before next meeting" → Check if meeting date mentioned elsewhere
- "this week" → Include as deadline
- "soon", "ASAP", "when you get a chance" → Mark as "ASAP" or "this week"
- "by [event]" → Include the event as deadline

**CONDITIONAL/DEPENDENT ACTIONS:**
Extract BOTH actions:
"After John sends the report, Sarah will review it"
${hasMemberContext ? '→ Check BOTH John and Sarah against organization member list\n→ Only include action items for those who ARE organization members\n' : '→ Two action items:\n1. "John will send the report"\n2. "Sarah will review report (after receiving from John)"'}

**PARKING LOT WITH COMMITMENT:**
If something is "parked" but someone commits to follow up:
"Let's park the redesign discussion, but I'll send you those mockups anyway"
${hasMemberContext ? '→ Check if speaker is organization member\n→ If YES: "Send redesign mockups" (IS an action item)\n' : '→ "Send redesign mockups" (IS an action item)'}

**GROUP/UNASSIGNED TASKS:**
If task is clear but owner is unclear, still include it:
"Someone needs to book the conference room"
${hasMemberContext ? '→ Only if this is clearly a task for the organization (not external parties)\n' : ''}→ "Book conference room for [event]" (Owner: TBD)

**FOLLOW-UP COMMITMENTS:**
These ARE action items:
- "I'll follow up on that"
- "Let me check and get back to you"
- "I'll look into it"
- "I'll circle back"
${hasMemberContext ? '**Verify the speaker is an organization member**\n' : ''}

**VERIFICATION COMMITMENTS:**
These ARE action items:
- "Let me verify that"
- "I'll double-check"
- "I'll confirm with them"
${hasMemberContext ? '**Verify the speaker is an organization member**\n' : ''}

**THREE-PASS EXTRACTION STRATEGY:**

**Pass 1 - Explicit Commitments:**
Scan for obvious "I will" statements and direct assignments
${hasMemberContext ? 'Match each commitment to organization member list\n' : ''}

**Pass 2 - Conversational Commitments:**
Look for:
- Questions + affirmative responses
- Problems + solution offers
- Discussions that conclude with ownership
- Agreements buried in dialogue
${hasMemberContext ? 'Identify speakers and verify they are organization members\n' : ''}

**Pass 3 - Fragmented Commitments:**
Reconstruct commitments from pieces:
- Task mentioned on line 10
- Owner identified on line 15
- Deadline mentioned on line 42
→ Combine into one action item
${hasMemberContext ? '→ Verify owner is in organization member list before including\n' : ''}

**FINAL CHECKLIST (Run this before outputting):**
□ Did I scan the ENTIRE transcript, not just sections labeled "action items"?
□ Did I check for multi-turn commitments that evolved?
□ Did I look for "I'll follow up" or "I'll check" statements?
□ Did I capture commitments where someone said "yes/sure/okay" to a request?
${hasMemberContext ? '□ Did I verify EACH action item owner is in the organization member list?\n□ Did I EXCLUDE tasks assigned to external participants?\n' : ''}□ Did I include tasks with unclear owners (mark as TBD)?
□ Did I combine fragmented information (task + owner + deadline from different parts)?
□ Did I check for conditional/dependent actions?
□ When uncertain, did I INCLUDE the item?

**WHAT TO DEFINITELY EXCLUDE:**
✗ Pure discussion without commitment: "We talked about X"
✗ Unanswered questions: "Should we do X?" (no response)
✗ Hypotheticals without commitment: "Maybe we could..." (no one commits)
✗ Future considerations: "Down the road..." (unless specific commitment made)
✗ Aspirational without owner: "We really need to improve X" (no one takes it)
✗ Brainstorming without conclusion: "What if..." (no decision reached)
${hasMemberContext ? '✗ **Tasks assigned to people NOT in the organization member list**\n✗ **External participant commitments**\n' : ''}

**ACTION ITEM FORMAT:**
Preferred: "[Owner] will [action] by [deadline]"
Acceptable: "[Action] by [deadline]" or "[Owner] will [action]"
Minimum: "[Action]" (only if truly no other context)

Examples:
✓ "Sarah will send budget proposal by Friday"
✓ "Follow up with client about contract terms (Owner: John, Deadline: this week)"
${hasMemberContext ? '✓ "Schedule Q2 planning meeting (Owner: TBD)" - only if for organization\n' : '✓ "Schedule Q2 planning meeting (Owner: TBD)"\n'}✓ "Review design mockups before next Wednesday"

**QUALITY CHECK:**
Ask yourself for each potential action item:
1. Did someone commit to doing this (explicitly or implicitly)?
2. Is there a specific action (even if small)?
${hasMemberContext ? '3. **Is the person who committed in the organization member list?**\n4. If uncertain about identity: EXCLUDE IT (err on the side of excluding external tasks)\n' : '3. If uncertain: INCLUDE IT (err on the side of capture)\n'}

### Other Fields ###
- "title": Avoid generic titles. Be specific to the meeting's actual purpose
- "description": Focus on outcomes and decisions, not just topics
- "summary": Comprehensive but concise. Prioritize what was decided

### Technical Requirements ###
- Output must be valid JSON (no trailing commas)
- Truncate title to 100 chars, description to 500 chars
- If no action items exist, return empty array: "actionItems": []
- Do not fabricate details not present in the content

### Output Primer ###
Begin your response with:
{
  "title":`;

        const userPrompt = `Analyze the following meeting notes and extract the required information.

CRITICAL REMINDER: 
- Read the ENTIRE content from start to finish
- Action items are often hidden in natural dialogue
- Track commitments across multiple exchanges
${hasMemberContext ? `- **ONLY include action items for organization members listed in the system prompt**\n- **EXCLUDE tasks for external participants or people not in the organization**\n` : ''}- When uncertain whether something is an action item, INCLUDE IT
- Don't just look for "action items" sections - commitments appear throughout

Meeting content:

${content}`;

        // Rest of the function remains the same...
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