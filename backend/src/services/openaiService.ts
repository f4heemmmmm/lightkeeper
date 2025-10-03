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