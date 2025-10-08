import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import { getScheduledReplies, getScheduledReplyStats } from '@/lib/scheduled-replies'
import type { ScheduledReplyFilters } from '@/lib/scheduled-replies'

/**
 * GET /api/scheduled-replies
 * Get scheduled replies with optional filters
 */
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    console.log('GET /api/scheduled-replies called for user:', user.id)

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')?.split(',') as any[] | undefined
    const agent_id = searchParams.get('agent_id') || undefined
    const email_account_id = searchParams.get('email_account_id') || undefined
    const date_from = searchParams.get('date_from') || undefined
    const date_to = searchParams.get('date_to') || undefined
    const search = searchParams.get('search') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')

    const filters: ScheduledReplyFilters = {
      status,
      agent_id,
      email_account_id,
      date_from,
      date_to,
      search,
    }

    // Get scheduled replies
    const replies = await getScheduledReplies(supabase, user.id, filters, limit)

    // Get stats if requested
    const includeStats = searchParams.get('include_stats') === 'true'
    let stats = undefined
    if (includeStats) {
      stats = await getScheduledReplyStats(supabase, user.id)
    }

    const response = NextResponse.json({
      success: true,
      data: {
        replies,
        stats,
        count: replies.length,
      },
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in GET /api/scheduled-replies:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})
