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
    tags: string[];
    internalTags: string[];
}

/**
 * Analyze meeting notes/transcript using OpenAI to extract structured information
 */
export const analyzeMeetingNotes = async (
    content: string,
    organizationMembers?: OrganizationMember[]
): Promise<MeetingAnalysis> => {
    // ... keep existing implementation unchanged
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

**FILTERING RULES - APPLY STRICTLY:**

1. **Speaker Identification Protocol:**
   - Scan EVERY action item for WHO is assigned the task
   - Look for patterns: "X will...", "X should...", "X needs to...", "X, please...", "Can X...", "Have X..."
   - If no assignee is mentioned, mark as "TBD" but still include (internal task)

2. **Name Matching Algorithm:**
   - **Exact matches**: Full names, first names, last names
   - **Partial matches**: "John" matches "John Smith", "Smith" matches "John Smith"
   - **Email matches**: Any part of email address (e.g., "john" matches "john.smith@company.com")
   - **Case insensitive**: "SARAH" matches "Sarah", "sarah" matches "Sarah"
   - **Common variations**: Handle nicknames (Mike/Michael, Bob/Robert, etc.)
   - **Whitespace flexible**: "John Smith" matches "John  Smith" or "JohnSmith"

3. **EXCLUSION CRITERIA - MANDATORY:**
   ❌ **External companies mentioned**: "John from Acme Corp", "Sarah at ClientCo", "the team at VendorX"
   ❌ **Client/customer references**: "client will review", "customer needs to approve"
   ❌ **Vendor/supplier tasks**: "supplier will deliver", "contractor will install"
   ❌ **Third-party services**: "bank will process", "lawyer will draft", "accountant will file"
   ❌ **Unknown external people**: Names that don't match ANY organization member
   ❌ **Generic external roles**: "their team", "external consultant", "the vendor"

4. **INCLUSION CRITERIA - REQUIRED:**
   ✅ **Exact name match**: Person's name appears in organization member list
   ✅ **Internal team references**: "we will", "our team will", "the team will" (when context is internal)
   ✅ **Unassigned internal tasks**: Clear internal tasks without specific assignee
   ✅ **Role-based internal assignments**: "project manager will" (if PM is in member list)

5. **DECISION TREE - Follow This Exactly:**
   \`\`\`
   For each potential action item:
   
   Step 1: Extract the assignee name/identifier
   Step 2: Is assignee mentioned?
     → NO: Is this clearly an internal task? 
       → YES: Include with assignedTo: null
       → NO: EXCLUDE
     → YES: Continue to Step 3
   
   Step 3: Does assignee match ANY organization member?
     → Use fuzzy matching rules above
     → YES: Include with matched member name
     → NO: Continue to Step 4
   
   Step 4: Is there external context (company name, "client", "vendor")?
     → YES: EXCLUDE (external participant)
     → NO: Continue to Step 5
   
   Step 5: Is assignee clearly external based on context?
     → YES: EXCLUDE
     → NO: Include with assignedTo: null (unknown internal)
   \`\`\`

6. **VERIFICATION CHECKLIST - Run Before Including Each Item:**
   □ Is the assignee name in the organization member list? (exact or fuzzy match)
   □ If not in list, is there ANY indication this is external? (company, client, vendor context)
   □ If external indicators present → EXCLUDE
   □ If no external indicators and unclear assignee → Include as internal task
   □ Double-check: Would this task be relevant for the organization to track?

**EXAMPLES - LEARN FROM THESE:**

**INCLUDE (✅):**
- "Sarah will send the proposal by Friday" (Sarah in member list)
- "John needs to review the contract" (John in member list) 
- "Mike from our team will handle client calls" (Mike in member list)
- "We need to update the website" (internal team task)
- "Someone should book the conference room" (internal task, assignee TBD)
- "The project manager will coordinate" (if PM role belongs to member)

**EXCLUDE (❌):**
- "John from Acme Corp will review the contract" (external company)
- "The client will provide feedback by Tuesday" (external client)
- "Sarah at VendorCo will deliver the materials" (external vendor)
- "Their legal team will draft the agreement" (external team)
- "Bob from the bank will process the loan" (external service provider)
- "The contractor will install the equipment" (external contractor)
- "Alex will handle it" (Alex NOT in organization member list, no context suggesting internal)

**EDGE CASES:**
- "John will coordinate with the client" → Include if John is in member list (internal task)
- "Client will review after John sends it" → Include John's task, exclude client's task
- "We'll have the vendor update the system" → Include as internal coordination task
- "Ask the lawyer to review" → Include as internal task to contact lawyer

**FORMAT REQUIREMENTS:**
- When organization member identified: "[Member Name] will [action] by [deadline]"
- When internal but unassigned: "[Action] (Owner: TBD)"
- NEVER include external participant names in the action item text
- Focus on what the ORGANIZATION needs to do, not what external parties will do

**FINAL VALIDATION:**
Before outputting action items, ask yourself:
1. Would the organization's task management system need to track this?
2. Is this something an organization member needs to do or follow up on?
3. If assigned to someone, are they definitely in the organization member list?
4. Have I excluded ALL tasks that are purely external responsibilities?

**CRITICAL OVERRIDE:** When in doubt about whether someone is internal or external, EXCLUDE the item. It's better to miss a potential task than to include external participant tasks.` : '';

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
  "actionItems": ["array of specific, actionable tasks${hasMemberContext ? ' - ONLY for organization members listed above' : ''}"],
  "tags": ["array of 3-7 relevant tags for categorization and search"],
  "internalTags": ["array of system-generated tags for internal use - see rules below"]
}

