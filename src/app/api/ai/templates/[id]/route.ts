import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const DELETE = withAuth(async (_request: NextRequest, user, context) => {
  try {
    const supabase = await createServerSupabaseClient()
    const id = context?.params?.id
    if (!id) throw new Error('Template id is required')

    const { error } = await supabase
      .from('ai_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_default', false)

    if (error) throw error
    return createSuccessResponse({ id })
  } catch (error) {
    return handleApiError(error)
  }
})

export const PUT = withAuth(async (request: NextRequest, user, context) => {
  try {
    const supabase = await createServerSupabaseClient()
    const id = context?.params?.id
    const updates = await request.json()
    if (!id) throw new Error('Template id is required')

    // Support both `content` and `body_template`/`subject_template`
    const content = updates.content ?? updates.body_template
    const subject = updates.subject ?? updates.subject_template

    // Extract variables when content provided
    if (typeof content === 'string') {
      const variableRegex = /\{\{([^}]+)\}\}/g
      const variables: string[] = []
      let match
      while ((match = variableRegex.exec(content)) !== null) {
        const v = match[1].trim()
        if (v && !variables.includes(v)) variables.push(v)
      }
      updates.variables = variables
    }

    let updated
    let { data, error } = await supabase
      .from('ai_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) {
      // Fallback key names
      const fallback = {
        name: updates.name,
        description: updates.description,
        category: updates.category,
        body_template: content,
        subject_template: subject,
        variables: updates.variables,
        updated_at: new Date().toISOString(),
      }
      const res2 = await supabase
        .from('ai_templates')
        .update(fallback as any)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('*')
        .single()
      if (res2.error) throw res2.error
      updated = res2.data
    } else {
      updated = data
    }

    return createSuccessResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
})

