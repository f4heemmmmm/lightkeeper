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