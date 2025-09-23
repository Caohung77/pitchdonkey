import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { recalculateContactEngagement } from '@/lib/contact-engagement'

export const POST = withAuth(async (_request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .neq('status', 'deleted')

    if (error) {
      throw error
    }

    let processed = 0
    if (contacts && contacts.length > 0) {
      for (const contact of contacts) {
        if (contact?.id) {
          await recalculateContactEngagement(supabase, contact.id)
          processed++
        }
      }
    }

    return createSuccessResponse({ processed })
  } catch (error) {
    console.error('Error recalculating contact engagement:', error)
    return handleApiError(error)
  }
})
