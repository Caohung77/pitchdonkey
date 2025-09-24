import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

/**
 * Fix campaigns that are stuck in "sending" status even though they're completed
 * AND fix campaigns with broken batch scheduling (missing next_batch_send_time)
 * This endpoint checks all sending campaigns and fixes various stuck states
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log(`🔧 Fixing stuck campaigns for user: ${user.email}`)

    // Get all campaigns stuck in "sending" status
    const { data: stuckCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id, name, status, total_contacts, daily_send_limit,
        first_batch_sent_at, current_batch_number, next_batch_send_time,
        contact_list_ids
      `)
      .eq('user_id', user.id)
      .eq('status', 'sending')

    if (campaignsError) {
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    if (!stuckCampaigns || stuckCampaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stuck campaigns found',
        fixed_count: 0
      })
    }

    console.log(`📋 Found ${stuckCampaigns.length} campaigns in sending status`)

    let fixedCount = 0
    const results = []

    for (const campaign of stuckCampaigns) {
      // Count actual sent emails for this campaign
      const { data: emailStats, error: statsError } = await supabase
        .from('email_tracking')
        .select('sent_at, created_at')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false })

      if (statsError) {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          success: false,
          error: 'Failed to get email statistics'
        })
        continue
      }

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

      const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
      const totalContacts = Math.max(campaign.total_contacts || 0, totalContactsInLists)
      const dailyLimit = campaign.daily_send_limit || 5

      console.log(`📊 Campaign "${campaign.name}": ${sentCount}/${totalContacts} emails sent (daily limit: ${dailyLimit})`)

      let fixAction = null
      let updateData = {}

      // Check if campaign should be marked as completed
      if (sentCount >= totalContacts && totalContacts > 0) {
        console.log(`🎉 Marking completed: ${campaign.name}`)
        fixAction = 'marked_completed'
        updateData = {
          status: 'completed',
          end_date: new Date().toISOString(),
          next_batch_send_time: null // Clear future scheduling
        }
      }
      // Check if campaign has broken batch scheduling
      else if (campaign.first_batch_sent_at && !campaign.next_batch_send_time && sentCount < totalContacts) {
        console.log(`🔧 Fixing broken batch scheduling: ${campaign.name}`)

        // Calculate when the next batch should be sent (24 hours from first batch)
        const firstBatchTime = new Date(campaign.first_batch_sent_at)
        const batchesAlreadySent = Math.ceil(sentCount / dailyLimit)
        const nextBatchTime = new Date(firstBatchTime.getTime() + (batchesAlreadySent * 24 * 60 * 60 * 1000))

        fixAction = 'fixed_batch_scheduling'
        updateData = {
          next_batch_send_time: nextBatchTime.toISOString(),
          current_batch_number: batchesAlreadySent + 1,
          total_contacts: totalContacts // Update if it was missing
        }
      }
      // Check if next batch is overdue (more than 25 hours late)
      else if (campaign.next_batch_send_time && sentCount < totalContacts) {
        const nextBatchTime = new Date(campaign.next_batch_send_time)
        const now = new Date()
        const hoursOverdue = (now.getTime() - nextBatchTime.getTime()) / (1000 * 60 * 60)

        if (hoursOverdue > 25) {
          console.log(`⏰ Fixing overdue batch: ${campaign.name} (${hoursOverdue.toFixed(1)}h overdue)`)

          // Reset to send immediately
          fixAction = 'reset_overdue_batch'
          updateData = {
            next_batch_send_time: new Date(now.getTime() + (5 * 60 * 1000)).toISOString(), // 5 minutes from now
            total_contacts: totalContacts
          }
        }
      }

      // Apply fix if needed
      if (fixAction && Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('campaigns')
          .update(updateData)
          .eq('id', campaign.id)

        if (!updateError) {
          fixedCount++
        }

        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          success: !updateError,
          action: fixAction,
          sent_count: sentCount,
          total_contacts: totalContacts,
          daily_limit: dailyLimit,
          fix_details: updateData,
          error: updateError?.message
        })
      } else {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          success: true,
          action: 'no_fix_needed',
          sent_count: sentCount,
          total_contacts: totalContacts,
          daily_limit: dailyLimit,
          completion_percentage: totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0,
          next_batch_time: campaign.next_batch_send_time
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${stuckCampaigns.length} campaigns, fixed ${fixedCount} stuck campaigns`,
      campaigns_checked: stuckCampaigns.length,
      campaigns_fixed: fixedCount,
      results
    })

  } catch (error) {
    console.error('Error fixing stuck campaigns:', error)
    return NextResponse.json({
      error: 'Failed to fix stuck campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})