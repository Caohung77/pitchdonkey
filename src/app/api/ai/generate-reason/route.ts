import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ValidationError } from '@/lib/errors'
import { ContactEnrichmentService } from '@/lib/contact-enrichment'
import { PersonalizationEngine } from '@/lib/personalization-engine'

interface ReasonGenerationRequest {
  purpose: string
  contact_id?: string
  length: 'short' | 'medium' | 'detailed'
  use_contact_info: boolean
  language?: 'English' | 'German'
}

// Length-specific prompts for personalized reason generation
const getReasonPrompt = (length: 'short' | 'medium' | 'detailed', hasContactData: boolean) => {
  const lengthSpecs = {
    short: {
      sentences: '2 sentences',
      description: 'concise and direct',
      wordCount: '20-40 words'
    },
    medium: {
      sentences: '4 sentences', 
      description: 'balanced with context',
      wordCount: '40-80 words'
    },
    detailed: {
      sentences: '6+ sentences',
      description: 'comprehensive with multiple connection points', 
      wordCount: '80-150 words'
    }
  }

  const spec = lengthSpecs[length]
  const contextInstruction = hasContactData 
    ? "Use the provided contact and company data to create specific, personalized connection points. Reference their actual role, company, industry, and any relevant details from their LinkedIn profile or company information."
    : "Create believable, industry-relevant connection points without inventing specific details. Use general but compelling reasons that would resonate with professionals in their field."

  return `You are an expert at crafting personalized connection reasons for outreach emails.

Your task is to generate ONLY a personalized reason explaining why you're reaching out to this person. This will be inserted into an email template at the ((personalised reason)) placeholder.

Requirements:
- Length: Exactly ${spec.sentences} (${spec.wordCount})
- Style: ${spec.description}
- Tone: Professional but warm and authentic
- Purpose: ${hasContactData ? 'Highly personalized based on their actual data' : 'Relevant but general'}

${contextInstruction}

The reason should:
1. Explain believably how you discovered them or their company
2. Connect their background/role to the email purpose  
3. Create a natural bridge to the main email content
4. Feel authentic and not AI-generated
5. Avoid generic phrases like "I came across your profile"

Context will be provided about the email purpose and ${hasContactData ? 'detailed contact information' : 'general recipient context'}.

Return ONLY the personalized reason text, nothing else. No quotes, no formatting, just the reason text that will be inserted into the email.`
}

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body: ReasonGenerationRequest = await request.json()
    
    // Validate input
    if (!body.purpose?.trim()) {
      throw new ValidationError('Email purpose is required')
    }
    if (!['short', 'medium', 'detailed'].includes(body.length)) {
      throw new ValidationError('Length must be short, medium, or detailed')
    }

    console.log('🧠 Generating personalized reason:', { 
      purpose: body.purpose.substring(0, 100) + '...',
      length: body.length,
      contactId: body.contact_id || 'none',
      useContactInfo: body.use_contact_info,
      language: body.language || 'English'
    })

    let contactContext = ''
    let hasRichContactData = false

    // Get contact data if requested and contact_id provided
    if (body.use_contact_info && body.contact_id) {
      try {
        // Get contact data directly from database
        const { createServerSupabaseClient } = await import('@/lib/supabase-server')
        const supabase = createServerSupabaseClient()
        
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select(`
            id, first_name, last_name, email, company, website,
            linkedin_headline, linkedin_summary, linkedin_about,
            enrichment_data, custom_fields
          `)
          .eq('id', body.contact_id)
          .eq('user_id', user.id)
          .single()

        if (contact && !contactError) {
          hasRichContactData = true
          
          contactContext = `
CONTACT INFORMATION:
- Name: ${contact.first_name} ${contact.last_name}
- Company: ${contact.company || 'Not specified'}
- Email: ${contact.email}
- LinkedIn Headline: ${contact.linkedin_headline || 'Not available'}
- LinkedIn Summary: ${contact.linkedin_summary || 'Not available'}
- LinkedIn About: ${contact.linkedin_about || 'Not available'}
- Company Website: ${contact.website || 'Not available'}

ENRICHMENT DATA:
${contact.enrichment_data ? JSON.stringify(contact.enrichment_data, null, 2) : 'Limited enrichment data available'}

CUSTOM FIELDS:
${contact.custom_fields ? JSON.stringify(contact.custom_fields, null, 2) : 'No custom fields'}
`

          console.log('📊 Contact Context Generated:', {
            hasData: true,
            contactName: `${contact.first_name} ${contact.last_name}`,
            hasLinkedIn: !!(contact.linkedin_headline || contact.linkedin_summary),
            hasEnrichment: !!contact.enrichment_data
          })
        } else {
          console.log('⚠️  Could not fetch contact data:', contactError)
          hasRichContactData = false
        }

      } catch (error) {
        console.log('⚠️  Contact enrichment failed, using basic approach:', error)
        hasRichContactData = false
      }
    }

    // Build the complete prompt
    const basePrompt = getReasonPrompt(body.length, hasRichContactData)
    const fullPrompt = `${basePrompt}

EMAIL PURPOSE: ${body.purpose}
LANGUAGE: ${body.language || 'English'}

${hasRichContactData ? contactContext : 'GENERAL CONTEXT: Create a believable reason without specific personal details.'}

Generate the personalized reason now:`

    // Initialize Google Gemini AI
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      throw new ValidationError('Google Gemini API key not configured')
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    console.log('🤖 Sending prompt to AI...')
    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    let reasonText = response.text().trim()

    // Clean up the response - remove any quotes or extra formatting
    reasonText = reasonText
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^\*\*|\*\*$/g, '') // Remove bold formatting
      .replace(/^#+\s*/, '') // Remove markdown headers
      .trim()

    console.log('✅ Generated reason:', {
      length: body.length,
      wordCount: reasonText.split(' ').length,
      sentenceCount: reasonText.split(/[.!?]+/).filter(s => s.trim()).length,
      hasContactData: hasRichContactData,
      preview: reasonText.substring(0, 100) + '...'
    })

    // Validate the response
    if (!reasonText || reasonText.length < 10) {
      throw new ValidationError('Failed to generate meaningful reason text')
    }

    return createSuccessResponse({
      reason: reasonText,
      length: body.length,
      word_count: reasonText.split(' ').length,
      sentence_count: reasonText.split(/[.!?]+/).filter(s => s.trim()).length,
      personalization_level: hasRichContactData ? 'high' : 'standard',
      confidence: hasRichContactData ? 0.85 : 0.65,
      message: 'Personalized reason generated successfully'
    })

  } catch (error) {
    console.error('❌ Reason generation failed:', error)
    return handleApiError(error)
  }
})