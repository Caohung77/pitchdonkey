import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = params
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

    // Calculate analytics
    const totalEmails = emails.length
    const sentEmails = emails.filter(e => e.status === 'sent' || e.status === 'delivered').length
    const deliveredEmails = emails.filter(e => e.status === 'delivered').length
    const openedEmails = emails.filter(e => e.opened_at).length
    const clickedEmails = emails.filter(e => e.clicked_at).length
    const repliedEmails = emails.filter(e => e.replied_at).length
    const bouncedEmails = emails.filter(e => e.status === 'bounced').length
    const complainedEmails = emails.filter(e => e.status === 'complained').length

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

    // Populate with actual data
    emails.forEach(email => {
      if (email.sent_at) {
        const dateStr = email.sent_at.split('T')[0]
        const stats = dailyStatsMap.get(dateStr)
        if (stats) {
          if (email.status === 'sent' || email.status === 'delivered') stats.sent++
          if (email.status === 'delivered') stats.delivered++
          if (email.opened_at) stats.opened++
          if (email.clicked_at) stats.clicked++
          if (email.replied_at) stats.replied++
          if (email.status === 'bounced') stats.bounced++
        }
      }
    })

    // Convert map to array
    dailyStatsMap.forEach(stats => dailyStats.push(stats))

    // Get top performing emails (by open rate)
    const emailPerformance = emails
      .filter(e => e.status === 'delivered')
      .reduce((acc, email) => {
        const key = email.subject || 'No Subject'
        if (!acc[key]) {
          acc[key] = { subject: key, sent: 0, opened: 0, clicked: 0, replied: 0 }
        }
        acc[key].sent++
        if (email.opened_at) acc[key].opened++
        if (email.clicked_at) acc[key].clicked++
        if (email.replied_at) acc[key].replied++
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
        timestamp: email.replied_at || email.clicked_at || email.opened_at || email.sent_at,
        status: email.status
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
        bouncedEmails,
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