import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { emailTracker } from '@/lib/email-tracking'

// GET /api/replies/[campaignId] - Get replies for a specific campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const resolvedParams = await params
    const { campaignId } = resolvedParams
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, user_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get replies for this campaign
    const { data: replies, error: repliesError } = await supabase
      .from('email_replies')
      .select(`
        *,
        incoming_emails (
          subject,
          from_address,
          date_received,
          text_content
        ),
        contacts (
          first_name,
          last_name,
          email,
          company
        )
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (repliesError) {
      throw repliesError
    }

    // Get reply tracking statistics
    const replyStats = await emailTracker.getReplyTrackingData(campaignId, 'week')

    // Group replies by type for summary
    const repliesByType = {}
    const repliesBySentiment = {}
    let requiresReview = 0

    replies?.forEach(reply => {
      // Count by type
      repliesByType[reply.reply_type] = (repliesByType[reply.reply_type] || 0) + 1
      
      // Count by sentiment
      if (reply.sentiment) {
        repliesBySentiment[reply.sentiment] = (repliesBySentiment[reply.sentiment] || 0) + 1
      }
      
      // Count requiring review
      if (reply.requires_human_review) {
        requiresReview++
      }
    })

    const summary = {
      total: replies?.length || 0,
      byType: repliesByType,
      bySentiment: repliesBySentiment,
      requiresReview,
      replyRate: replyStats.replyRate
    }

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name
        },
        replies: replies || [],
        summary,
        stats: replyStats
      }
    })

  } catch (error) {
    console.error('❌ Error getting campaign replies:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}