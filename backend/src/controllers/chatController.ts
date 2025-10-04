import Meeting from '../models/Meeting';
import { Request, Response } from 'express';
import { askMeetingQuestion } from '../services/chatService';

// Chat with meeting transcript
export const chatWithMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { meetingId, message, conversationHistory } = req.body;

    if (!meetingId || !message) {
      res.status(400).json({ message: 'Meeting ID and message are required' });
      return;
    }

    if (!message.trim()) {
      res.status(400).json({ message: 'Message cannot be empty' });
      return;
    }

    // Fetch the meeting
    const meeting = await Meeting.findById(meetingId);
    
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    // Decode the transcript from base64
    let transcript = '';
    if (meeting.fileUrl && meeting.fileUrl.startsWith('data:text/plain;base64,')) {
      const base64Content = meeting.fileUrl.split(',')[1];
      transcript = Buffer.from(base64Content, 'base64').toString('utf8');
    } else {
      res.status(400).json({ message: 'Meeting transcript not available' });
      return;
    }

    if (!transcript || transcript.trim().length === 0) {
      res.status(400).json({ message: 'Meeting transcript is empty' });
      return;
    }

    // Get AI response
    const aiResponse = await askMeetingQuestion(
      message.trim(),
      transcript,
      meeting,
      conversationHistory || []
    );

    res.status(200).json({
      response: aiResponse,
      meetingTitle: meeting.title
    });
  } catch (error: any) {
    console.error('Error in chat:', error);
    res.status(500).json({ 
      message: 'Failed to process chat message', 
      error: error.message 
    });
  }
};