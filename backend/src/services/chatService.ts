import OpenAI from 'openai';
import { IMeeting } from '../models/Meeting';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const askMeetingQuestion = async (
  question: string,
  transcript: string,
  meeting: IMeeting,
  conversationHistory: ConversationMessage[] = []
): Promise<string> => {
  try {
    const systemPrompt = `You are an intelligent AI assistant helping users understand and extract information from meeting transcripts. Your role is to answer questions about the meeting based ONLY on the provided transcript and meeting metadata.

### Meeting Information ###
- Title: ${meeting.title}
- Description: ${meeting.description || 'Not provided'}
- Summary: ${meeting.summary || 'Not provided'}
- Action Items: ${meeting.actionItems && meeting.actionItems.length > 0 ? meeting.actionItems.join('; ') : 'None identified'}

### Guidelines ###
1. **Answer based on the transcript**: Always reference the actual content from the meeting transcript when answering questions.

2. **Be specific and accurate**: Provide precise information. Quote relevant parts of the transcript when appropriate.

3. **Acknowledge limitations**: If the information requested is not in the transcript, clearly state that you don't have that information in the meeting notes rather than making up an answer.

4. **Handle out-of-scope questions**: If asked questions unrelated to the meeting (e.g., general knowledge, personal advice, unrelated topics), politely redirect the user:
   - "I'm specifically designed to help you with questions about this meeting. Based on the transcript I have, I can help you with [suggest relevant topics]. Is there something specific about the meeting you'd like to know?"

5. **Be conversational and helpful**: Maintain a friendly, professional tone. You can ask clarifying questions if needed.

6. **Provide context**: When answering, give enough context so the user understands not just the answer, but where in the meeting it was discussed.

7. **Handle ambiguous questions**: If a question is unclear, ask for clarification or provide the most relevant information you can find.

### Response Format ###
- For factual questions: Provide direct answers with references to the transcript
- For questions about what was discussed: Summarize the relevant discussion
- For questions about decisions: Clearly state what was decided and who made the decision if available
- For questions about action items: List specific tasks, owners (if mentioned), and deadlines (if mentioned)
- For unavailable information: "I don't see any information about [topic] in this meeting transcript. The meeting primarily covered [main topics]. Would you like to know more about any of these areas?"

### Important Notes ###
- Never fabricate information not present in the transcript
- If asked about attendees but they're not mentioned, say so
- If asked about topics not covered, acknowledge this clearly
- Stay focused on this specific meeting

### Meeting Transcript ###
${transcript}

Now, answer the user's questions based on this meeting information.`;

    // Build messages array with conversation history
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history (limit to last 10 messages to manage context length)
    const recentHistory = conversationHistory.slice(-10);
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current question
    messages.push({
      role: 'user',
      content: question
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const answer = response.choices[0].message.content;
    
    if (!answer) {
      throw new Error('No response from AI');
    }

    return answer;
  } catch (error: any) {
    console.error('Error in askMeetingQuestion:', error);
    
    // Handle specific OpenAI errors
    if (error.response?.status === 429) {
      return "I'm currently experiencing high demand. Please try again in a moment.";
    }
    
    if (error.response?.status === 401) {
      return "There's a configuration issue with the AI service. Please contact support.";
    }

    // Generic error response
    return "I apologize, but I encountered an error processing your question. Please try rephrasing your question or ask something else about the meeting.";
  }
};