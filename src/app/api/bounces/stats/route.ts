import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBounceProcessor } from '@/lib/bounce-processor'

/**
 * GET /api/bounces/stats
 *
 * Get bounce statistics for the authenticated user
 * Query params:
 * - dateFrom: ISO date string to filter bounces from a specific date
 * - campaignId: Filter bounces for a specific campaign
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom') || undefined
    const campaignId = searchParams.get('campaignId') || undefined

    const bounceProcessor = createBounceProcessor(supabase)

    // Get bounce statistics
    const stats = await bounceProcessor.getBounceStatistics(user.id, dateFrom)

    // If campaignId is provided, also get campaign-specific stats
    if (campaignId) {
      const { data: campaignBounces, error: campaignError } = await supabase
        .from('email_tracking')
        .select('bounce_type, bounce_reason, bounced_at, contact_id')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .not('bounced_at', 'is', null)
        .order('bounced_at', { ascending: false })

      if (!campaignError && campaignBounces) {
        const campaignStats = {
          total: campaignBounces.length,
          hard: campaignBounces.filter(b => b.bounce_type === 'hard').length,
          soft: campaignBounces.filter(b => b.bounce_type === 'soft').length,
          bounces: campaignBounces.map(b => ({
            contactId: b.contact_id,
            bounceType: b.bounce_type,
            bounceReason: b.bounce_reason,
            bouncedAt: b.bounced_at
          }))
        }

        return NextResponse.json({
          ...stats,
          campaign: campaignStats
        })
      }
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('❌ Error fetching bounce statistics:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch bounce statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
