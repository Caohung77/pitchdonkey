import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/ai/templates -> list user's templates (plus public)
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined

    // Fetch own + public templates
    let query = supabase
      .from('ai_templates')
      .select('*')
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error

    // Normalize potential schema differences
    const normalized = (data || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      name: t.name,
      description: t.description || '',
      category: t.category || 'custom',
      content: t.content ?? t.body_template ?? '',
      subject: t.subject ?? t.subject_template ?? '',
      variables: Array.isArray(t.variables) ? t.variables : [],
      custom_prompt: t.custom_prompt || '',
      is_default: !!t.is_default,
      usage_count: t.usage_count || 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
      is_public: !!t.is_public,
      // Enhanced campaign fields
      sender_name: t.sender_name || '',
      email_purpose: t.email_purpose || '',
      language: t.language || 'English',
      generation_options: t.generation_options || { generate_for_all: false, use_contact_info: true },
      template_type: t.template_type || 'campaign',
    }))

    return createSuccessResponse(normalized)
  } catch (error) {
    return handleApiError(error)
  }
})

// POST /api/ai/templates -> create template
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const name = (body.name || '').trim()
    const description = (body.description || '').trim()
    const category = body.category || 'custom'
    const content = (body.content || body.body_template || '').toString()
    const subject = (body.subject || body.subject_template || '').toString()
    const custom_prompt = body.custom_prompt || ''

    // Enhanced campaign fields
    const sender_name = (body.sender_name || '').trim()
    const email_purpose = (body.email_purpose || '').trim()
    const language = body.language || 'English'
    const generation_options = body.generation_options || { generate_for_all: false, use_contact_info: true }
    const template_type = body.template_type || 'campaign'

    if (!name || !content) {
      throw new Error('Template name and content are required')
    }

    // Extract variables from content
    const variableRegex = /\{\{([^}]+)\}\}/g
    const variables: string[] = []
    let match
    while ((match = variableRegex.exec(content)) !== null) {
      const v = match[1].trim()
      if (v && !variables.includes(v)) variables.push(v)
    }

    // Try insert using `content` column, fallback to subject/body columns
    let inserted: any = null
    let error1
    {
      const { data, error } = await supabase
        .from('ai_templates')
        .insert({
          user_id: user.id,
          name,
          description,
          category,
          content,
          subject,
          variables,
          custom_prompt,
          usage_count: 0,
          is_default: false,
          // Enhanced campaign fields
          sender_name,
          email_purpose,
          language,
          generation_options,
          template_type,
        } as any)
        .select('*')
        .single()
      inserted = data
      error1 = error
    }

    if (error1) {
      // Fallback to subject/body column names
      const { data, error } = await supabase
        .from('ai_templates')
        .insert({
          user_id: user.id,
          name,
          description,
          category,
          body_template: content,
          subject_template: subject || name,
          variables,
          usage_count: 0,
          is_default: false,
          // Enhanced campaign fields
          sender_name,
          email_purpose,
          language,
          generation_options,
          template_type,
        } as any)
        .select('*')
        .single()
      if (error) throw error
      inserted = data
    }

    return createSuccessResponse({ id: inserted.id })
  } catch (error) {
    return handleApiError(error)
  }
})
