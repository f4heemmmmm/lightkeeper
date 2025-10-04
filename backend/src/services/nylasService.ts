import axios from 'axios';

const NYLAS_API_URL = 'https://api.us.nylas.com';
const NYLAS_API_KEY = process.env.NYLAS_API_KEY;
const NYLAS_GRANT_ID = process.env.NYLAS_GRANT_ID;

/**
 * Test Nylas API connection
 */
export const testNylasConnection = async (): Promise<any> => {
    try {
        console.log('Testing Nylas API connection...');
        console.log('API URL:', NYLAS_API_URL);
        console.log('Grant ID:', NYLAS_GRANT_ID);
        
        const response = await axios.get(
            `${NYLAS_API_URL}/v3/grants/${NYLAS_GRANT_ID}`,
            {
                headers: {
                    Authorization: `Bearer ${NYLAS_API_KEY}`,
                },
            }
        );
        
        console.log('Nylas connection successful:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('Nylas connection test failed:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
};

/**
 * Create a notetaker session to join a meeting
 */
export const createNotetakerSession = async (
    meetingUrl: string,
    meetingTitle?: string
): Promise<any> => {
    try {
        const response = await axios.post(
            `${NYLAS_API_URL}/v3/grants/${NYLAS_GRANT_ID}/notetakers`,
            {
                meeting_link: meetingUrl,
                name: meetingTitle || 'Lightkeeper Notetaker',
            },
            {
                headers: {
                    Authorization: `Bearer ${NYLAS_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data.data;
    } catch (error: any) {
        throw new Error(`Failed to create notetaker: ${error.response?.data?.message || error.message}`);
    }
};

/**
 * Get notetaker session details by session ID
 */
export const getNotetakerSession = async (sessionId: string): Promise<any> => {
    try {
        const response = await axios.get(
            `${NYLAS_API_URL}/v3/grants/${NYLAS_GRANT_ID}/notetakers/${sessionId}`,
            {
                headers: {
                    Authorization: `Bearer ${NYLAS_API_KEY}`,
                },
            }
        );
        return response.data.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            throw new Error(`Notetaker session not found: ${sessionId}`);
        }
        throw new Error(`Failed to get notetaker: ${error.response?.data?.message || error.message}`);
    }
};

/**
 * Cancel or stop a notetaker session
 */
export const stopNotetakerSession = async (sessionId: string): Promise<void> => {
    try {
        await axios.delete(
            `${NYLAS_API_URL}/v3/grants/${NYLAS_GRANT_ID}/notetakers/${sessionId}`,
            {
                headers: {
                    Authorization: `Bearer ${NYLAS_API_KEY}`,
                },
            }
        );
    } catch (error: any) {
        if (error.response?.status === 404) {
            throw new Error(`Notetaker session not found: ${sessionId}`);
        }
        if (error.response?.status === 400) {
            throw new Error(`Cannot cancel notetaker in current state: ${error.response?.data?.message}`);
        }
        if (error.response?.status === 405) {
            throw new Error(`Cannot cancel notetaker - operation not supported in current state`);
        }
        throw new Error(`Failed to stop notetaker: ${error.response?.data?.message || error.message}`);
    }
};

/**
 * Download and parse transcript from Nylas transcript URL
 */
export const downloadTranscript = async (transcriptUrl: string): Promise<string> => {
    try {
        const response = await axios.get(transcriptUrl, {
            headers: {
                Authorization: `Bearer ${NYLAS_API_KEY}`,
            },
        });
        
        const transcriptData = response.data;
        
        if (typeof transcriptData === 'object' && transcriptData.transcript) {
            return transcriptData.transcript;
        } else if (typeof transcriptData === 'string') {
            return transcriptData;
        } else if (Array.isArray(transcriptData)) {
            return transcriptData.map(segment => segment.text || segment.content || '').join(' ');
        }
        
        return JSON.stringify(transcriptData);
    } catch (error: any) {
        throw new Error(`Failed to download transcript: ${error.response?.data?.message || error.message}`);
    }
};

export interface NylasEmail {
    id: string;
    grant_id: string;
    subject: string;
    from: Array<{ email: string; name?: string }>;
    to: Array<{ email: string; name?: string }>;
    date: number; // Unix timestamp
    body?: string;
    snippet?: string;
}

/**
 * Fetch emails from a specific grant (email account)
 * @param grantId - The Nylas grant ID for the email account
 * @param limit - Maximum number of emails to fetch (default: 50)
 * @param receivedAfter - Unix timestamp to fetch emails received after this time
 */
export const fetchEmails = async (
    grantId: string,
    limit: number = 50,
    receivedAfter?: number
): Promise<NylasEmail[]> => {
    try {
        console.log('[Nylas] Fetching emails...');
        console.log('[Nylas] Grant ID:', grantId);
        console.log('[Nylas] Limit:', limit);
        console.log('[Nylas] Received After:', receivedAfter ? new Date(receivedAfter * 1000).toISOString() : 'Not set');
        
        const params: any = {
            limit,
        };
        
        if (receivedAfter) {
            params.received_after = receivedAfter;
        }

        const url = `${NYLAS_API_URL}/v3/grants/${grantId}/messages`;
        console.log('[Nylas] API URL:', url);
        console.log('[Nylas] Params:', JSON.stringify(params));

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${NYLAS_API_KEY}`,
            },
            params,
        });

        const emails = response.data.data || [];
        console.log(`[Nylas]  Successfully fetched ${emails.length} emails`);
        
        if (emails.length > 0) {
            console.log('[Nylas] First email:', {
                id: emails[0].id,
                subject: emails[0].subject,
                date: new Date(emails[0].date * 1000).toISOString()
            });
        }

        return emails;
    } catch (error: any) {
        console.error('[Nylas]  Error fetching emails:');
        console.error('[Nylas] Status:', error.response?.status);
        console.error('[Nylas] Status Text:', error.response?.statusText);
        console.error('[Nylas] Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('[Nylas] Error Message:', error.message);
        console.error('[Nylas] Full error:', error);
        throw new Error(`Failed to fetch emails: ${error.response?.data?.message || error.message}`);
    }
};

/**
 * Fetch a single email with full details including body
 * @param grantId - The Nylas grant ID for the email account
 * @param messageId - The message ID to fetch
 */
export const fetchEmailById = async (
    grantId: string,
    messageId: string
): Promise<NylasEmail> => {
    try {
        console.log('[Nylas] Fetching email by ID:', messageId);
        
        const url = `${NYLAS_API_URL}/v3/grants/${grantId}/messages/${messageId}`;
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${NYLAS_API_KEY}`,
            },
        });

        console.log('[Nylas]  Successfully fetched email details');
        return response.data.data;
    } catch (error: any) {
        console.error('[Nylas]  Error fetching email by ID:');
        console.error('[Nylas] Message ID:', messageId);
        console.error('[Nylas] Status:', error.response?.status);
        console.error('[Nylas] Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('[Nylas] Error Message:', error.message);
        throw new Error(`Failed to fetch email: ${error.response?.data?.message || error.message}`);
    }
};