2. Extraction priorities:
- "title": Concise, descriptive, and reflective of the meeting's primary purpose
- "description": Brief overview highlighting outcomes and decisions
- "summary": Prioritize decisions made, agreements, and conclusions
- "actionItems": CRITICAL - See detailed extraction rules below
- "tags": Generate 3-7 relevant, searchable tags:
  * Include topic categories (Budget, Marketing, Product, HR, Engineering, etc.)
  * Include meeting types (Planning, Review, Standup, Retrospective, Strategy, etc.)
  * Include project names if mentioned
  * Include key themes (Decision Made, Blocked, Needs Follow-up, etc.)
  * Use title case (e.g., "Q4 Planning" not "q4 planning")
  * Keep concise (1-3 words each)
  * Avoid generic tags like "Meeting" or "Discussion"
- "internalTags": Generate internal system tags (not shown to users):
  * Add "follow-up-required" if meeting needs follow-up or has unresolved items
  * Add "decision-made" if significant decisions were made
  * Add topic similarity tags like "tech-discussion", "budget-planning", "hr-matters", "product-roadmap", etc.
  * Add "recurring-topic-[topic]" if this seems like a recurring meeting type
  * Add "action-heavy" if 5+ action items
  * Add "review-meeting" if this reviews previous work/decisions
  * Add "planning-meeting" if this is about future planning
  * Add "urgent" if urgency is mentioned multiple times
  * Use lowercase with hyphens (e.g., "follow-up-required" not "Follow Up Required")

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

        if (!Array.isArray(analysis.tags)) {
            analysis.tags = [];
        }

        // Limit tags to 7 maximum
        if (analysis.tags.length > 7) {
            analysis.tags = analysis.tags.slice(0, 7);
        }

        if (!Array.isArray(analysis.internalTags)) {
            analysis.internalTags = [];
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
    dueDate?: string; // ISO datetime string if found (YYYY-MM-DDTHH:mm:ss.sssZ) or just date (YYYY-MM-DD)
    confidence?: number; // 0-1 confidence score
    assignedToName?: string; // Name of the person the task is assigned to
}

/**
 * Analyze an email to extract task information using OpenAI
 * @param emailSubject - The subject line of the email
 * @param emailBody - The body content of the email
 * @param emailFrom - Who sent the email
 * @param organizationMembers - List of organization members for assignment matching
 */
