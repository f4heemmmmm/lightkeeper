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

### Requirements ###
1. Generate output in valid JSON with the following structure:
{
  "title": "string, max 100 characters",
  "description": "string, max 500 characters",
  "summary": "string, comprehensive but concise summary of the meeting",
  "actionItems": ["array of specific, actionable tasks"]
}

2. Extraction priorities:
- "title": Concise, descriptive, and reflective of the meeting's primary purpose
- "description": Brief overview highlighting outcomes and decisions
- "summary": Prioritize decisions made, agreements, and conclusions
- "actionItems": CRITICAL - See detailed extraction rules below

### ACTION ITEM EXTRACTION - HIGHEST PRIORITY ###

**CORE PRINCIPLE: When in doubt, include it.**
Favor recall over precision. It's better to capture an ambiguous commitment than to miss a real one.

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

Example:
A: "We need the dashboard updated"
B: "What changes specifically?"
A: "Add the new metrics we discussed"
[5 lines later]
B: "I can work on that this week"
→ "Update dashboard with new metrics (Owner: B, Timeline: this week)"

**REFINED/EVOLVED COMMITMENTS:**
When a task gets refined in conversation, capture the FINAL scope:
A: "Can you email them?"
B: "Sure"
A: "And include the pricing breakdown"
→ "Email with pricing breakdown" (not just "email them")

**IMPLICIT DEADLINE PATTERNS:**
- "before next meeting" → Check if meeting date mentioned elsewhere
- "this week" → Include as deadline
- "soon", "ASAP", "when you get a chance" → Mark as "ASAP" or "this week"
- "by [event]" → Include the event as deadline

**CONDITIONAL/DEPENDENT ACTIONS:**
Extract BOTH actions:
"After John sends the report, Sarah will review it"
→ Two action items:
1. "John will send the report"
2. "Sarah will review report (after receiving from John)"

**PARKING LOT WITH COMMITMENT:**
If something is "parked" but someone commits to follow up:
"Let's park the redesign discussion, but I'll send you those mockups anyway"
→ "Send redesign mockups" (IS an action item)

**GROUP/UNASSIGNED TASKS:**
If task is clear but owner is unclear, still include it:
"Someone needs to book the conference room"
→ "Book conference room for [event]" (Owner: TBD)

**FOLLOW-UP COMMITMENTS:**
These ARE action items:
- "I'll follow up on that"
- "Let me check and get back to you"
- "I'll look into it"
- "I'll circle back"

**VERIFICATION COMMITMENTS:**
These ARE action items:
- "Let me verify that"
- "I'll double-check"
- "I'll confirm with them"

**THREE-PASS EXTRACTION STRATEGY:**

**Pass 1 - Explicit Commitments:**
Scan for obvious "I will" statements and direct assignments

**Pass 2 - Conversational Commitments:**
Look for:
- Questions + affirmative responses
- Problems + solution offers
- Discussions that conclude with ownership
- Agreements buried in dialogue

**Pass 3 - Fragmented Commitments:**
Reconstruct commitments from pieces:
- Task mentioned on line 10
- Owner identified on line 15
- Deadline mentioned on line 42
→ Combine into one action item

**FINAL CHECKLIST (Run this before outputting):**
□ Did I scan the ENTIRE transcript, not just sections labeled "action items"?
□ Did I check for multi-turn commitments that evolved?
□ Did I look for "I'll follow up" or "I'll check" statements?
□ Did I capture commitments where someone said "yes/sure/okay" to a request?
□ Did I include tasks with unclear owners (mark as TBD)?
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

**ACTION ITEM FORMAT:**
Preferred: "[Owner] will [action] by [deadline]"
Acceptable: "[Action] by [deadline]" or "[Owner] will [action]"
Minimum: "[Action]" (only if truly no other context)

Examples:
✓ "Sarah will send budget proposal by Friday"
✓ "Follow up with client about contract terms (Owner: John, Deadline: this week)"
✓ "Schedule Q2 planning meeting (Owner: TBD)"
✓ "Review design mockups before next Wednesday"

**QUALITY CHECK:**
Ask yourself for each potential action item:
1. Did someone commit to doing this (explicitly or implicitly)?
2. Is there a specific action (even if small)?
3. If uncertain: INCLUDE IT (err on the side of capture)

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
- When uncertain whether something is an action item, INCLUDE IT
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

        return analysis;
    } catch (error) {
        console.error('Error analyzing meeting notes:', error);
        throw new Error('Failed to analyze meeting notes');
    }
};