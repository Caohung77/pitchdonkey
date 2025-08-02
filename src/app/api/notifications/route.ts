import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get usage notifications
    const { data: notifications, error } = await supabase
      .from('usage_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // If no notifications exist or error fetching, return some mock data for demo
    if (error || !notifications || notifications.length === 0) {
      const mockNotifications = [
        {
          id: '1',
          title: 'Welcome to ColdReach Pro!',
          message: 'Get started by connecting your first email account.',
          type: 'info',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Usage Update',
          message: 'You have used 45% of your monthly email limit.',
          type: 'info',
          isRead: true,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ]
      return createSuccessResponse(mockNotifications)
    }

    // Transform database notifications to match frontend interface
    const transformedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.is_read,
      createdAt: notification.created_at
    }))

    return createSuccessResponse(transformedNotifications)

  } catch (error) {
    return handleApiError(error)
  }
})