export const extractTaskFromEmail = async (
    emailSubject: string,
    emailBody: string,
    emailFrom?: string,
    organizationMembers?: OrganizationMember[]
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
        const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
        
        console.log('[OpenAI] Current date for context:', currentDate, `(${dayOfWeek})`);
        
        // Build member context if available
        const hasMemberContext = organizationMembers && organizationMembers.length > 0;
        const memberList = hasMemberContext 
            ? organizationMembers.map(m => `- ${m.name} (${m.email})`).join('\n')
            : '';
        
        const assignmentInstructions = hasMemberContext ? `

### TASK ASSIGNMENT DETECTION ###

**Organization Members Available for Assignment:**
${memberList}

**Assignment Detection Rules:**
1. Look for phrases that indicate WHO should do the task:
   - "reminder for [Name] to..."
   - "[Name] needs to..."
   - "[Name] should..."
   - "can [Name]..."
   - "have [Name]..."
   - "tell [Name] to..."
   - "ask [Name] to..."
   - "get [Name] to..."
   - "[Name], please..."
   - "[Name] will..."
   
2. **Name Matching Strategy:**
   - Match first names, last names, or full names
   - Be flexible with variations (e.g., "Riya" matches "Riya Patel")
   - Handle common nicknames (e.g., "Mike" for "Michael")
   - Case-insensitive matching
   
3. **Extract the assignee's name** from the organization members list:
   - If you find a match, include the EXACT name from the organization members list in the "assignedToName" field
   - If no match or no assignment mentioned, set "assignedToName" to null
   
4. **Examples:**
   - "Reminder for Riya to submit the report" → assignedToName: "Riya" (if Riya is in the member list)
   - "Can Sarah review this document?" → assignedToName: "Sarah" (if Sarah is in the member list)
   - "Please have John call the client" → assignedToName: "John" (if John is in the member list)
   - "Submit the report by Friday" → assignedToName: null (no specific person mentioned)
   - "Reminder for Bob to..." → assignedToName: null (if Bob is NOT in the member list)

**CRITICAL**: Only set assignedToName if:
1. A specific person is mentioned in the email
2. That person exists in the organization members list above
3. The mention indicates they should perform the task` : '';
        
        const systemPrompt = `### Instruction ###
You are an AI assistant specialized in analyzing emails to identify actionable tasks.
Your task is to determine if an email contains a task or action item, and if so, extract structured task information.
${assignmentInstructions}

### CRITICAL: EMAIL FILTERING - EXCLUDE NON-TASK EMAILS ###

**IMMEDIATELY REJECT these email types (set hasTask=false, confidence=0):**

1. **Automated/System Emails:**
   - From: noreply@, no-reply@, donotreply@, notifications@, automated@, support@
   - Email contains: "This is an automated message", "Do not reply to this email"
   - Subject lines: "Automated:", "System:", "[Automated]", "Do not reply"
   - Common automated senders: GitHub, Jira, Slack notifications, calendar reminders without action items
   
2. **Newsletters & Marketing:**
   - Subject contains: "Newsletter", "Weekly Digest", "Monthly Update", "Roundup", "Top Stories"
   - Promotional language: "Sale", "Discount", "Limited Time", "Offer Expires", "Buy Now", "Shop Now", "% Off"
   - Multiple product listings or promotional links
   - Prominent "Unsubscribe" links or "View in browser" links
   - Marketing footers with company addresses and legal disclaimers
   - Email is primarily HTML with lots of images and CTAs
   
3. **Transactional/Confirmations:**
   - Order confirmations: "Your order", "Order #", "Purchase confirmation", "Receipt"
   - Shipping updates: "has shipped", "tracking number", "delivered", "out for delivery"
   - Password resets: "reset your password", "verification code", "confirm your email"
   - Account notifications: "Your account", "security alert", "login detected"
   - Subscription confirmations: "You're now subscribed", "Welcome to"
   
4. **Social Media Notifications:**
   - From: Facebook, Twitter, LinkedIn, Instagram, TikTok, Reddit, etc.
   - "X liked your post", "You have a new follower", "Someone commented"
   - "Someone mentioned you", "New connection request"
   
5. **Calendar/Meeting Auto-responses:**
   - "Out of office", "Automatic reply", "Away from desk"
   - "I am currently unavailable"
   - Simple meeting accepted/declined without additional context or follow-up requests
   - "Calendar event reminder" without actionable content
   
6. **Pure Information (FYI) Emails:**
   - Subject starts with "FYI:", "For your information", "Heads up"
   - Body is ONLY sharing links, articles, or documents without requesting action
   - No questions, no requests, no deadlines, no call to action
   - Simply forwarding information with no added context
   
7. **Acknowledgment-only replies:**
   - "Thanks!", "Thank you", "Got it", "Received", "Noted", "Acknowledged"
   - "Will do" without context of what will be done
   - "Sounds good", "Perfect", "Great"
   - Single word/phrase responses: "Yes", "No", "OK", "Sure"

8. **Spam/Promotional:**
   - Subject in ALL CAPS or with excessive punctuation (!!!, $$$)
   - Phrases like "Make money", "Work from home", "Free trial"
   - Obvious phishing attempts

**BORDERLINE CASES - Require HIGH confidence (0.8+):**
- Emails with both informational and actionable content (extract only the actionable part)
- Forwarded emails (check if forwarding message adds action context)
- "Just checking in" emails (only task if there's a specific ask)
- Meeting invites (only task if they require preparation or confirmation beyond just attending)

**DETECTION STRATEGY:**

**Step 1 - Sender Analysis:**
- Check the 'From' field for automated patterns (noreply, notifications, automated)
- If sender is automated → REJECT immediately (hasTask=false, confidence=0)

**Step 2 - Subject Line Scan:**
- Look for newsletter/marketing keywords
- Check for transactional patterns (order, shipping, confirmation, receipt)
- If matches exclusion patterns → REJECT immediately

**Step 3 - Content Pattern Analysis:**
- Scan for unsubscribe links (strong newsletter indicator)
- Check for promotional CTAs and multiple product links
- Look for "This is an automated message" text
- Check for out-of-office auto-reply patterns
- If primarily marketing/automated content → REJECT

**Step 4 - Actionability Test:**
- Is there a SPECIFIC action requested?
- Is there a PERSON who needs to do something?
- Is there a DEADLINE or urgency indicator?
- Can this be completed as a discrete task?

**If ANY of steps 1-3 trigger rejection → hasTask=false, confidence=0**
**If step 4 has fewer than 2 YES answers → hasTask=false, confidence < 0.5**

### TASK IDENTIFICATION - WHAT QUALIFIES ###

**Valid task emails have ALL of these:**
1. Clear, specific action required (not just "be aware" or "FYI")
2. Identifiable owner (even if implicit: "you", "team", specific person)
3. Completable outcome (not open-ended discussion)

**Valid task emails have AT LEAST ONE of these:**
1. Explicit request: "can you", "please", "need you to", "could you"
2. Deadline mentioned: "by Friday", "before the meeting", "ASAP", "EOD"
3. Question requiring action: "Can you send...", "Will you review..."
4. Assignment: "You are responsible for...", "Your task is..."
5. Reminder of pending action: "Reminder to...", "Don't forget to..."

**CONFIDENCE CALIBRATION:**

- 0.9-1.0: Explicit task with clear assignment and deadline
  Example: "Can you review the Q4 budget by Friday?"
  
- 0.7-0.89: Clear task but missing one element (no deadline OR no explicit assignment)
  Example: "Please update the client on project status"
  
- 0.5-0.69: Implied task with some ambiguity
  Example: "We should probably update the documentation soon"
  
- Below 0.5: Not a task OR too much ambiguity
  Example: "FYI - here's the latest report" (informational only)

**IMPORTANT**: Default to hasTask=false unless you can clearly identify a specific, actionable task. It's better to miss an edge case than to create tasks from newsletters, marketing emails, or informational messages.

### Requirements ###
1. Generate output in valid JSON with the following structure:
{
  "hasTask": boolean,
  "title": "string, max 100 characters (only if hasTask is true)",
  "description": "string, max 500 characters (only if hasTask is true)",
  "priority": "low" | "medium" | "high" (only if hasTask is true),
  "dueDate": "ISO date string YYYY-MM-DD if mentioned, null otherwise",
  "confidence": number between 0 and 1,
  "assignedToName": "string - exact name from organization members list, or null"
}

2. Task extraction priorities:
- "title": Create a clear, concise task title that captures the main action (e.g., "Review Q4 budget proposal", "Send contract to client")
- "description": Provide a comprehensive summary including:
  * What needs to be done
  * Key context from the email
  * Any specific requirements or details
  * Why this matters (if mentioned)
  * Note: Keep it clear and actionable
- "priority": CRITICAL - Carefully assess priority:
  - "high": Urgent language (ASAP, urgent, critical, STAT, immediately), tight deadlines (today, tomorrow, by end of day, this afternoon), executive/VIP requests, time-sensitive business impact, explicit urgency markers
  - "medium": Standard business requests, reasonable timeframes (this week, next few days, by end of week), normal work priority, some time sensitivity but not critical
  - "low": No deadline mentioned, routine tasks, informational with optional action, flexible timing (next week, when you can, no rush), no urgency indicators, "when you get a chance" type requests
- "dueDate": **CRITICAL - DUE DATE AND TIME EXTRACTION RULES**
  - **ONLY extract dates/times that are EXPLICITLY mentioned in the email**
  - **DO NOT make up or assume dates/times if not mentioned**
  - **DO NOT generate arbitrary future dates/times**
  - **If NO date/deadline is mentioned, MUST set to null**
  - **If a date IS mentioned, convert to ISO format**
  
**FORMAT RULES:**
  - If BOTH date AND time mentioned: ISO datetime format WITHOUT timezone (YYYY-MM-DDTHH:mm:ss)
    * Use 24-hour format for time
    * Assume the user's local timezone (do NOT convert to UTC, do NOT add 'Z')
    * Examples: "2025-03-15T14:30:00", "2025-03-15T09:00:00"
  - If ONLY date mentioned (no time): ISO date format (YYYY-MM-DD)
    * Examples: "2025-03-15", "2025-12-25"
  - If ONLY time mentioned (no date): Use TODAY's date + the specified time
    * "3pm today" → "2025-10-04T15:00:00Z" (using current date ${currentDate})
  
  **Relative Date Calculation (use current date: ${currentDate}, ${dayOfWeek}):**
  - "today" → ${currentDate}
  - "tomorrow" → calculate next day from ${currentDate}
  - "Friday", "Monday", etc. → calculate next occurrence of that day from ${currentDate}
  - "next Friday" → calculate Friday in the next week
  - "this Friday" → calculate closest upcoming Friday
  - "end of day" / "EOD" → ${currentDate} (today)
  - "by the end of the week" → calculate upcoming Friday
  - "next week" → calculate Monday of next week
  - "this week" → calculate upcoming Friday of current week
  
  **Partial Dates (use current date: ${currentDate} for context):**
  - "the 15th" → use current month and year, day 15 (if 15th has passed, use next month)
  - "by the 25th" → use current month and year, day 25 (if passed, use next month)
  - "December 15" → use current year, December 15
  - "March 1st" → use current year, March 1 (if passed, use next year)
  
**Date Examples:**
  - "by Friday" → Calculate next Friday: "2025-10-10" (just date, no time)
  - "by the 20th" → Current month, day 20: "2025-10-20"
  - "by end of day" → Today: "${currentDate}"
  - "NO MENTION" → null (DO NOT GENERATE)
  - "soon" / "ASAP" → null (no specific date)
  
**Date + Time Examples:**
  - "tomorrow at 3pm" → "2025-10-05T15:00:00" (NO 'Z')
  - "Friday at 2:30pm" → "2025-10-10T14:30:00"
  - "by 5pm today" → "${currentDate}T17:00:00"
  - "Monday morning at 9am" → "2025-10-06T09:00:00"
  - "end of day tomorrow" → "2025-10-05T17:00:00" (assume 5pm)
  - "noon on the 15th" → "2025-10-15T12:00:00"
  
  **Time Conversion (12-hour to 24-hour):**
  - "3pm" → "15:00"
  - "9am" → "09:00"
  - "12pm" / "noon" → "12:00"
  - "12am" / "midnight" → "00:00"
  - "5:30pm" → "17:30"
  
  **Vague Times (use reasonable defaults if date is specified):**
  - "morning" → "09:00"
  - "afternoon" → "14:00"
  - "evening" → "18:00"
  - "end of day" / "EOD" → "17:00"
  - "start of day" → "09:00"
  
- "confidence": How confident you are this is a VALID, ACTIONABLE task (0.0-1.0)
  - 0.9-1.0: Clear action request with explicit assignment, definite task
  - 0.7-0.89: Strong indicators of task but some ambiguity
  - 0.5-0.69: Possible task but could be informational
  - Below 0.5: Likely not a task (set hasTask to false)
${hasMemberContext ? `- "assignedToName": Extract the person's name if specifically mentioned for this task
  - Must match a name from the organization members list
  - Use the EXACT name as it appears in the members list
  - Set to null if no specific person is assigned or if the person is not in the members list\n` : ''}

### Output Rules ###
- JSON must be strictly valid
- If hasTask is false, you may omit title, description, priority, dueDate, and assignedToName
- If hasTask is true, title and description are required
- Use the email sender's name/context when helpful for clarity
- NEVER fabricate information; extract only what's explicitly stated or clearly implied
- **MOST IMPORTANT: Do NOT invent due dates. Only extract dates explicitly mentioned in the email**
- **If no deadline is mentioned, dueDate MUST be null**
- **Vague timeframes like "soon", "ASAP", "when you can" should result in dueDate=null**
${hasMemberContext ? '- If a specific person is assigned, set assignedToName to their EXACT name from the members list\n- If no specific person is assigned or they are not in the members list, set assignedToName to null\n' : ''}

### Output Primer ###
Begin your response with:
{
  "hasTask":`;

        const userPrompt = `Analyze the following email and determine if it contains a task.

**CONTEXT:**
- Today's date: ${currentDate} (${dayOfWeek})
- Current time: ${currentDateTime}
- Use this information to calculate any relative dates mentioned in the email

**EMAIL TO ANALYZE:**
From: ${emailFrom || 'Unknown'}
Subject: ${emailSubject}

Body:
${emailBody}

**ANALYSIS CHECKLIST:**

**STEP 1 - FILTERING (Check FIRST):**
□ Is the sender a noreply/automated/notifications address? → If YES: hasTask=false, confidence=0, STOP
□ Does the subject contain newsletter/marketing keywords? → If YES: hasTask=false, confidence=0, STOP
□ Is this a transactional confirmation (order, shipping, password, receipt)? → If YES: hasTask=false, confidence=0, STOP
□ Does the body contain prominent unsubscribe links or marketing footers? → If YES: hasTask=false, confidence=0, STOP
□ Is this just sharing information with no action requested (FYI email)? → If YES: hasTask=false, confidence=0, STOP
□ Is this an auto-reply, out-of-office, or simple acknowledgment? → If YES: hasTask=false, confidence=0, STOP

**If ANY filtering checkbox is checked → OUTPUT: hasTask=false, confidence=0, and STOP ANALYSIS**

**STEP 2 - TASK VALIDATION (Only if passed all filtering):**
□ Is there a SPECIFIC action requested? (not just "be aware")
□ Is there an identifiable OWNER of the action? (you, team, specific person)
□ Is the action COMPLETABLE as a discrete task? (not ongoing awareness)
□ Is there a DEADLINE or URGENCY indicator?

**Need at least 2/4 checked for hasTask=true**

**STEP 3 - EXTRACTION (Only if hasTask=true):**
1. What is the task? (hasTask: true/false)
2. Confidence level? (confidence: 0.0-1.0)
3. Priority based on urgency? (priority: low/medium/high)
4. **Is there an EXPLICIT deadline/date/time mentioned?** (dueDate: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ or null)
   - Search the entire email for date AND time references
   - Convert relative dates using today's date (${currentDate})
   - If time is mentioned, include it in ISO datetime format (YYYY-MM-DDTHH:mm:ssZ)
   - If only date mentioned (no time), use ISO date format (YYYY-MM-DD)
   - If NO date mentioned → dueDate MUST be null
   - Do NOT create dates from vague terms like "soon", "ASAP", "when you can"
   - Convert 12-hour time to 24-hour format (3pm → 15:00)
${hasMemberContext ? '5. Is a specific organization member assigned? (assignedToName: exact name from members list or null)\n' : ''}

**CRITICAL REMINDERS:**
- Be CONSERVATIVE - when in doubt, set hasTask=false
- REJECT automated, marketing, newsletter, and transactional emails immediately
- Only set hasTask=true for clear, specific, actionable requests
- **ONLY extract dates that are EXPLICITLY mentioned**
- **If no date/deadline mentioned, dueDate = null (do NOT generate a date)**
- Use today's date (${currentDate}, ${dayOfWeek}) to calculate relative dates like "Friday", "tomorrow", "next week"
- **Extract both date AND time if time is mentioned** (e.g., "3pm" → include as "T15:00:00Z")
- If only date mentioned, use format YYYY-MM-DD
- If date + time mentioned, use format YYYY-MM-DDTHH:mm:ssZ
${hasMemberContext ? `- Check if any organization member name is mentioned for this task\n- Only set assignedToName if the person is in the organization members list\n` : ''}- Provide a clear, comprehensive description with all relevant context`;

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

        console.log('[OpenAI] ✓ Received response from GPT');
        const result = response.choices[0].message.content;
        if (!result) {
            console.error('[OpenAI] ✗ No content in response');
            throw new Error('No response from OpenAI');
        }

        console.log('[OpenAI] Raw response:', result);
        const extracted: ExtractedTask = JSON.parse(result);
        console.log('[OpenAI] Parsed result:', JSON.stringify(extracted, null, 2));

        // Validate and sanitize
        if (extracted.hasTask) {
            console.log('[OpenAI] ✓ VALID TASK DETECTED!');
            console.log('[OpenAI] Decision Details:');
            console.log(`  - Confidence: ${extracted.confidence || 0} (threshold: 0.5)`);
            console.log(`  - Priority: ${extracted.priority || 'medium'}`);
            console.log(`  - Due Date: ${extracted.dueDate || 'None'}`);
            console.log(`  - Assigned To: ${extracted.assignedToName || 'Unassigned'}`);
            
            if (!extracted.title || !extracted.description) {
                // If marked as hasTask but missing required fields, treat as no task
                console.log('[OpenAI] ✗ Task missing required fields, treating as INVALID');
                return { hasTask: false, confidence: 0 };
            }

            // Check confidence threshold
            if ((extracted.confidence || 0) < 0.5) {
                console.log(`[OpenAI] ✗ Confidence too low (${extracted.confidence}), treating as INVALID`);
                return { hasTask: false, confidence: extracted.confidence || 0 };
            }

            extracted.title = extracted.title.substring(0, 100);
            extracted.description = extracted.description.substring(0, 500);
            
            // Validate priority
            if (!['low', 'medium', 'high'].includes(extracted.priority || '')) {
                console.log('[OpenAI] ⚠ Invalid priority, defaulting to medium');
                extracted.priority = 'medium';
            }
            
            // Validate and log due date

                if (extracted.dueDate) {
                    // Validate it's either date format (YYYY-MM-DD) or datetime format (ISO 8601 without timezone)
                    const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
                    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
                    
                    if (dateOnlyRegex.test(extracted.dueDate)) {
                        console.log(`[OpenAI] ✓ Due date extracted (date only): ${extracted.dueDate}`);
                    } else if (dateTimeRegex.test(extracted.dueDate)) {
                        console.log(`[OpenAI] ✓ Due date extracted (with time): ${extracted.dueDate}`);
                    } else {
                        console.log(`[OpenAI] ⚠ Invalid date/datetime format: ${extracted.dueDate}, setting to null`);
                        extracted.dueDate = undefined;
                    }
                } else {
                    console.log('[OpenAI] No due date/time mentioned in email');
                }
            
            console.log('[OpenAI] Task validation PASSED - Will create task');
            console.log(`[OpenAI] Task Summary: "${extracted.title}" [${extracted.priority} priority]`);
        } else {
            console.log('[OpenAI] ✗ NO VALID TASK detected in email');
            console.log(`[OpenAI] Reason: Email is informational, automated, marketing, or confidence too low`);
            console.log(`[OpenAI] Confidence: ${extracted.confidence || 0}`);
        }

        return extracted;
    } catch (error) {
        console.error('[OpenAI] ✗ Error extracting task from email:', error);
        if (error instanceof Error) {
            console.error('[OpenAI] Error stack:', error.stack);
        }
        throw new Error('Failed to extract task from email');
    }
};

