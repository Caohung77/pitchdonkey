import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ValidationError } from '@/lib/errors'
import { ContactEnrichmentService } from '@/lib/contact-enrichment'
import { PersonalizationEngine } from '@/lib/personalization-engine'

interface OutreachGenerationRequest {
  purpose: string
  language: 'English' | 'German'
  signature: string
  contact_id?: string
  tone?: 'professional' | 'casual' | 'warm' | 'direct'
  length?: 'short' | 'medium' | 'long'
  use_enrichment?: boolean
}

// Expert outreach email agent prompt (used when falling back, aligned with placeholder policy)
const OUTREACH_AGENT_PROMPT = `You are an expert outreach email copywriter.  
Your job is to write **concise, high-response emails** tailored to the given purpose and language.  

Follow these rules strictly:
1. Start with a compelling subject line (relevant, personal, not spammy) - USE personalization variables like {{first_name}} and {{company}} in the subject when appropriate.
2. Personalize the opening by referencing something about the recipient using placeholders (use {{first_name}} and {{company}} variables effectively, do not invent real data).
3. Communicate value quickly—make it clear how this benefits the recipient.
4. Keep it **short (75–150 words)** and scannable.
5. Use one clear call-to-action (CTA).
6. Maintain professional but warm tone.
7. Include the provided signature at the end with proper HTML formatting and line breaks.
8. Output clean HTML with inline CSS (max-width: 600px, simple personal email styling - NOT newsletter style).
9. Use Arial or similar web-safe fonts.
10. Make it look like a personal email, not a marketing newsletter.
11. **IMPORTANT - Links:** If you include any links in the email, use complete, valid URLs starting with https://. Keep URLs clean and simple (e.g., https://example.com/page). Do NOT add any tracking parameters or query strings - the system will automatically add UTM parameters and click tracking.

Generate a complete email including the signature. The signature should be properly formatted with line breaks.

Purpose: {{purpose}}
Language: {{language}} 
Signature: {{signature}}

You must return a JSON object with exactly this structure:
{
  "subject": "Your generated subject line with {{variables}} if appropriate",
  "htmlContent": "Complete HTML email content including the signature"
}

The HTML should be clean, simple, and personal-looking. Include the signature at the bottom with proper HTML formatting.`

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body: OutreachGenerationRequest = await request.json()
    
    // Validate input
    if (!body.purpose?.trim()) {
      throw new ValidationError('Purpose is required')
    }
    if (!body.signature?.trim()) {
      throw new ValidationError('Signature is required')  
    }
    if (!['English', 'German'].includes(body.language)) {
      throw new ValidationError('Language must be English or German')
    }

    console.log('🤖 Generating enhanced outreach email:', { 
      purpose: body.purpose.substring(0, 100) + '...',
      language: body.language,
      tone: body.tone || 'professional',
      length: body.length || 'medium',
      contactId: body.contact_id || 'none',
      useEnrichment: body.use_enrichment !== false
    })

    // Initialize PersonalizationEngine
    const personalizationEngine = new PersonalizationEngine()

    // Build enhanced prompt with intelligent personalization
    const enhancedPromptResult = await personalizationEngine.generateEnhancedPrompt(
      {
        purpose: body.purpose,
        language: body.language,
        signature: body.signature,
        tone: body.tone,
        length: body.length
      },
      body.contact_id && body.use_enrichment !== false ? body.contact_id : undefined,
      body.contact_id && body.use_enrichment !== false ? user.id : undefined
    )

    console.log('📊 Personalization Context:', {
      level: enhancedPromptResult.personalizationLevel,
      score: enhancedPromptResult.personalizationScore,
      insights: enhancedPromptResult.usedInsights.join(', ') || 'none'
    })

    // Initialize Google Gemini AI
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      throw new ValidationError('Google Gemini API key not configured')
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    console.log('📝 Enhanced prompt length:', enhancedPromptResult.enhancedPrompt.length)

    // Generate content using Gemini with enhanced prompt
    let generatedContent: string
    try {
      const result = await model.generateContent(enhancedPromptResult.enhancedPrompt)
      const response = await result.response
      generatedContent = response.text()

      console.log('✅ Gemini API response received, length:', generatedContent?.length || 0)

      if (!generatedContent) {
        throw new ValidationError('Failed to generate email content - empty response')
      }
    } catch (geminiError: any) {
      console.error('🚨 Gemini API Error:', {
        message: geminiError.message,
        code: geminiError.code,
        status: geminiError.status
      })
      
      // Fallback to base prompt if enhanced prompt fails
      console.log('🔄 Retrying with fallback prompt...')
      try {
        const fallbackResult = await model.generateContent(enhancedPromptResult.fallbackPrompt)
        const fallbackResponse = await fallbackResult.response
        generatedContent = fallbackResponse.text()
      } catch (fallbackError) {
        throw new ValidationError(`AI generation failed: ${geminiError.message || 'Unknown error'}`)
      }
    }

    // Parse the generated content
    let parsedResponse
    try {
      const jsonMatch = generatedContent.match(/\{[\s\S]*"subject"[\s\S]*"htmlContent"[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse JSON response, using fallback parsing')
    }

    let subject = 'Regarding our conversation'
    let htmlContent = generatedContent

    if (parsedResponse && parsedResponse.subject && parsedResponse.htmlContent) {
      // AI returned proper JSON format
      subject = parsedResponse.subject
      htmlContent = parsedResponse.htmlContent
    } else {
      // Fallback parsing
      const subjectPatterns = [
        /Subject:\s*(.+)/i,
        /Subject Line:\s*(.+)/i,
        /"subject":\s*"([^"]+)"/i
      ]

      for (const pattern of subjectPatterns) {
        const match = generatedContent.match(pattern)
        if (match && match[1]) {
          subject = match[1].trim()
          break
        }
      }

      // Format content if not properly structured
      if (!htmlContent.includes('<div') && !htmlContent.includes('<p')) {
        const lines = htmlContent.split('\n').filter(line => line.trim() && !line.toLowerCase().includes('subject'))
        const formattedContent = lines.map(line => `<p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">${line.trim()}</p>`).join('\n  ')
        
        htmlContent = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${formattedContent}
</div>`.trim()
      }
    }

    // Return enhanced response with personalization metadata
    return createSuccessResponse({
      subject: subject,
      htmlContent: htmlContent,
      personalization: {
        level: enhancedPromptResult.personalizationLevel,
        score: enhancedPromptResult.personalizationScore,
        insights_used: enhancedPromptResult.usedInsights,
        enrichment_available: enhancedPromptResult.personalizationLevel !== 'none'
      }
    })

  } catch (error) {
    console.error('Enhanced outreach generation error:', error)
    return handleApiError(error)
  }
})