import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const { notification_ids, mark_all } = body

    if (mark_all) {
      // Mark all notifications as read for this user
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) {
        throw error
      }

      return createSuccessResponse({ message: 'All notifications marked as read' })
    }

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return createSuccessResponse(
        { error: 'notification_ids array is required' },
        400
      )
    }

    // Mark specific notifications as read
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .in('id', notification_ids)

    if (error) {
      throw error
    }

    return createSuccessResponse({
      message: `${notification_ids.length} notification(s) marked as read`
    })

  } catch (error) {
    return handleApiError(error)
  }
})