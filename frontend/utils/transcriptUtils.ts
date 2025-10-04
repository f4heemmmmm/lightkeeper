/**
 * Utility functions for handling transcript decoding and formatting
 */

/**
 * Decode base64 file content to UTF-8 string
 * Handles common encoding issues with meeting transcripts
 */
export const decodeTranscriptContent = (base64Content: string): string => {
    try {
        // Remove data URL prefix if present
        const cleanBase64 = base64Content.replace(/^data:text\/plain;base64,/, '');
        
        // Decode base64 string
        const binaryString = atob(cleanBase64);
        
        // Convert binary string to byte array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Decode as UTF-8
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
    } catch (error) {
        console.error('Error decoding transcript content:', error);
        
        // Fallback: try simple atob decoding
        try {
            const cleanBase64 = base64Content.replace(/^data:text\/plain;base64,/, '');
            return atob(cleanBase64);
        } catch {
            return base64Content;
        }
    }
};

/**
 * Fetch and decode meeting file content
 */
export const fetchMeetingContent = async (fileUrl: string): Promise<string> => {
    try {
        // If it's already a base64 data URL, decode it directly
        if (fileUrl.startsWith('data:')) {
            return decodeTranscriptContent(fileUrl);
        }
        
        // Otherwise, fetch from URL
        const response = await fetch(fileUrl);
        const text = await response.text();
        return text;
    } catch (error) {
        console.error('Error fetching meeting content:', error);
        throw error;
    }
};

/**
 * Clean up common encoding artifacts in transcripts
 */
export const cleanTranscriptText = (text: string): string => {
    return text
        // Fix common UTF-8 mojibake patterns
        .replace(/â€™/g, "'")      // Right single quotation mark
        .replace(/â€œ/g, '"')      // Left double quotation mark
        .replace(/â€/g, '"')       // Right double quotation mark
        .replace(/â€"/g, '—')      // Em dash
        .replace(/â€"/g, '–')      // En dash
        .replace(/Â/g, '')         // Non-breaking space artifacts
        .replace(/â€¢/g, '•')      // Bullet point
        .replace(/â€¦/g, '…')      // Ellipsis
        // Additional common replacements
        .replace(/â/g, '—')        // Another em dash variant
        .replace(/Ã©/g, 'é')       // e with acute accent
        .replace(/Ã¨/g, 'è')       // e with grave accent
        .replace(/Ã /g, 'à')       // a with grave accent
        .replace(/Ã§/g, 'ç');      // c with cedilla
};