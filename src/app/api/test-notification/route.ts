import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Create a test notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'general',
        title: 'Test Notification',
        message: `Test notification sent at ${new Date().toLocaleTimeString()}`,
        data: {
          test: true,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return createSuccessResponse({
      message: 'Test notification created successfully',
      notification
    })

  } catch (error) {
    return handleApiError(error)
  }
})