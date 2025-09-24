import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'

/**
 * Manual Campaign Processor Trigger
 * Immediately processes all ready campaigns (useful for testing)
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    console.log(`🚀 Manual campaign processor trigger by user: ${user.email}`)

    // Import and trigger the campaign processor
    const { campaignProcessor } = await import('@/lib/campaign-processor')

    // Process campaigns immediately
    await campaignProcessor.processReadyCampaigns()

    return NextResponse.json({
      success: true,
      message: 'Campaign processor executed successfully',
      timestamp: new Date().toISOString(),
      user_id: user.id
    })

  } catch (error) {
    console.error('❌ Error triggering campaign processor:', error)
    return NextResponse.json({
      error: 'Failed to trigger campaign processor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

/**
 * Get Campaign Processor Status
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()

  try {
    // Get campaigns that are currently being processed
    const { data: activeCampaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id, name, status, created_at,
        daily_send_limit, total_contacts, emails_sent,
        first_batch_sent_at, current_batch_number, next_batch_send_time
      `)
      .eq('user_id', user.id)
      .in('status', ['sending', 'scheduled'])
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Analyze each campaign's readiness
    const campaignAnalysis = await Promise.all(
      (activeCampaigns || []).map(async (campaign) => {
        // Get email tracking count
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('sent_at')
          .eq('campaign_id', campaign.id)

        const sentCount = emailStats?.filter(e => e.sent_at)?.length || 0

        // Determine readiness
        let readyStatus = 'not_ready'
        let reason = 'Unknown'

        if (campaign.status === 'scheduled') {
          if (campaign.scheduled_date) {
            const scheduledTime = new Date(campaign.scheduled_date)
            const now = new Date()
            if (scheduledTime <= now) {
              readyStatus = 'ready'
              reason = 'Scheduled time reached'
            } else {
              readyStatus = 'waiting'
              reason = `Scheduled for ${scheduledTime.toISOString()}`
            }
          }
        } else if (campaign.status === 'sending') {
          if (!campaign.next_batch_send_time) {
            if (!campaign.first_batch_sent_at) {
              readyStatus = 'ready'
              reason = 'First batch ready to send'
            } else {
              readyStatus = 'broken'
              reason = 'Missing next_batch_send_time'
            }
          } else {
            const nextBatchTime = new Date(campaign.next_batch_send_time)
            const now = new Date()
            const timeUntilBatch = nextBatchTime.getTime() - now.getTime()

            if (timeUntilBatch <= 5 * 60 * 1000) { // Within 5 minutes
              readyStatus = 'ready'
              reason = 'Next batch time reached'
            } else {
              readyStatus = 'waiting'
              reason = `Next batch in ${Math.round(timeUntilBatch / (1000 * 60))} minutes`
            }
          }
        }

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          sent_count: sentCount,
          total_contacts: campaign.total_contacts || 0,
          daily_limit: campaign.daily_send_limit || 5,
          progress_percentage: campaign.total_contacts > 0
            ? Math.round((sentCount / campaign.total_contacts) * 100)
            : 0,
          ready_status: readyStatus,
          ready_reason: reason,
          current_batch: campaign.current_batch_number || 0,
          next_batch_time: campaign.next_batch_send_time
        }
      })
    )

    const readyToProcess = campaignAnalysis.filter(c => c.ready_status === 'ready')
    const waitingCampaigns = campaignAnalysis.filter(c => c.ready_status === 'waiting')
    const brokenCampaigns = campaignAnalysis.filter(c => c.ready_status === 'broken')

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_active: campaignAnalysis.length,
        ready_to_process: readyToProcess.length,
        waiting: waitingCampaigns.length,
        broken: brokenCampaigns.length
      },
      campaigns: {
        ready: readyToProcess,
        waiting: waitingCampaigns,
        broken: brokenCampaigns
      },
      recommendations: [
        ...(readyToProcess.length > 0 ? ['Campaigns ready - call POST to this endpoint to process'] : []),
        ...(brokenCampaigns.length > 0 ? ['Broken campaigns found - call POST /api/campaigns/fix-stuck-campaigns'] : []),
        ...(readyToProcess.length === 0 && waitingCampaigns.length === 0 && brokenCampaigns.length === 0
            ? ['No active campaigns need processing'] : [])
      ]
    })

  } catch (error) {
    console.error('❌ Error getting processor status:', error)
    return NextResponse.json({
      error: 'Failed to get processor status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})