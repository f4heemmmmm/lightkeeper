import axios from 'axios';
import Meeting from '../models/Meeting';
import { Request, Response } from 'express';
import NotetakerSession from '../models/NotetakerSession';
import { analyzeMeetingNotes } from '../services/openaiService';
import { createNotetakerSession, getNotetakerSession, downloadTranscript, stopNotetakerSession } from '../services/nylasService';


/**
 * Schedule a notetaker bot to join a meeting and record it
 */
export const scheduleNotetaker = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { meetingUrl, meetingTitle } = req.body;

        if (!meetingUrl) {
            res.status(400).json({ message: 'Meeting URL is required' });
            return;
        }

        const nylasSession = await createNotetakerSession(meetingUrl, meetingTitle);

        const session = new NotetakerSession({
            nylasSessionId: nylasSession.id,
            meetingUrl,
            meetingTitle,
            status: 'scheduled',
            scheduledBy: user.id,
            scheduledByName: user.name
        });

        await session.save();

        res.status(201).json({
            message: 'Notetaker scheduled successfully',
            session: {
                id: session._id,
                nylasSessionId: session.nylasSessionId,
                meetingUrl: session.meetingUrl,
                status: session.status
            }
        });
    } catch (error: any) {
        console.error('Error scheduling notetaker:', error);
        res.status(500).json({ message: 'Failed to schedule notetaker', error: error.message });
    }
};

/**
 * Get all notetaker sessions
 */
export const getNotetakerSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const sessions = await NotetakerSession.find()
            .sort({ createdAt: -1 })
            .select('nylasSessionId meetingUrl meetingTitle status scheduledByName startedAt completedAt createdAt');
        
        res.status(200).json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notetaker sessions', error });
    }
};

/**
 * Get a single notetaker session by ID with populated meeting data
 */
export const getNotetakerSessionById = async (req: Request, res: Response): Promise<void> => {
    try {
        const session = await NotetakerSession.findById(req.params.id)
            .populate('meetingId', 'title description summary actionItems');
        
        if (!session) {
            res.status(404).json({ message: 'Session not found' });
            return;
        }

        res.status(200).json(session);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching session', error });
    }
};

/**
 * Cancel a scheduled or joining notetaker session
 */
export const cancelNotetaker = async (req: Request, res: Response): Promise<void> => {
    try {
        const session = await NotetakerSession.findById(req.params.id);

        if (!session) {
            res.status(404).json({ message: 'Session not found' });
            return;
        }

        if (session.status === 'completed' || session.status === 'cancelled') {
            res.status(400).json({ message: 'Session already completed or cancelled' });
            return;
        }

        if (session.status === 'in_progress') {
            res.status(400).json({ message: 'Cannot cancel session that is already in progress' });
            return;
        }

        if (session.status === 'scheduled' || session.status === 'joining') {
            try {
                await stopNotetakerSession(session.nylasSessionId);
                console.log('Successfully cancelled notetaker in Nylas');
            } catch (error: any) {
                console.log('Could not cancel in Nylas:', error.message);
            }
        }

        session.status = 'cancelled';
        await session.save();

        res.status(200).json({ message: 'Notetaker cancelled successfully' });
    } catch (error: any) {
        console.error('Error cancelling notetaker:', error);
        res.status(500).json({ message: 'Failed to cancel notetaker', error: error.message });
    }
};

/**
 * Handle webhook events from Nylas for notetaker status updates
 */
