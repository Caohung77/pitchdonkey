import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

/**
 * Fix campaigns that are stuck in "sending" status even though they're completed
 * This endpoint checks all sending campaigns and marks completed ones as 'completed'
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log(`🔧 Fixing stuck campaigns for user: ${user.email}`)

    // Get all campaigns stuck in "sending" status
    const { data: stuckCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, total_contacts')
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
        .select('sent_at')
        .eq('campaign_id', campaign.id)

      if (statsError) {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          success: false,
          error: 'Failed to get email statistics'
        })
        continue
      }

      const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
      const totalContacts = campaign.total_contacts || 0
      
      console.log(`📊 Campaign "${campaign.name}": ${sentCount}/${totalContacts} emails sent`)

      // Check if campaign should be marked as completed
      if (sentCount >= totalContacts && totalContacts > 0) {
        console.log(`🎉 Fixing stuck campaign: ${campaign.name}`)
        
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            status: 'completed'
          })
          .eq('id', campaign.id)

        if (!updateError) {
          fixedCount++
        }

        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          success: !updateError,
          action: 'marked_completed',
          sent_count: sentCount,
          total_contacts: totalContacts,
          error: updateError?.message
        })
      } else {
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          success: true,
          action: 'still_sending',
          sent_count: sentCount,
          total_contacts: totalContacts,
          completion_percentage: totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0
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