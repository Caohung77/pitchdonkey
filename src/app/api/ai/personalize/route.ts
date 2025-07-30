import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AIPersonalizationService } from '@/lib/ai-providers'
import { aiPersonalizationSchema } from '@/lib/validations'
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors'

// POST /api/ai/personalize - Personalize content for contacts
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const body = await request.json()
    const validatedData = aiPersonalizationSchema.parse(body)

    // Get contacts data
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', validatedData.contact_ids)
      .eq('user_id', user.id)

    if (contactsError || !contacts) {
      throw new ValidationError('Failed to fetch contacts')
    }

    // Get template if provided
    let templateContent = ''
    if (validatedData.template_id) {
      const { data: template, error: templateError } = await supabase
        .from('ai_templates')
        .select('content')
        .eq('id', validatedData.template_id)
        .eq('user_id', user.id)
        .single()

      if (templateError || !template) {
        throw new ValidationError('Template not found')
      }
      templateContent = template.content
    } else if (validatedData.custom_prompt) {
      templateContent = validatedData.custom_prompt
    } else {
      throw new ValidationError('Either template_id or custom_prompt is required')
    }

    const aiService = new AIPersonalizationService()

    // Create personalization requests
    const requests = contacts.map(contact => ({
      contactData: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        company_name: contact.company_name,
        job_title: contact.job_title,
        industry: contact.industry,
        website: contact.website,
        custom_fields: contact.custom_fields,
      },
      templateContent,
      customPrompt: validatedData.custom_prompt,
      variables: validatedData.variables,
      provider: validatedData.ai_provider,
    }))

    // Process personalization
    const results = await aiService.bulkPersonalize(requests)

    // Store results in database
    const personalizationRecords = results.map((result, index) => ({
      user_id: user.id,
      contact_id: contacts[index].id,
      template_id: validatedData.template_id,
      original_content: templateContent,
      personalized_content: result.personalizedContent,
      ai_provider: result.provider,
      tokens_used: result.tokensUsed,
      confidence_score: result.confidence,
      processing_time: result.processingTime,
      variables_used: validatedData.variables,
    }))

    const { data: savedResults, error: saveError } = await supabase
      .from('ai_personalizations')
      .insert(personalizationRecords)
      .select()

    if (saveError) {
      console.error('Failed to save personalization results:', saveError)
      // Continue anyway, return the results
    }

    // Update template usage count if template was used
    if (validatedData.template_id) {
      await supabase
        .from('ai_templates')
        .update({
          usage_count: supabase.raw('usage_count + 1'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', validatedData.template_id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      success: true,
      data: {
        results: results.map((result, index) => ({
          contact_id: contacts[index].id,
          contact_name: `${contacts[index].first_name} ${contacts[index].last_name}`,
          ...result,
        })),
        summary: {
          total_processed: results.length,
          total_tokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
          average_confidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
          average_processing_time: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
        },
      },
      message: `Successfully personalized content for ${results.length} contacts`,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}