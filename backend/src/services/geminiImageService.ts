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
    logoMimeType?: string;
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

        const { meetingTitle, meetingDescription, meetingDate, assetType, logoBase64, logoMimeType, organizationName, revisionInstructions } = options;

        // Build the prompt based on asset type
        let prompt = '';
        
        switch (assetType) {
            case 'poster':
                prompt = `Create a professional event poster following industry design standards.

EVENT INFORMATION:
Title: ${meetingTitle}
${meetingDescription ? `Description: ${meetingDescription}` : ''}
${meetingDate ? `Date/Time: ${meetingDate}` : ''}
${organizationName ? `Organization: ${organizationName}` : 'Organization: Näise'}
Contact: naise.org@gmail.com

CRITICAL LOGO REQUIREMENTS:
${logoBase64 ? `- A company logo HAS BEEN PROVIDED as an image. You MUST use the provided logo exactly as-is.
- DO NOT create, generate, or design a new logo under any circumstances.
- Place the provided logo in the top-left or top-center of the poster.
- Ensure the logo is clearly visible and properly sized (approximately 10-15% of poster height).
- Maintain proper spacing around the logo (minimum 5% margin from edges).
- ANALYZE the logo's colors, style, and aesthetic to inform your overall design theme.
- The poster's color scheme should complement and harmonize with the logo's colors.
- Match the logo's design personality (modern, traditional, playful, corporate, etc.) in your poster design.` : '- No logo has been provided. DO NOT create or add any logo or company branding marks.'}

DESIGN SPECIFICATIONS (Industry Standards):
Layout & Composition:
- Format: Portrait orientation (24" × 36" / 2:3 aspect ratio)
- Visual hierarchy: Logo → Title → Key Info → Details → Call-to-action
- Follow the rule of thirds for balanced composition
- Maintain consistent margins (minimum 1" / 5% on all sides)

Typography:
- Title: Large, bold, sans-serif font (minimum 72pt equivalent)
- Maximum 3 font families total
- Ensure 4.5:1 contrast ratio minimum for WCAG AA compliance
- Left-align or center-align text; avoid right-alignment for primary content
- Line spacing: 1.2-1.5 for body text, tighter for headlines

Color Scheme:
- Use 2-3 primary colors maximum
- Professional palette: Corporate blues (#1E3A8A, #3B82F6), deep purples (#6D28D9, #8B5CF6), or neutral grays (#1F2937, #4B5563)
- Include sufficient white/negative space (minimum 30% of total area)
- Ensure all text has strong contrast against backgrounds

Visual Elements:
- Use subtle geometric shapes, gradients, or abstract patterns only in background
- Avoid clipart, generic stock photos, or overly decorative elements
- If using imagery, ensure it's high-quality and relevant to the event
- Keep background elements at 20-30% opacity to not overpower text

Content Structure:
1. Logo area (if provided) - Top section
2. Event title - Prominent, upper-middle section
3. Key details (date, time, location) - Middle section, easily scannable
4. Brief description - Supporting text, smaller size
5. Call-to-action (Register, RSVP, Learn More) - Bottom section
6. Contact info or website - Footer area (small text)

Professional Standards:
- Maintain brand consistency if organization name is provided
- Use a grid system for alignment
- Create clear focal points
- Ensure readability from 10 feet away for printed posters
- Design should work in both print and digital formats`;
                break;

            case 'invite':
                prompt = `Create an elegant event invitation following professional design standards.

EVENT INFORMATION:
Title: ${meetingTitle}
${meetingDescription ? `Description: ${meetingDescription}` : ''}
${meetingDate ? `Date/Time: ${meetingDate}` : ''}
${organizationName ? `Hosted by: ${organizationName}` : 'Hosted by: näise'}
Contact: naise.org@gmail.com

CRITICAL LOGO REQUIREMENTS:
${logoBase64 ? `- A company logo HAS BEEN PROVIDED as an image. You MUST use the provided logo exactly as-is.
- DO NOT create, generate, or design a new logo under any circumstances.
- Place the provided logo at the top center or bottom center of the invitation.
- Size the logo appropriately (8-12% of invitation height).
- Maintain elegant spacing around the logo.
- ANALYZE the logo to determine appropriate color palette and design style for the invitation.
- Ensure the invitation's aesthetic complements the logo's brand personality.` : '- No logo has been provided. DO NOT create or add any logo or branding marks.'}

DESIGN SPECIFICATIONS:
Format & Layout:
- Size: Standard invitation format (5" × 7" or A5, portrait orientation)
- Card-style design with clear boundaries/frame
- Centered alignment for formal aesthetic
- Symmetrical composition
- Minimum 0.5" margins on all sides

Typography:
- Headline: Elegant serif fonts (Playfair Display, Cormorant, Libre Baskerville style)
- Body text: Clean sans-serif or complementary serif
- Include "You're Invited" or "Invitation" prominently
- Hierarchy: Invitation phrase → Event title → Details → Host
- Use proper spacing and kerning for refined look

Color Palette:
- Sophisticated, muted tones: Navy (#0F172A), charcoal (#1E293B), deep green (#064E3B)
- Accent colors: Gold (#D4AF37, #B8860B), rose gold (#B76E79), or silver (#94A3B8)
- Background: White (#FFFFFF), cream (#FFFBF0), or light gray (#F8FAFC)
- Use metallic effects or gradients sparingly for elegance

Visual Elements:
- Subtle border or frame (1-3px, possibly ornamental)
- Minimal decorative elements (thin lines, small flourishes)
- Optional: subtle watermark-style background pattern
- Avoid heavy graphics; focus on typography and space
- If using design elements, keep them refined and minimal

Content Structure:
1. "You're Invited" text (optional, decorative)
2. Event title (prominent)
3. Date and time (clear, formatted)
4. Location/venue (if applicable)
5. Host organization (if applicable)
6. RSVP instructions placeholder area
7. Logo (if provided) - top or bottom

Professional Standards:
- Formal, polished aesthetic
- Generous white space (40-50% of total area)
- Balanced, symmetrical design
- Print-ready quality
- Timeless, not trendy design approach`;
                break;

            case 'social-media':
                prompt = `Create a social media graphic optimized for digital engagement.

EVENT INFORMATION:
Title: ${meetingTitle}
${meetingDescription ? `Brief: ${meetingDescription}` : ''}
${meetingDate ? `When: ${meetingDate}` : ''}
${organizationName ? `By: ${organizationName}` : 'By: näise'}
Contact: naise.org@gmail.com

CRITICAL LOGO REQUIREMENTS:
${logoBase64 ? `- A company logo HAS BEEN PROVIDED as an image. You MUST use the provided logo exactly as-is.
- DO NOT create, generate, or design a new logo under any circumstances.
- Place the provided logo in the top-left, top-right, or bottom-right corner.
- Ensure logo is visible but doesn't dominate (6-10% of image size).
- Use proper spacing and consider using a subtle background shape for logo visibility.
- EXTRACT colors and design style from the logo to create a cohesive social media design.
- Match the logo's energy and brand personality in your overall design approach.` : '- No logo has been provided. DO NOT create or add any logo or branding marks.'}

DESIGN SPECIFICATIONS:
Format & Dimensions:
- Size: 1080px × 1080px (1:1 square ratio)
- Safe zone: Keep critical content within center 920px × 920px
- Design for mobile viewing (80% of users)
- Optimize for small screen visibility

Typography:
- Title: Large, bold, highly readable sans-serif (60-90pt equivalent)
- Maximum 2 font families
- High contrast text (white on dark, or dark on light)
- Avoid thin or light font weights
- All text should be legible when viewed at thumbnail size
- Use text shadows or outlines if text overlays images

Color Strategy:
- Bold, vibrant colors for feed visibility: Bright blues (#0EA5E9), energetic oranges (#F97316), vivid purples (#A855F7)
- High contrast combinations (minimum 7:1 ratio)
- Use gradients for modern appeal
- Consider platform backgrounds (white for Instagram, varies for LinkedIn)
- Brand colors if organization is specified

Visual Elements:
- Bold, modern design with strong focal point
- Use contemporary design trends: gradients, glass morphism, geometric shapes
- Include relevant icons or simple illustrations (not photos if possible)
- Create depth with overlapping elements or shadows
- Ensure thumb-stopping visual impact

Content Structure:
1. Logo (if provided) - corner placement
2. Eye-catching visual element or background
3. Event title - prominent, high contrast
4. Key detail (date) - secondary but clear
5. Call-to-action badge/button ("Register Now", "Join Us", "Learn More")
6. Organization name (small, if applicable)

Platform Optimization:
- Design for Instagram, LinkedIn, Twitter/X compatibility
- Ensure key information is not cropped in previews
- Use negative space strategically
- Make it shareable and recognizable
- Consider adding subtle border/frame to stand out in feeds

Engagement Elements:
- Include clear call-to-action (CTA)
- Use action-oriented language
- Create urgency if appropriate ("Limited Spots", "Coming Soon")
- Design should encourage saves/shares`;
                break;

            case 'banner':
                prompt = `Create a wide banner/header image for digital use.

EVENT INFORMATION:
Title: ${meetingTitle}
${meetingDescription ? `About: ${meetingDescription}` : ''}
${meetingDate ? `Date: ${meetingDate}` : ''}
${organizationName ? `Organization: ${organizationName}` : 'Organization: näise'}
Contact: naise.org@gmail.com

CRITICAL LOGO REQUIREMENTS:
${logoBase64 ? `- A company logo HAS BEEN PROVIDED as an image. You MUST use the provided logo exactly as-is.
- DO NOT create, generate, or design a new logo under any circumstances.
- Place the provided logo on the left side or right side of the banner.
- Size appropriately for banner format (height: 40-60% of banner height).
- Maintain proper spacing (minimum 3% margin from edges).
- ANALYZE the logo's visual elements to inform the banner's color scheme and design style.
- Create a banner design that feels cohesive with the logo's brand identity.` : '- No logo has been provided. DO NOT create or add any logo or branding marks.'}

DESIGN SPECIFICATIONS:
Format & Layout:
- Dimensions: Wide landscape (1920px × 1080px or 16:9 ratio)
- Alternative: Ultra-wide 2400px × 800px for web headers
- Horizontal composition with left-to-right flow
- Consider safe zones for different platform crops
- Minimum 5% margins on all sides

Typography:
- Title: Large, bold, left-aligned or center-aligned (80-120pt equivalent)
- Sans-serif fonts for digital clarity
- Ensure readability on various screen sizes
- Limit to 2-3 lines maximum for title
- Use clear hierarchy: Title → Subtitle/Date → Details

Color & Background:
- Professional, modern color scheme
- Use gradients (linear, left-to-right or top-to-bottom)
- Solid colors with geometric overlays
- Subtle patterns at low opacity (10-20%)
- Ensure sufficient contrast for text legibility

Visual Elements:
- Geometric shapes (circles, rectangles, triangles) for modern look
- Abstract patterns or lines
- Subtle motion blur or directional elements for dynamism
- Avoid centered composition; use asymmetric balance
- Create depth with layered elements

Content Structure:
1. Logo (if provided) - left or right side
2. Main title - prominent, left or center area
3. Supporting text (date, brief description) - below or beside title
4. Decorative elements - background and accents
5. Optional CTA element - right side
6. Generous negative space (40-50%)

Technical Requirements:
- Optimize for website headers, email headers, LinkedIn covers
- Ensure text is readable at various sizes
- Design should work on both light and dark website backgrounds
- Consider responsive behavior (how it looks when cropped)
- Maintain professional, corporate aesthetic

Professional Standards:
- Clean, uncluttered design
- Strong horizontal emphasis
- Balanced but not symmetrical
- Modern, minimalist approach
- Suitable for business/corporate contexts`;
                break;
        }

        // Add universal constraints
        prompt += `\n\nUNIVERSAL DESIGN CONSTRAINTS:
- DO NOT add watermarks, sample text, or placeholder indicators
- Create a production-ready, final design
- Ensure all text is sharp, clear, and properly kerned
- Use actual content provided, not dummy text
- Maintain professional quality suitable for public use
${logoBase64 ? '\n- CRITICAL: Use ONLY the provided logo. DO NOT generate, create, or design any logo elements.' : '\n- CRITICAL: Do NOT create, add, or generate any logos or branding marks.'}`;

        // Enhanced logo instructions when logo is provided
        if (logoBase64) {
            prompt += `\n\n🎨 LOGO & THEME MATCHING REQUIREMENTS:
⚠️ A company logo image has been provided and is included in this request. You MUST:
1. Use this exact logo in your design - do not modify, recreate, or stylize it
2. ANALYZE the logo's visual characteristics (colors, style, typography, mood)
3. CREATE a poster theme that complements and matches the logo's aesthetic
4. Extract the dominant colors from the logo and use them in your color palette
5. Match the logo's design style (modern, classic, playful, corporate, etc.)
6. Ensure the overall poster design feels cohesive with the logo's brand identity
7. Position the logo prominently according to the asset type specifications above

The goal is to create a unified, professional design where the poster theme naturally complements the uploaded logo, creating a cohesive brand experience.`;
        }

        // If this is a revision, add the revision instructions
        if (revisionInstructions) {
            prompt += `\n\n### REVISION INSTRUCTIONS ###
Apply the following specific changes to the design:
${revisionInstructions}

Maintain all other design standards and specifications unless specifically contradicted by these revision instructions.`;
        }

        console.log('[Gemini] Generating with prompt length:', prompt.length);

        // Prepare the content for the API call
        let contents;

        if (logoBase64) {
            // Multimodal content with both text and logo image
            console.log('[Gemini] Including logo image in generation request');
            contents = [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: logoMimeType || "image/png", // Use actual mime type or default to PNG
                                data: logoBase64
                            }
                        }
                    ]
                }
            ];
        } else {
            // Text-only content
            contents = prompt;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: contents,
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