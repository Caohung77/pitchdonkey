import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/ai/templates/[id]/preview
// Body: { variables: Record<string,string> }
export const POST = withAuth(async (request: NextRequest, user, context) => {
  try {
    const { params } = context || ({} as any)
    const id = params?.id
    if (!id) throw new Error('Template id is required')

    const supabase = await createServerSupabaseClient()
    const body = await request.json().catch(() => ({}))
    const variables: Record<string, string> = body?.variables || {}

    // Fetch the template (own or public)
    const { data: tpl, error } = await supabase
      .from('ai_templates')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .maybeSingle()

    if (error) throw error
    if (!tpl) throw new Error('Template not found')

    const content: string = (tpl as any).content ?? tpl.body_template ?? ''
    if (!content) return createSuccessResponse({ preview: '' })

    // Replace {{variables}} with provided values
    let preview = content
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      preview = preview.replace(regex, value || `{{${key}}}`)
    })

    return createSuccessResponse({ preview })
  } catch (error) {
    return handleApiError(error)
  }
})

