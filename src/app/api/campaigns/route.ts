import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { campaignProcessor } from '@/lib/campaign-processor'

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Opportunistically process any due scheduled campaigns so UI loads reflect real send state
    try {
      await campaignProcessor.processReadyCampaigns()
    } catch (processorError) {
      console.warn('⚠️ Auto campaign processing skipped (non-fatal):', processorError)
    }

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
        html_content,
        from_email_account_id
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
        console.log(`🔍 Processing campaign: ${campaign.name} (status: ${campaign.status})`)

        // Special debug for "scheduled campaign gmail" using Nguyen Brothers
        if (campaign.name.toLowerCase().includes('gmail') && campaign.name.toLowerCase().includes('scheduled')) {
          console.log(`🔍 [NGUYEN BROTHERS DEBUG] Campaign details:`)
          console.log(`  Campaign ID: ${campaign.id}`)
          console.log(`  Contact list IDs: ${JSON.stringify(campaign.contact_list_ids)}`)
          console.log(`  Stored total_contacts: ${campaign.total_contacts}`)
          console.log(`  Current status: ${campaign.status}`)
        }
        let contactCount = campaign.total_contacts || 0

        // ENHANCED: Get contact count with multiple fallback strategies
        let realContactCount = 0
        let listNames = []
        
        // FOR COMPLETED CAMPAIGNS: Use original contact list size for display purposes
        if (campaign.status === 'completed') {
          console.log(`🔍 [COMPLETED CAMPAIGN DEBUG] ${campaign.name}:`)
          
          // Strategy 1: Use stored total_contacts as primary source (original list size)
          realContactCount = campaign.total_contacts || 0
          console.log(`  💾 Using stored total_contacts: ${campaign.total_contacts}`)
          
          // Strategy 2: If no stored total_contacts, calculate from contact lists
          if (realContactCount === 0 && campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
            const { data: contactLists } = await supabase
              .from('contact_lists')
              .select('id, name, contact_ids')
              .in('id', campaign.contact_list_ids)
            
            if (contactLists && contactLists.length > 0) {
              const allContactIds = []
              contactLists.forEach(list => {
                if (list.contact_ids && Array.isArray(list.contact_ids)) {
                  allContactIds.push(...list.contact_ids)
                }
              })
              realContactCount = [...new Set(allContactIds)].length // Remove duplicates
              console.log(`  📋 Using current contact lists count: ${realContactCount}`)
            }
          }
          
          // Strategy 3: Count email tracking records as final fallback  
          if (realContactCount === 0) {
            const { count: emailTrackingCount } = await supabase
              .from('email_tracking')
              .select('contact_id', { count: 'exact' })
              .eq('campaign_id', campaign.id)
            
            realContactCount = emailTrackingCount || 0
            console.log(`  ⚠️ Using email tracking count as fallback: ${realContactCount}`)
          }
          
          console.log(`  ✅ Final realContactCount: ${realContactCount}`)
          
          // Still get list names for display
          if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
            const { data: contactLists } = await supabase
              .from('contact_lists')
              .select('id, name')
              .in('id', campaign.contact_list_ids)
            
            if (contactLists && contactLists.length > 0) {
              contactLists.forEach(list => {
                if (list.name) {
                  listNames.push(list.name)
                }
              })
            }
          }
        } else {
          // FOR ACTIVE CAMPAIGNS: Use email tracking records as ground truth
          console.log(`🔍 [ACTIVE CAMPAIGN DEBUG] ${campaign.name}:`)
          
          // Strategy 1: Count actual email tracking records (most accurate for active campaigns)
          const { count: emailTrackingCount } = await supabase
            .from('email_tracking')
            .select('contact_id', { count: 'exact' })
            .eq('campaign_id', campaign.id)
          
          console.log(`  📊 Email tracking count: ${emailTrackingCount}`)
          console.log(`  💾 Stored total_contacts: ${campaign.total_contacts}`)
          
          // For active campaigns, use email tracking as ground truth since it represents
          // the actual contacts that were targeted when the campaign started
          if (emailTrackingCount > 0) {
            realContactCount = emailTrackingCount
            console.log(`  ✅ Using email tracking count (ground truth): ${realContactCount}`)
          } else {
            // Strategy 2: Get from contact_list_ids (only for draft campaigns)
            if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
              const { data: contactLists } = await supabase
                .from('contact_lists')
                .select('id, name, contact_ids')
                .in('id', campaign.contact_list_ids)
              
              if (contactLists && contactLists.length > 0) {
                const allContactIds = []
                contactLists.forEach(list => {
                  if (list.contact_ids && Array.isArray(list.contact_ids)) {
                    allContactIds.push(...list.contact_ids)
                  }
                })
                realContactCount = [...new Set(allContactIds)].length // Remove duplicates
                console.log(`  📋 Using current contact lists count: ${realContactCount}`)
              }
            }
            
            // Strategy 3: Use stored total_contacts as final fallback
            if (realContactCount === 0) {
              realContactCount = campaign.total_contacts || 0
              console.log(`  ⚠️ Using fallback stored count: ${realContactCount}`)
            }
          }
          
          // Get list names for display
          if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
            const { data: contactLists } = await supabase
              .from('contact_lists')
              .select('id, name')
              .in('id', campaign.contact_list_ids)
            
            if (contactLists && contactLists.length > 0) {
              contactLists.forEach(list => {
                if (list.name) {
                  listNames.push(list.name)
                }
              })
            }
          }
        }
        
        contactCount = realContactCount
        console.log(`  📊 Final contactCount for ${campaign.name}: ${contactCount}`)

        // Get DETAILED email tracking stats from email_tracking table
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('status, sent_at, delivered_at, opened_at, clicked_at, replied_at, bounce_reason')
          .eq('campaign_id', campaign.id)
          
        console.log(`  📧 Email stats records: ${emailStats?.length || 0}`)

        let emailsSent = 0
        let emailsDelivered = 0
        let emailsOpened = 0
        let emailsClicked = 0
        let emailsReplied = 0
        let emailsFailed = 0
        let emailsBounced = 0
        let lastEmailSentAt = null

        if (emailStats && emailStats.length > 0) {
          console.log(`  📧 Analyzing ${emailStats.length} email tracking records:`)
          emailStats.forEach((email, index) => {
            // Treat presence of timestamps as ground truth
            const isSent = !!email.sent_at || ['sent','delivered','opened','clicked','replied'].includes(email.status)
            const isDelivered = !!email.delivered_at || ['delivered','opened','clicked','replied'].includes(email.status)
            const isOpened = !!email.opened_at || !!email.clicked_at || !!email.replied_at || ['opened','clicked','replied'].includes(email.status)

            console.log(`    [${index + 1}] Status: ${email.status}, sent_at: ${email.sent_at}, isSent: ${isSent}`)

            if (isSent) {
              emailsSent++
              if (email.sent_at && (!lastEmailSentAt || email.sent_at > lastEmailSentAt)) {
                lastEmailSentAt = email.sent_at
              }
            }
            if (isDelivered) emailsDelivered++
            if (isOpened) emailsOpened++
            if (email.clicked_at) emailsClicked++
            if (email.replied_at || email.status === 'replied') emailsReplied++
            if (email.status === 'failed') emailsFailed++
            if (email.status === 'bounced' || email.bounce_reason) emailsBounced++
          })
          console.log(`  📊 Final counts: ${emailsSent} sent, ${emailsDelivered} delivered, ${emailsFailed} failed`)
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
        const processedEmails = emailsSent + emailsFailed
        const queuedEmails = Math.max(0, realContactCount - processedEmails)
        let completionPercentage = realContactCount > 0 ? Math.round((processedEmails / realContactCount) * 100) : 0
        console.log(`  🔢 Calculated percentage: ${completionPercentage}% (${processedEmails}/${realContactCount})`)

        // If campaign is explicitly completed, force 100% to avoid confusion
        if (campaign.status === 'completed') {
          completionPercentage = 100
          console.log(`  ✅ Forced to 100% for completed campaign`)
        }

        // If fully processed, fix status if necessary (but only if campaign was actually running)
        const shouldBeCompleted = realContactCount > 0 && processedEmails >= realContactCount &&
                                 (campaign.status === 'sending' || campaign.status === 'running')
        let derivedStatus = campaign.status
        if (shouldBeCompleted && campaign.status !== 'completed') {
          derivedStatus = 'completed'
          // Best-effort DB update to prevent stuck 'sending' label
          try {
            await supabase
              .from('campaigns')
              .update({ status: 'completed', end_date: new Date().toISOString() })
              .eq('id', campaign.id)
          } catch (e) {
            console.warn('⚠️ Failed to auto-complete campaign', campaign.id, e)
          }
        }

        // Estimate completion time for active campaigns
        let estimatedCompletionAt = null
        if ((derivedStatus === 'sending' || derivedStatus === 'running') && queuedEmails > 0) {
          // Assuming 45-second average delay between emails
          const avgDelaySeconds = 45
          const estimatedSeconds = queuedEmails * avgDelaySeconds
          const completionTime = new Date(Date.now() + (estimatedSeconds * 1000))
          estimatedCompletionAt = completionTime.toISOString()
        }

        // Calculate next send time for running campaigns
        let nextSendAt = null
        if ((derivedStatus === 'sending' || derivedStatus === 'running') && queuedEmails > 0) {
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
          status: derivedStatus,
          contactCount: realContactCount, // Use realContactCount for correct count
          emailsSent,
          openRate,
          replyRate,
          createdAt: campaign.created_at,
          launchedAt: campaign.start_date,
          completedAt: campaign.end_date,
          scheduledDate: campaign.scheduled_date,
          nextSendAt,
          // Enhanced progress tracking data
          total_contacts: realContactCount, // Use realContactCount consistently
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
          updated_at: campaign.updated_at || campaign.created_at,
          // Contact list information
          list_names: listNames,
          contact_list_ids: campaign.contact_list_ids,
          // Email account information
          from_email_account_id: campaign.from_email_account_id
        }
      })
    )

    // Fetch email account information for campaigns that have email accounts
    const emailAccountIds = [...new Set(campaignsWithStats
      .map(c => c.from_email_account_id)
      .filter(Boolean))]

    let emailAccountsMap = {}
    if (emailAccountIds.length > 0) {
      const { data: emailAccounts } = await supabase
        .from('email_accounts')
        .select('id, email, display_name, provider')
        .in('id', emailAccountIds)

      if (emailAccounts) {
        emailAccountsMap = emailAccounts.reduce((acc, account) => {
          acc[account.id] = account
          return acc
        }, {})
      }
    }

    // Add email account info to campaigns
    const campaignsWithEmailAccounts = campaignsWithStats.map(campaign => ({
      ...campaign,
      email_accounts: campaign.from_email_account_id ? emailAccountsMap[campaign.from_email_account_id] : null
    }))

    return NextResponse.json({
      success: true,
      data: campaignsWithEmailAccounts
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
