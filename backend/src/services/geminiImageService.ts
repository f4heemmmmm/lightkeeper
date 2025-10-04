import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

export interface GenerateAssetOptions {
    meetingTitle: string;
    meetingDescription?: string;
    meetingDate?: string;
    assetType: 'poster' | 'invite' | 'social-media' | 'banner';
    logoBase64?: string;
    organizationName?: string;
    revisionInstructions?: string;
}

export interface GeneratedAsset {
    imageBase64: string;
    mimeType: string;
}

/**
 * Generate event asset using Gemini 2.5 Flash Image
 */
export const generateEventAsset = async (options: GenerateAssetOptions): Promise<GeneratedAsset> => {
    try {
        console.log('[Gemini] Generating event asset...');
        console.log('[Gemini] Asset type:', options.assetType);
        console.log('[Gemini] Meeting:', options.meetingTitle);
        if (options.revisionInstructions) {
            console.log('[Gemini] Revision requested:', options.revisionInstructions);
        }

        const { meetingTitle, meetingDescription, meetingDate, assetType, logoBase64, organizationName, revisionInstructions } = options;

        // Build the prompt based on asset type
        let prompt = '';
        
        switch (assetType) {
            case 'poster':
                prompt = `Create a professional, modern event poster with the following details:
                
Event Title: ${meetingTitle}
${meetingDescription ? `Description: ${meetingDescription}` : ''}
${meetingDate ? `Date: ${meetingDate}` : ''}
${organizationName ? `Organization: ${organizationName}` : ''}

Design Requirements:
- Modern, professional design with a clean layout
- Bold, readable typography for the title
- Use a sophisticated color scheme (blues, purples, or corporate colors)
- Include white space for balance
- Make it suitable for printing and digital display
- Size: Vertical poster format (portrait orientation)
${logoBase64 ? '- Incorporate the provided logo in a prominent but balanced position' : ''}
- Include subtle geometric shapes or abstract elements in the background
- Professional and business-appropriate aesthetic`;
                break;

            case 'invite':
                prompt = `Create an elegant event invitation card with the following details:

Event Title: ${meetingTitle}
${meetingDescription ? `Description: ${meetingDescription}` : ''}
${meetingDate ? `Date: ${meetingDate}` : ''}
${organizationName ? `Hosted by: ${organizationName}` : ''}

Design Requirements:
- Elegant, formal invitation design
- Sophisticated typography with serif fonts for titles
- Clean, minimalist layout
- Use soft, professional colors (white, cream, navy, gold accents)
- Card-style format suitable for email or print
- Include "You're Invited" or similar welcoming text
${logoBase64 ? '- Place the logo subtly at top or bottom' : ''}
- Professional border or frame
- Leave space for RSVP information`;
                break;

            case 'social-media':
                prompt = `Create a social media post graphic for the following event:

Event Title: ${meetingTitle}
${meetingDescription ? `Brief: ${meetingDescription}` : ''}
${meetingDate ? `When: ${meetingDate}` : ''}
${organizationName ? `By: ${organizationName}` : ''}

Design Requirements:
- Square format optimized for Instagram/LinkedIn
- Eye-catching, bold design
- High contrast for visibility in social feeds
- Modern, trendy aesthetic
- Incorporate relevant icons or illustrations
- Text should be large and readable on mobile
${logoBase64 ? '- Feature the logo prominently' : ''}
- Use vibrant, attention-grabbing colors
- Include call-to-action text like "Join Us" or "Register Now"`;
                break;

            case 'banner':
                prompt = `Create a wide banner/header image for the following event:

Event Title: ${meetingTitle}
${meetingDescription ? `About: ${meetingDescription}` : ''}
${meetingDate ? `Date: ${meetingDate}` : ''}
${organizationName ? `Organization: ${organizationName}` : ''}

Design Requirements:
- Wide banner format (landscape orientation, 16:9 or similar)
- Suitable for website headers or email headers
- Modern, professional design
- Bold title text positioned prominently
- Clean background with subtle patterns or gradients
${logoBase64 ? '- Include logo on one side' : ''}
- Professional color scheme
- Balanced composition with good use of negative space`;
                break;
        }

        // If logo is provided, add it to the context
        if (logoBase64) {
            prompt += '\n\nIMPORTANT: A company logo has been provided. Integrate it naturally into the design.';
        }

        // If this is a revision, add the revision instructions
        if (revisionInstructions) {
            prompt += `\n\n### REVISION INSTRUCTIONS ###\nPlease modify the design with the following changes:\n${revisionInstructions}\n\nMaintain the overall style and format, but apply these specific modifications.`;
        }

        console.log('[Gemini] Generating with prompt length:', prompt.length);

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: prompt,
        });

        console.log('[Gemini] Response received');

        // Extract image from response with proper null checks
        if (!response.candidates || response.candidates.length === 0) {
            throw new Error('No candidates in response');
        }

        const candidate = response.candidates[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
            throw new Error('Invalid response structure');
        }

        for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
                console.log('[Gemini] Image generated successfully');
                return {
                    imageBase64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'image/png'
                };
            }
        }

        throw new Error('No image data in response');
    } catch (error: any) {
        console.error('[Gemini] Error generating asset:', error.message);
        if (error.stack) {
            console.error('[Gemini] Stack:', error.stack);
        }
        throw new Error(`Failed to generate asset: ${error.message}`);
    }
};

/**
 * Save generated asset to file system (optional, for debugging or caching)
 */
export const saveAssetToFile = (imageBase64: string, filename: string): string => {
    try {
        const uploadDir = path.join(__dirname, '../../uploads/assets');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        const buffer = Buffer.from(imageBase64, 'base64');
        fs.writeFileSync(filePath, buffer);
        
        console.log('[Gemini] Asset saved to:', filePath);
        return filePath;
    } catch (error: any) {
        console.error('[Gemini] Error saving asset:', error);
        throw error;
    }
};