export const handleNotetakerWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body;
        
        if (req.query.challenge) {
            console.log('Received challenge code:', req.query.challenge);
            res.status(200).send(req.query.challenge);
            return;
        }
        
        console.log('=== WEBHOOK RECEIVED ===');
        console.log('Event type:', payload.type);
        console.log('Full payload:', JSON.stringify(payload, null, 2));
        
        const { data } = payload;
        
        const notetakerId = data?.object?.id || data?.id;

        if (!notetakerId) {
            console.error('No notetaker ID found in webhook payload');
            res.status(200).json({ message: 'No notetaker ID found but webhook acknowledged' });
            return;
        }

        const session = await NotetakerSession.findOne({ nylasSessionId: notetakerId });

        if (!session) {
            console.error('Session not found for webhook:', notetakerId);
            res.status(200).json({ message: 'Session not found but webhook acknowledged' });
            return;
        }

        console.log('Found session:', session._id);
        const originalStatus = session.status;

        switch (payload.type) {
            case 'notetaker.created':
                const createdStatus = data?.object?.status;
                if (createdStatus === 'attending') {
                    session.status = 'in_progress';
                    if (!session.startedAt) {
                        session.startedAt = new Date();
                    }
                } else {
                    session.status = 'scheduled';
                }
                break;

            case 'notetaker.meeting_state':
                const meetingState = data?.object?.meeting_state;
                const notetakerState = data?.object?.state;
                const notetakerStatus = data?.object?.status;
                
                console.log('Meeting state:', meetingState, 'Notetaker state:', notetakerState, 'Status:', notetakerStatus);
                
                if (notetakerStatus === 'connecting' || notetakerState === 'connecting') {
                    session.status = 'joining';
                } else if (notetakerState === 'connected' || meetingState === 'recording_active') {
                    session.status = 'in_progress';
                    if (!session.startedAt) {
                        session.startedAt = new Date();
                    }
                } else if (notetakerState === 'disconnected' || meetingState === 'meeting_ended' || meetingState === 'no_activity') {
                    session.status = 'completed';
                    session.completedAt = new Date();
                }
                break;

            case 'notetaker.media':
                const mediaState = data?.object?.state;
                console.log('Media processing state:', mediaState);
                
                if (mediaState === 'processing') {
                    console.log('Media processing started for session:', session._id);
                } else if (mediaState === 'available') {
                    const media = data?.object?.media;
                    if (media?.transcript) {
                        session.transcriptUrl = media.transcript;
                        console.log('Transcript URL available:', media.transcript);
                        
                        processTranscript(session._id!.toString(), media.transcript);
                    }
                    
                    if (media?.recording) {
                        session.recordingUrl = media.recording;
                        console.log('Recording URL available:', media.recording);
                    }
                    
                    if (media?.summary) {
                        session.summaryUrl = media.summary;
                        console.log('Summary URL available:', media.summary);
                    }
                }
                break;

            case 'notetaker.updated':
                const updatedState = data?.object?.state;
                console.log('Notetaker state updated to:', updatedState);
                
                switch (updatedState) {
                    case 'scheduled':
                        session.status = 'scheduled';
                        break;
                    case 'connecting':
                    case 'waiting_for_entry':
                        session.status = 'joining';
                        break;
                    case 'attending':
                    case 'connected':
                        session.status = 'in_progress';
                        if (!session.startedAt) {
                            session.startedAt = new Date();
                        }
                        break;
                    case 'completed':
                    case 'disconnected':
                        session.status = 'completed';
                        session.completedAt = new Date();
                        break;
                    case 'failed':
                    case 'cancelled':
                        session.status = 'failed';
                        session.error = data?.object?.error_message || 'Notetaker failed or was cancelled';
                        break;
                }
                break;

            case 'notetaker.transcript.ready':
                const transcriptUrl = data?.object?.transcript_url;
                
                if (transcriptUrl) {
                    session.transcriptUrl = transcriptUrl;
                    processTranscript(session._id!.toString(), transcriptUrl);
                }
                break;

            default:
                console.log('UNHANDLED webhook type:', payload.type);
        }

        console.log('Status change:', originalStatus, '->', session.status);
        
        await session.save();
        
        res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error: any) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ message: 'Failed to process webhook', error: error.message });
    }
};

/**
 * Process transcript asynchronously: download, analyze with AI, and create meeting record
 */
