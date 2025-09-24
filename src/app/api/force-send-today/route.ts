import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'

/**
 * Force Send Today's Batch
 * Manually triggers email sending for campaigns that should send today
 * Overrides normal scheduling logic for testing/emergency use
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()

  try {
    console.log(`🚀 Force sending today's emails for user: ${user.email}`)

    const body = await request.json().catch(() => ({}))
    const { campaign_id, force_all = false } = body

    // Get campaigns that might need to send today
    let campaignsQuery = supabase
      .from('campaigns')
      .select(`
        id, name, status, created_at,
        daily_send_limit, total_contacts, emails_sent,
        first_batch_sent_at, current_batch_number, next_batch_send_time,
        contact_list_ids, html_content, email_subject, description,
        from_email_account_id
      `)
      .eq('user_id', user.id)

    if (campaign_id) {
      campaignsQuery = campaignsQuery.eq('id', campaign_id)
    } else {
      // Get campaigns that could potentially send more emails
      campaignsQuery = campaignsQuery.in('status', ['sending', 'scheduled', 'completed'])
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`)
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No campaigns found',
        campaign_id_filter: campaign_id || 'none'
      })
    }

    console.log(`📋 Found ${campaigns.length} campaigns to analyze`)

    const results = []

    for (const campaign of campaigns) {
      console.log(`\n🎯 Analyzing campaign: ${campaign.name}`)

      // Get total contacts from contact lists
      let totalContactsInLists = 0
      if (campaign.contact_list_ids?.length > 0) {
        const { data: contactLists } = await supabase
          .from('contact_lists')
          .select('contact_ids')
          .in('id', campaign.contact_list_ids)

        contactLists?.forEach(list => {
          totalContactsInLists += list.contact_ids?.length || 0
        })
      }

      // Get email sending history
      const { data: emailStats } = await supabase
        .from('email_tracking')
        .select('sent_at, contact_id, status')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false })

      const sentCount = emailStats?.filter(e => e.sent_at)?.length || 0
      const totalContacts = Math.max(campaign.total_contacts || 0, totalContactsInLists)
      const dailyLimit = campaign.daily_send_limit || 5
      const remainingContacts = totalContacts - sentCount

      console.log(`📊 Stats: ${sentCount}/${totalContacts} sent (${remainingContacts} remaining, daily limit: ${dailyLimit})`)

      // Skip if no contacts remaining
      if (remainingContacts <= 0) {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          action: 'skipped',
          reason: 'All contacts already contacted',
          stats: { sent: sentCount, total: totalContacts, remaining: 0 }
        })
        continue
      }

      // Skip if not forced and campaign is completed
      if (!force_all && campaign.status === 'completed') {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          action: 'skipped',
          reason: 'Campaign marked as completed (use force_all=true to override)',
          stats: { sent: sentCount, total: totalContacts, remaining: remainingContacts }
        })
        continue
      }

      try {
        console.log(`⚡ Force processing campaign: ${campaign.name}`)

        // Reset campaign to sending status and fix batch timing
        const now = new Date()
        const updateData = {
          status: 'sending',
          current_batch_number: Math.ceil(sentCount / dailyLimit) + 1,
          next_batch_send_time: new Date(now.getTime() + (2 * 60 * 1000)).toISOString(), // 2 minutes from now
          total_contacts: totalContacts,
          updated_at: now.toISOString()
        }

        // Set first_batch_sent_at if not set
        if (!campaign.first_batch_sent_at) {
          updateData.first_batch_sent_at = now.toISOString()
        }

        const { error: updateError } = await supabase
          .from('campaigns')
          .update(updateData)
          .eq('id', campaign.id)

        if (updateError) {
          throw new Error(`Failed to update campaign: ${updateError.message}`)
        }

        console.log(`✅ Campaign ${campaign.name} reset to sending status`)

        // Trigger immediate processing
        const { campaignProcessor } = await import('@/lib/campaign-processor')
        await campaignProcessor.processReadyCampaigns()

        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          action: 'processed',
          reason: 'Campaign reset and processed',
          stats: {
            sent: sentCount,
            total: totalContacts,
            remaining: remainingContacts,
            daily_limit: dailyLimit,
            next_batch_in_minutes: 2
          },
          updates_applied: updateData
        })

      } catch (error) {
        console.error(`❌ Error processing campaign ${campaign.name}:`, error)
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          action: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
          stats: { sent: sentCount, total: totalContacts, remaining: remainingContacts }
        })
      }
    }

    const processedCount = results.filter(r => r.action === 'processed').length
    const skippedCount = results.filter(r => r.action === 'skipped').length
    const failedCount = results.filter(r => r.action === 'failed').length

    return NextResponse.json({
      success: true,
      message: `Force send completed: ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed`,
      timestamp: new Date().toISOString(),
      summary: {
        campaigns_analyzed: campaigns.length,
        campaigns_processed: processedCount,
        campaigns_skipped: skippedCount,
        campaigns_failed: failedCount
      },
      results,
      instructions: [
        'Wait 2-3 minutes for emails to be sent',
        'Check campaign analytics to verify sends',
        'Use force_all=true to override completed status',
        'Use campaign_id parameter to target specific campaign'
      ]
    })

  } catch (error) {
    console.error('❌ Error in force send today:', error)
    return NextResponse.json({
      error: 'Force send failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

/**
 * Get campaigns that could send today
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()

  try {
    // Get campaigns that might need to send
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id, name, status, created_at,
        daily_send_limit, total_contacts, emails_sent,
        first_batch_sent_at, current_batch_number, next_batch_send_time,
        contact_list_ids
      `)
      .eq('user_id', user.id)
      .in('status', ['sending', 'scheduled', 'completed'])
      .order('created_at', { ascending: false })

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`)
    }

    const analysis = await Promise.all(
      (campaigns || []).map(async (campaign) => {
        // Get total contacts
        let totalContactsInLists = 0
        if (campaign.contact_list_ids?.length > 0) {
          const { data: contactLists } = await supabase
            .from('contact_lists')
            .select('contact_ids')
            .in('id', campaign.contact_list_ids)

          contactLists?.forEach(list => {
            totalContactsInLists += list.contact_ids?.length || 0
          })
        }

        // Get sent count
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('sent_at')
          .eq('campaign_id', campaign.id)

        const sentCount = emailStats?.filter(e => e.sent_at)?.length || 0
        const totalContacts = Math.max(campaign.total_contacts || 0, totalContactsInLists)
        const remainingContacts = totalContacts - sentCount

        // Determine if can send today
        let canSendToday = false
        let reason = 'Unknown'

        if (remainingContacts <= 0) {
          reason = 'All contacts already contacted'
        } else if (campaign.status === 'completed') {
          reason = 'Campaign marked as completed (can override with force_all=true)'
          canSendToday = true // Can force
        } else if (campaign.status === 'sending') {
          if (!campaign.next_batch_send_time) {
            canSendToday = true
            reason = 'Ready to send (missing batch time)'
          } else {
            const nextBatchTime = new Date(campaign.next_batch_send_time)
            const now = new Date()
            const hoursUntil = (nextBatchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

            if (hoursUntil <= 1) { // Within 1 hour
              canSendToday = true
              reason = hoursUntil <= 0 ? 'Overdue for sending' : `Ready in ${Math.round(hoursUntil * 60)} minutes`
            } else {
              reason = `Next batch in ${hoursUntil.toFixed(1)} hours`
            }
          }
        } else if (campaign.status === 'scheduled') {
          canSendToday = true
          reason = 'Scheduled campaign'
        }

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          sent_count: sentCount,
          total_contacts: totalContacts,
          remaining_contacts: remainingContacts,
          daily_limit: campaign.daily_send_limit || 5,
          can_send_today: canSendToday,
          reason,
          next_batch_time: campaign.next_batch_send_time,
          current_batch: campaign.current_batch_number || 0
        }
      })
    )

    const canSendToday = analysis.filter(c => c.can_send_today && c.remaining_contacts > 0)
    const completed = analysis.filter(c => c.remaining_contacts <= 0)
    const waiting = analysis.filter(c => !c.can_send_today && c.remaining_contacts > 0)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_campaigns: analysis.length,
        can_send_today: canSendToday.length,
        completed: completed.length,
        waiting: waiting.length
      },
      campaigns: {
        can_send_today: canSendToday,
        completed,
        waiting
      },
      actions: {
        force_send_all: `POST /api/force-send-today {"force_all": true}`,
        force_send_specific: `POST /api/force-send-today {"campaign_id": "campaign-id"}`,
        check_processor: `GET /api/trigger-campaign-processor`
      }
    })

  } catch (error) {
    console.error('❌ Error getting force send status:', error)
    return NextResponse.json({
      error: 'Failed to get force send status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})