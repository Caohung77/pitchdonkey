import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get user notifications
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError)
      // Return empty array if notifications table doesn't exist or has errors
      return createSuccessResponse([])
    }

    // Transform notifications to match expected format
    const transformedNotifications = (notifications || []).map(notification => ({
      id: notification.id,
      title: notification.title || 'Notification',
      message: notification.message || '',
      type: notification.type || 'info',
      isRead: notification.is_read || false,
      createdAt: notification.created_at
    }))

    return createSuccessResponse(transformedNotifications)

  } catch (error) {
    console.error('Notifications API error:', error)
    // Return empty array on error to prevent dashboard from breaking
    return createSuccessResponse([])
  }
})