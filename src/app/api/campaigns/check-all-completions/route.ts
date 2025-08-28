import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

/**
 * Check completion status for all sending campaigns
 * Useful for batch completion checks or cleanup
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Get all sending campaigns for the user
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, total_contacts')
      .eq('user_id', user.id)
      .in('status', ['sending', 'running'])

    if (campaignsError) {
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sending campaigns found',
        campaigns_checked: 0
      })
    }

    console.log(`📊 Checking completion for ${campaigns.length} sending campaigns`)
    
    const results = []
    
    for (const campaign of campaigns) {
      // Count sent emails for this campaign
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
      
      console.log(`📊 Campaign ${campaign.name}: ${sentCount}/${totalContacts} sent`)

      // Check if campaign should be completed
      if (sentCount >= totalContacts && totalContacts > 0) {
        console.log(`🎉 Marking campaign ${campaign.name} as completed`)
        
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            status: 'completed'
          })
          .eq('id', campaign.id)

        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          success: !updateError,
          action: 'completed',
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

    const completedCount = results.filter(r => r.action === 'completed').length

    return NextResponse.json({
      success: true,
      message: `Checked ${campaigns.length} campaigns, marked ${completedCount} as completed`,
      campaigns_checked: campaigns.length,
      campaigns_completed: completedCount,
      results
    })

  } catch (error) {
    console.error('Error checking all campaign completions:', error)
    return NextResponse.json({
      error: 'Failed to check campaign completions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})