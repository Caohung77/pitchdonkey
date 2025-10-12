import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unread_only') === 'true'

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data: notifications, error: notificationsError } = await query

    if (notificationsError) {
      if (notificationsError.code !== '42P01') {
        console.error('Error fetching notifications:', notificationsError)
      }
      // Return empty array if notifications table doesn't exist or has errors
      return createSuccessResponse({
        notifications: [],
        unread_count: 0
      })
    }

    // Get unread count
    let unreadCount = 0
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      unreadCount = count || 0
    } catch (error: any) {
      if (error?.code !== '42P01') {
        console.error('Error counting unread notifications:', error)
      }
    }

    // Transform notifications to match expected format
    const transformedNotifications = (notifications || []).map(notification => ({
      id: notification.id,
      title: notification.title || 'Notification',
      message: notification.message || '',
      type: notification.type || 'info',
      isRead: notification.is_read || false,
      createdAt: notification.created_at,
      data: notification.data || {}
    }))

    return createSuccessResponse({
      notifications: transformedNotifications,
      unread_count: unreadCount
    })

  } catch (error) {
    console.error('Notifications API error:', error)
    // Return empty array on error to prevent dashboard from breaking
    return createSuccessResponse({
      notifications: [],
      unread_count: 0
    })
  }
})

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const { type, title, message, data } = body

    if (!type || !title) {
      return createSuccessResponse(
        { error: 'Type and title are required' },
        400
      )
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type,
        title,
        message: message || null,
        data: data || {}
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return createSuccessResponse(notification)

  } catch (error) {
    return handleApiError(error)
  }
})