/**
 * Translation result interface
 */
export interface TranslationResult {
    translatedTitle: string;
    translatedDescription: string;
    translatedSummary: string;
    translatedActionItems: string[];
    detectedSourceLanguage: string;
    targetLanguage: string;
}

/**
 * Translate meeting notes to a target language using GPT-4o
 */
export const translateMeetingNotes = async (
    title: string,
    description: string,
    summary: string,
    actionItems: string[],
    targetLanguage: string = 'English'
): Promise<TranslationResult> => {
    try {
        console.log('[OpenAI] Starting meeting notes translation...');
        console.log('[OpenAI] Target Language:', targetLanguage);
        console.log('[OpenAI] Content length:', {
            title: title.length,
            description: description.length,
            summary: summary.length,
            actionItems: actionItems.length
        });

        const systemPrompt = `You are a professional translator specializing in business and meeting content translation.

Your task is to translate meeting notes, summaries, and action items to ${targetLanguage}.

TRANSLATION GUIDELINES:
1. Maintain professional tone and business context
2. Preserve technical terms, product names, and proper nouns when appropriate
3. Keep the meaning and intent intact
4. Ensure natural-sounding translations in the target language
5. Maintain the structure and formatting
6. If the content is already in ${targetLanguage}, return it as-is but still detect the source language

OUTPUT FORMAT:
You must respond with a valid JSON object containing:
{
  "translatedTitle": "translated title text",
  "translatedDescription": "translated description text",
  "translatedSummary": "translated summary text",
  "translatedActionItems": ["translated action item 1", "translated action item 2", ...],
  "detectedSourceLanguage": "detected source language name",
  "targetLanguage": "${targetLanguage}"
}`;

        const userPrompt = `Please translate the following meeting notes to ${targetLanguage}:

TITLE:
${title}

DESCRIPTION:
${description}

SUMMARY:
${summary}

ACTION ITEMS:
${actionItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}

Respond with the translation in the specified JSON format.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });

        const responseContent = completion.choices[0]?.message?.content;
        
        if (!responseContent) {
            throw new Error('No response from OpenAI');
        }

        console.log('[OpenAI] Raw translation response:', responseContent.substring(0, 200) + '...');

        const translation = JSON.parse(responseContent) as TranslationResult;

        console.log('[OpenAI]  Translation completed successfully');
        console.log('[OpenAI] Detected source language:', translation.detectedSourceLanguage);
        console.log('[OpenAI] Target language:', translation.targetLanguage);

        return translation;
    } catch (error) {
        console.error('[OpenAI]  Error translating meeting notes:', error);
        if (error instanceof Error) {
            console.error('[OpenAI] Error stack:', error.stack);
        }
        throw new Error('Failed to translate meeting notes');
    }
};
