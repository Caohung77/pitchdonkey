import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { fixedCampaignProcessor } from '@/lib/campaign-processor-fixed'

export const GET = withAuth(async (request: NextRequest, user, { params }) => {
  try {
    // Ensure any due scheduled batches are flushed before returning analytics
    try {
      await fixedCampaignProcessor.processReadyCampaigns()
    } catch (processorError) {
      console.warn('⚠️ Auto campaign processing (analytics) skipped:', processorError)
    }

    const { id } = await params
    const supabase = createServerSupabaseClient()

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return handleApiError(new Error('Campaign not found'))
    }

    // Get email tracking data for this campaign
    const { data: emailTracking, error: trackingError } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('campaign_id', id)
      .order('sent_at', { ascending: false })

    if (trackingError) {
      console.error('Error fetching email tracking:', trackingError)
    }

    const emails = emailTracking || []

    // Fixed analytics: Derive state from timestamps and status accurately
    // CRITICAL: Only count emails as "bounced" if they were actually sent first and then bounced
    // Send failures should NOT be counted as bounces
    const isSent = (e: any) => !!(e.sent_at || e.delivered_at || e.opened_at || e.clicked_at || e.replied_at)
    const isDelivered = (e: any) => !!(e.delivered_at || e.opened_at || e.clicked_at || e.replied_at)
    const isOpened = (e: any) => !!e.opened_at
    const isClicked = (e: any) => !!e.clicked_at
    const isReplied = (e: any) => !!e.replied_at
    const isFailed = (e: any) => e.status === 'failed' && !e.sent_at // Failed to send (never sent)
    const isBounced = (e: any) => {
      // Only count as bounced if:
      // 1. Email was actually sent (has sent_at timestamp), AND
      // 2. Has bounce indicators (bounced_at or bounce_reason or status='bounced')
      const wasSent = !!(e.sent_at || e.delivered_at)
      const hasBounceIndicators = !!(e.bounced_at || e.bounce_reason || e.status === 'bounced')
      return wasSent && hasBounceIndicators
    }
    const isComplained = (e: any) => e.status === 'complained'

    // Calculate analytics with accurate counts
    const totalEmails = emails.length
    const sentEmails = emails.filter(isSent).length
    const deliveredEmails = emails.filter(isDelivered).length
    const openedEmails = emails.filter(isOpened).length
    const clickedEmails = emails.filter(isClicked).length
    const repliedEmails = emails.filter(isReplied).length
    const bouncedEmails = emails.filter(isBounced).length // Only actual bounces
    const failedEmails = emails.filter(isFailed).length // Send failures
    const complainedEmails = emails.filter(isComplained).length

    // Calculate rates
    const deliveryRate = sentEmails > 0 ? Math.round((deliveredEmails / sentEmails) * 100) : 0
    const openRate = deliveredEmails > 0 ? Math.round((openedEmails / deliveredEmails) * 100) : 0
    const clickRate = openedEmails > 0 ? Math.round((clickedEmails / openedEmails) * 100) : 0
    const replyRate = deliveredEmails > 0 ? Math.round((repliedEmails / deliveredEmails) * 100) : 0
    const bounceRate = sentEmails > 0 ? Math.round((bouncedEmails / sentEmails) * 100) : 0
    const complaintRate = sentEmails > 0 ? Math.round((complainedEmails / sentEmails) * 100) : 0

    // Get daily stats for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyStats = []
    const dailyStatsMap = new Map()

    // Initialize all days with 0 values
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      dailyStatsMap.set(dateStr, {
        date: dateStr,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0
      })
    }

    // Populate with actual data (derive counts by timestamps)
    emails.forEach(email => {
      // Use sent_at day for sent; fallback to first available timestamp
      const sentTs = email.sent_at || email.delivered_at || email.opened_at || email.clicked_at || email.replied_at
      if (sentTs) {
        const dateStr = String(sentTs).split('T')[0]
        const stats = dailyStatsMap.get(dateStr)
        if (stats) {
          if (isSent(email)) stats.sent++
          if (isDelivered(email)) stats.delivered++
          if (isOpened(email)) stats.opened++
          if (isClicked(email)) stats.clicked++
          if (isReplied(email)) stats.replied++
          if (isBounced(email)) stats.bounced++
        }
      }
    })

    // Convert map to array
    dailyStatsMap.forEach(stats => dailyStats.push(stats))

    // Get top performing emails (by open rate)
    const emailPerformance = emails
      .filter(e => isDelivered(e))
      .reduce((acc, email) => {
        const key = email.subject || 'No Subject'
        if (!acc[key]) {
          acc[key] = { subject: key, sent: 0, opened: 0, clicked: 0, replied: 0 }
        }
        acc[key].sent++
        if (isOpened(email)) acc[key].opened++
        if (isClicked(email)) acc[key].clicked++
        if (isReplied(email)) acc[key].replied++
        return acc
      }, {})

    const topEmails = Object.values(emailPerformance)
      .map((email: any) => ({
        ...email,
        openRate: email.sent > 0 ? Math.round((email.opened / email.sent) * 100) : 0,
        clickRate: email.opened > 0 ? Math.round((email.clicked / email.opened) * 100) : 0,
        replyRate: email.sent > 0 ? Math.round((email.replied / email.sent) * 100) : 0
      }))
      .sort((a, b) => b.openRate - a.openRate)
      .slice(0, 10)

    // Get recent activity
    const recentActivity = emails
      .slice(0, 20)
      .map(email => ({
        id: email.id,
        type: email.replied_at ? 'reply' : email.clicked_at ? 'click' : email.opened_at ? 'open' : 'sent',
        recipient: email.recipient_email,
        subject: email.subject,
        timestamp: email.replied_at || email.clicked_at || email.opened_at || email.sent_at || email.delivered_at,
        status: email.status || (isBounced(email) ? 'bounced' : isReplied(email) ? 'replied' : isClicked(email) ? 'clicked' : isOpened(email) ? 'opened' : isDelivered(email) ? 'delivered' : isSent(email) ? 'sent' : 'pending')
      }))

    const analytics = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        createdAt: campaign.created_at,
        startDate: campaign.start_date,
        endDate: campaign.end_date
      },
      overview: {
        totalEmails,
        sentEmails,
        deliveredEmails,
        openedEmails,
        clickedEmails,
        repliedEmails,
        bouncedEmails, // Only actual bounces
        failedEmails, // Send failures (separate from bounces)
        complainedEmails,
        deliveryRate,
        openRate,
        clickRate,
        replyRate,
        bounceRate,
        complaintRate
      },
      dailyStats,
      topEmails,
      recentActivity
    }

    return createSuccessResponse(analytics)

  } catch (error) {
    return handleApiError(error)
  }
})
