import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {

    // Get campaigns with basic stats
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        description,
        status,
        created_at,
        start_date,
        end_date,
        scheduled_date,
        total_contacts,
        emails_sent,
        emails_delivered,
        emails_opened,
        emails_replied,
        contact_list_ids,
        email_subject,
        html_content
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // For each campaign, get REAL contact count and email stats from database
    const campaignsWithStats = await Promise.all(
      (campaigns || []).map(async (campaign) => {
        let contactCount = campaign.total_contacts || 0

        // For simple campaigns, get contact count from contact_list_ids
        if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
          const { data: contactLists } = await supabase
            .from('contact_lists')
            .select('contact_ids')
            .in('id', campaign.contact_list_ids)
          
          if (contactLists) {
            const allContactIds = []
            contactLists.forEach(list => {
              if (list.contact_ids && Array.isArray(list.contact_ids)) {
                allContactIds.push(...list.contact_ids)
              }
            })
            contactCount = [...new Set(allContactIds)].length // Remove duplicates
          }
        }

        // Get DETAILED email tracking stats from email_tracking table
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('status, sent_at, delivered_at, opened_at, clicked_at, replied_at, bounce_reason')
          .eq('campaign_id', campaign.id)

        let emailsSent = 0
        let emailsDelivered = 0
        let emailsOpened = 0
        let emailsClicked = 0
        let emailsReplied = 0
        let emailsFailed = 0
        let emailsBounced = 0
        let lastEmailSentAt = null

        if (emailStats && emailStats.length > 0) {
          emailStats.forEach(email => {
            if (['sent', 'delivered', 'opened', 'clicked', 'replied'].includes(email.status)) {
              emailsSent++
              if (email.sent_at && (!lastEmailSentAt || email.sent_at > lastEmailSentAt)) {
                lastEmailSentAt = email.sent_at
              }
            }
            if (['delivered', 'opened', 'clicked', 'replied'].includes(email.status)) emailsDelivered++
            if (['opened', 'clicked', 'replied'].includes(email.status)) emailsOpened++
            if (email.clicked_at) emailsClicked++
            if (email.status === 'replied') emailsReplied++
            if (email.status === 'failed') emailsFailed++
            if (email.status === 'bounced' || email.bounce_reason) emailsBounced++
          })
        } else {
          // Fallback to campaign columns if email_tracking has no data
          emailsSent = campaign.emails_sent || 0
          emailsDelivered = campaign.emails_delivered || 0
          emailsOpened = campaign.emails_opened || 0
          emailsReplied = campaign.emails_replied || 0
        }

        // Calculate REAL rates from actual data
        const openRate = emailsDelivered > 0 ? Math.round((emailsOpened / emailsDelivered) * 100) : 0
        const replyRate = emailsSent > 0 ? Math.round((emailsReplied / emailsSent) * 100) : 0
        const deliveryRate = emailsSent > 0 ? Math.round((emailsDelivered / emailsSent) * 100) : 0
        const clickRate = emailsOpened > 0 ? Math.round((emailsClicked / emailsOpened) * 100) : 0
        const bounceRate = emailsSent > 0 ? Math.round((emailsBounced / emailsSent) * 100) : 0

        // Calculate progress and estimated completion
        const queuedEmails = Math.max(0, contactCount - emailsSent - emailsFailed)
        const completionPercentage = contactCount > 0 ? Math.round((emailsSent / contactCount) * 100) : 0
        
        // Estimate completion time for active campaigns
        let estimatedCompletionAt = null
        if ((campaign.status === 'sending' || campaign.status === 'running') && queuedEmails > 0) {
          // Assuming 45-second average delay between emails
          const avgDelaySeconds = 45
          const estimatedSeconds = queuedEmails * avgDelaySeconds
          const completionTime = new Date(Date.now() + (estimatedSeconds * 1000))
          estimatedCompletionAt = completionTime.toISOString()
        }

        // Calculate next send time for running campaigns
        let nextSendAt = null
        if ((campaign.status === 'sending' || campaign.status === 'running') && queuedEmails > 0) {
          // Next email in approximately 45 seconds from last sent
          if (lastEmailSentAt) {
            const nextTime = new Date(new Date(lastEmailSentAt).getTime() + (45 * 1000))
            if (nextTime > new Date()) {
              nextSendAt = nextTime.toISOString()
            } else {
              nextSendAt = new Date(Date.now() + 5000).toISOString() // 5 seconds from now
            }
          } else {
            nextSendAt = new Date(Date.now() + 5000).toISOString()
          }
        }

        return {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description || '',
          status: campaign.status,
          contactCount,
          emailsSent,
          openRate,
          replyRate,
          createdAt: campaign.created_at,
          launchedAt: campaign.start_date,
          completedAt: campaign.end_date,
          scheduledDate: campaign.scheduled_date,
          nextSendAt,
          // Enhanced progress tracking data
          total_contacts: contactCount,
          emails_delivered: emailsDelivered,
          emails_opened: emailsOpened,
          emails_clicked: emailsClicked,
          emails_replied: emailsReplied,
          emails_failed: emailsFailed,
          emails_bounced: emailsBounced,
          delivery_rate: deliveryRate,
          click_rate: clickRate,
          bounce_rate: bounceRate,
          queued_emails: queuedEmails,
          completion_percentage: completionPercentage,
          last_email_sent_at: lastEmailSentAt,
          estimated_completion_at: estimatedCompletionAt,
          updated_at: campaign.updated_at || campaign.created_at
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: campaignsWithStats
    })

  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {

    const body = await request.json()
    const {
      name,
      description,
      contactSegments,
      emailSequence,
      aiSettings,
      scheduleSettings,
      status = 'draft'
    } = body

    // Validate required fields
    if (!name || !emailSequence || emailSequence.length === 0) {
      return NextResponse.json(
        { error: 'Name and email sequence are required' },
        { status: 400 }
      )
    }

    // Create campaign with existing schema columns
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        description,
        status,
        // Map to existing columns
        daily_send_limit: scheduleSettings?.dailyLimit || 50,
        track_opens: true,
        track_clicks: true,
        track_replies: true,
        ab_test_enabled: false,
        ab_test_config: {},
        total_contacts: 0,
        emails_sent: 0,
        emails_delivered: 0,
        emails_opened: 0,
        emails_clicked: 0,
        emails_replied: 0,
        emails_bounced: 0,
        emails_complained: 0
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // If campaign is being launched, you would typically:
    // 1. Validate email accounts are connected
    // 2. Check usage limits
    // 3. Queue initial emails
    // 4. Start the campaign execution process

    return NextResponse.json({
      success: true,
      data: campaign
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})