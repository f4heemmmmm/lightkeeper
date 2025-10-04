import OpenAI from 'openai';
import { IMeeting } from '../models/Meeting';
import { sanitizeMeetingTranscript, sanitizeContent, validateContentSafety } from './guardrailsService';

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
    console.log('[ChatService] Processing question with guardrails...');
    
    // Sanitize user question
    const questionResult = sanitizeContent(question, 'chat_question');
    if (!validateContentSafety(questionResult).isSafe) {
      return "I cannot process your question as it contains sensitive information. Please rephrase your question without including personal data, credentials, or other sensitive details.";
    }

    // Sanitize transcript
    const transcriptResult = sanitizeMeetingTranscript(transcript);
    const transcriptSafety = validateContentSafety(transcriptResult);
    if (!transcriptSafety.isSafe) {
      return "I cannot analyze this meeting transcript due to data privacy concerns. The transcript contains too much sensitive information that has been redacted.";
    }

    // Sanitize conversation history
    const sanitizedHistory: ConversationMessage[] = [];
    for (const msg of conversationHistory) {
      const msgResult = sanitizeContent(msg.content, 'chat_history');
      if (validateContentSafety(msgResult).isSafe) {
        sanitizedHistory.push({
          role: msg.role,
          content: msgResult.sanitizedContent
        });
      }
      // Skip messages that fail safety validation
    }

    if (questionResult.hasViolations || transcriptResult.hasViolations) {
      console.warn('[ChatService] Content sanitized before processing');
    }

    const systemPrompt = `You are an intelligent AI assistant helping users understand and extract information from meeting transcripts.

**IMPORTANT PRIVACY NOTICE**: 
- The transcript and conversation history have been sanitized for privacy protection
- Any [REDACTED] markers indicate where sensitive information was removed
- Do not attempt to guess or reconstruct redacted information
- Focus on providing insights based on the available sanitized content

Your role is to answer questions about the meeting based ONLY on the provided transcript and meeting metadata.

**Meeting Information:**
- Title: ${meeting.title}
- Description: ${meeting.description}
- Summary: ${meeting.summary}
- Action Items: ${meeting.actionItems?.join(', ') || 'None'}

**Transcript Content:**
${transcriptResult.sanitizedContent}

Now, answer the user's questions based on this meeting information.`;

    // Build messages array with sanitized conversation history
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add sanitized conversation history (limit to last 10 messages)
    const recentHistory = sanitizedHistory.slice(-10);
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add sanitized current question
    messages.push({
      role: 'user',
      content: questionResult.sanitizedContent
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

    console.log('[ChatService] Response generated with privacy protection');
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

    return "I apologize, but I encountered an error processing your question. Please try rephrasing your question or ask something else about the meeting.";
  }
};
