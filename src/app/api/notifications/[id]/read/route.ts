import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const POST = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const supabase = createServerSupabaseClient()
    const { id: notificationId } = await params

    // Mark notification as read
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id) // Ensure user can only update their own notifications

    if (updateError) {
      console.error('Error marking notification as read:', updateError)
      return handleApiError(updateError)
    }

    return createSuccessResponse({ success: true })

  } catch (error) {
    return handleApiError(error)
  }
})