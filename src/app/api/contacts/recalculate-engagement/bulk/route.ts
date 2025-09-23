import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { bulkRecalculateEngagement } from '@/lib/contact-engagement'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { contactIds } = body // Optional: specific contact IDs to recalculate

    if (contactIds && (!Array.isArray(contactIds) || contactIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid contactIds provided' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    const result = await bulkRecalculateEngagement(supabase, user.id, contactIds)

    return createSuccessResponse({
      message: `Engagement recalculation completed`,
      successCount: result.success,
      failedCount: result.failed,
      total: result.success + result.failed
    })

  } catch (error) {
    console.error('Bulk engagement recalculation error:', error)
    return handleApiError(error)
  }
})