async function processTranscript(sessionId: string, transcriptUrl: string): Promise<void> {
    try {
        console.log('=== PROCESSING TRANSCRIPT ===');
        console.log('Session ID:', sessionId);
        console.log('Transcript URL:', transcriptUrl);
        
        const session = await NotetakerSession.findById(sessionId);
        if (!session) {
            console.error('Session not found:', sessionId);
            return;
        }

        console.log('Downloading transcript...');
        let transcript: string | undefined;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                transcript = await downloadTranscript(transcriptUrl);
                break;
            } catch (error) {
                retryCount++;
                console.error(`Transcript download attempt ${retryCount} failed:`, error);
                if (retryCount >= maxRetries) {
                    console.error('All transcript download attempts failed for session:', sessionId);
                    session.status = 'failed';
                    session.error = 'Failed to download transcript after multiple attempts';
                    await session.save();
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
            }
        }

        console.log('Transcript downloaded, length:', transcript?.length || 0);

        if (!transcript || (typeof transcript === 'string' && transcript.trim().length === 0)) {
            console.error('Empty transcript received for session:', sessionId);
            session.status = 'failed';
            session.error = 'Empty transcript received';
            await session.save();
            return;
        }

        const transcriptText = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
        console.log('Processing transcript, length:', transcriptText.length);

        if (!transcriptText || transcriptText.trim().length === 0) {
            console.error('Empty transcript received for session:', sessionId);
            session.status = 'failed';
            session.error = 'Empty transcript received';
            await session.save();
            return;
        }

        console.log('Analyzing transcript with AI...');
        const analysis = await analyzeMeetingNotes(transcriptText);
        console.log('AI analysis completed:', analysis.title);

        const base64Content = Buffer.from(transcriptText, 'utf8').toString('base64');
        const dataUrl = `data:text/plain;base64,${base64Content}`;
        console.log('Created data URL, length:', dataUrl.length);

        const meeting = new Meeting({
            title: analysis.title,
            description: analysis.description,
            summary: analysis.summary,
            actionItems: analysis.actionItems,
            tags: analysis.tags || [],
            internalTags: analysis.internalTags || [],
            fileUrl: dataUrl,
            fileName: `${session.meetingTitle || 'Meeting Transcript'}.txt`,
            fileSize: transcriptText.length,
            uploadedBy: session.scheduledBy,
            uploaderName: session.scheduledByName
        });

        console.log('=== SAVING MEETING ===');
        console.log('Meeting data before save:', {
            title: meeting.title,
            fileUrl: meeting.fileUrl?.substring(0, 100) + '...',
            fileUrlLength: meeting.fileUrl?.length,
            fileName: meeting.fileName
        });

        await meeting.save();
        console.log('Meeting saved with ID:', meeting._id);
        
        const savedMeeting = await Meeting.findById(meeting._id);
        console.log('Verified saved meeting fileUrl exists:', !!savedMeeting?.fileUrl);
        console.log('Verified saved meeting fileUrl length:', savedMeeting?.fileUrl?.length);

        session.meetingId = meeting._id as any;
        session.status = 'completed';
        await session.save();

        console.log('Successfully processed transcript for session:', sessionId);
    } catch (error) {
        console.error('Error processing transcript:', error);
        
        try {
            const session = await NotetakerSession.findById(sessionId);
            if (session) {
                session.status = 'failed';
                session.error = error instanceof Error ? error.message : 'Unknown error processing transcript';
                await session.save();
            }
        } catch (updateError) {
            console.error('Error updating session status:', updateError);
        }
    }
}

/**
 * Check notetaker status from both database and Nylas API
 */
export const checkNotetakerStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const session = await NotetakerSession.findById(req.params.id);
        if (!session) {
            res.status(404).json({ message: 'Session not found' });
            return;
        }

        const response = await axios.get(
            `${process.env.NYLAS_API_URL}/v3/grants/${process.env.NYLAS_GRANT_ID}/notetakers/${session.nylasSessionId}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.NYLAS_API_KEY}`,
                },
            }
        );

        res.json({
            database: session,
            nylas: response.data
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};