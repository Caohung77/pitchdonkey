import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Fix campaign completion logic for campaigns stuck in "sending" status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, campaignId } = body

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    switch (action) {
      case 'fix_specific_campaign':
        if (!campaignId) {
          return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
        }

        return await fixSpecificCampaign(supabase, campaignId)

      case 'fix_all_stuck_campaigns':
        return await fixAllStuckCampaigns(supabase)

      case 'fix_email_tracking_status':
        return await fixEmailTrackingStatus(supabase)

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Error in fix campaign completion:', error)
    return NextResponse.json({
      error: 'Fix failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function fixSpecificCampaign(supabase: any, campaignId: string) {
  console.log(`🔧 Fixing campaign: ${campaignId}`)

  // Get campaign details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Get email tracking stats
  const { data: emailTracking, error: trackingError } = await supabase
    .from('email_tracking')
    .select('sent_at, bounced_at, status')
    .eq('campaign_id', campaignId)

  if (trackingError) {
    return NextResponse.json({ error: trackingError.message }, { status: 500 })
  }

  // Calculate correct statistics
  const totalTracked = emailTracking?.length || 0
  const sentEmails = emailTracking?.filter(t => t.sent_at !== null).length || 0
  const bouncedEmails = emailTracking?.filter(t => t.bounced_at !== null).length || 0
  const processedEmails = sentEmails // In this case, all sent emails also bounced
  const totalContacts = campaign.total_contacts || 0

  console.log(`📊 Campaign stats: ${processedEmails}/${totalContacts} processed, ${bouncedEmails} bounced`)

  // Determine new status
  let newStatus = campaign.status
  if (processedEmails >= totalContacts && totalContacts > 0) {
    newStatus = 'completed'
  } else if (processedEmails > 0) {
    newStatus = 'running'
  }

  // Update campaign with correct statistics
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      emails_sent: sentEmails,
      emails_bounced: bouncedEmails,
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Fix inconsistent email tracking statuses (pending but bounced)
  const inconsistentRecords = emailTracking?.filter(t =>
    t.status === 'pending' && t.bounced_at !== null
  ) || []

  if (inconsistentRecords.length > 0) {
    console.log(`🔧 Fixing ${inconsistentRecords.length} inconsistent tracking records`)

    for (const record of inconsistentRecords) {
      await supabase
        .from('email_tracking')
        .update({ status: 'failed' })
        .eq('campaign_id', campaignId)
        .eq('sent_at', record.sent_at)
    }
  }

  return NextResponse.json({
    success: true,
    campaignId,
    previousStatus: campaign.status,
    newStatus,
    statistics: {
      total_contacts: totalContacts,
      processed_emails: processedEmails,
      sent_emails: sentEmails,
      bounced_emails: bouncedEmails,
      fixed_tracking_records: inconsistentRecords.length
    },
    message: `Campaign ${campaign.name} fixed successfully`
  })
}

async function fixAllStuckCampaigns(supabase: any) {
  console.log('🔧 Fixing all stuck campaigns...')

  // Find campaigns in "sending" status that should be completed
  const { data: stuckCampaigns, error: stuckError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'sending')

  if (stuckError) {
    return NextResponse.json({ error: stuckError.message }, { status: 500 })
  }

  if (!stuckCampaigns || stuckCampaigns.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No stuck campaigns found',
      fixed: 0
    })
  }

  const results = []
  let fixed = 0

  for (const campaign of stuckCampaigns) {
    try {
      // Get email tracking for this campaign
      const { data: emailTracking } = await supabase
        .from('email_tracking')
        .select('sent_at, bounced_at, status')
        .eq('campaign_id', campaign.id)

      const totalTracked = emailTracking?.length || 0
      const sentEmails = emailTracking?.filter(t => t.sent_at !== null).length || 0
      const bouncedEmails = emailTracking?.filter(t => t.bounced_at !== null).length || 0
      const totalContacts = campaign.total_contacts || 0

      // Check if this campaign should be completed
      if (sentEmails >= totalContacts && totalContacts > 0) {
        console.log(`✅ Fixing campaign: ${campaign.name} (${sentEmails}/${totalContacts})`)

        // Update campaign status
        await supabase
          .from('campaigns')
          .update({
            emails_sent: sentEmails,
            emails_bounced: bouncedEmails,
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id)

        // Fix inconsistent tracking records
        const inconsistentRecords = emailTracking?.filter(t =>
          t.status === 'pending' && t.bounced_at !== null
        ) || []

        if (inconsistentRecords.length > 0) {
          for (const record of inconsistentRecords) {
            await supabase
              .from('email_tracking')
              .update({ status: 'failed' })
              .eq('campaign_id', campaign.id)
              .eq('sent_at', record.sent_at)
          }
        }

        fixed++
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          processed: sentEmails,
          total: totalContacts,
          fixed_tracking: inconsistentRecords.length
        })
      }
    } catch (error) {
      console.error(`❌ Error fixing campaign ${campaign.id}:`, error)
      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return NextResponse.json({
    success: true,
    message: `Fixed ${fixed} stuck campaigns`,
    fixed,
    total_checked: stuckCampaigns.length,
    results
  })
}

async function fixEmailTrackingStatus(supabase: any) {
  console.log('🔧 Fixing inconsistent email tracking statuses...')

  // Find tracking records that are "pending" but have bounce timestamps
  const { data: inconsistentRecords, error: inconsistentError } = await supabase
    .from('email_tracking')
    .select('id, campaign_id, status, sent_at, bounced_at')
    .eq('status', 'pending')
    .not('bounced_at', 'is', null)

  if (inconsistentError) {
    return NextResponse.json({ error: inconsistentError.message }, { status: 500 })
  }

  if (!inconsistentRecords || inconsistentRecords.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No inconsistent tracking records found',
      fixed: 0
    })
  }

  console.log(`🔧 Found ${inconsistentRecords.length} inconsistent tracking records`)

  // Update all inconsistent records to "failed" status
  const { error: updateError } = await supabase
    .from('email_tracking')
    .update({ status: 'failed' })
    .eq('status', 'pending')
    .not('bounced_at', 'is', null)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Fixed ${inconsistentRecords.length} inconsistent tracking records`,
    fixed: inconsistentRecords.length,
    details: inconsistentRecords.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      was_status: 'pending',
      now_status: 'failed',
      bounce_time: r.bounced_at
    }))
  })
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Fix Campaign Completion Tool',
    available_actions: [
      'fix_specific_campaign - Fix a specific campaign by ID',
      'fix_all_stuck_campaigns - Fix all campaigns stuck in sending status',
      'fix_email_tracking_status - Fix inconsistent email tracking statuses'
    ],
    usage: 'POST with { "action": "action_name", "campaignId": "uuid" }'
  })
}