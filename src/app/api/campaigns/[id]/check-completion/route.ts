import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

/**
 * Check and update campaign completion status
 * Automatically marks campaigns as completed when all emails are sent
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: campaignId } = await params
    
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status, total_contacts, user_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // If already completed, just return current status
    if (campaign.status === 'completed') {
      return NextResponse.json({ 
        success: true, 
        message: 'Campaign is already completed',
        current_status: campaign.status
      })
    }

    // Only auto-complete sending/running campaigns, but allow checking others for debugging
    if (campaign.status !== 'sending' && campaign.status !== 'running') {
      // Still do the progress check for debugging, but don't auto-complete
      const { data: emailStats, error: statsError } = await supabase
        .from('email_tracking')
        .select('sent_at')
        .eq('campaign_id', campaignId)

      if (!statsError) {
        const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
        const totalContacts = campaign.total_contacts || 0
        
        return NextResponse.json({ 
          success: true, 
          message: `Campaign status is ${campaign.status}, not auto-completing`,
          current_status: campaign.status,
          sent_count: sentCount,
          total_contacts: totalContacts,
          completion_percentage: totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0
        })
      }

      return NextResponse.json({ 
        success: true, 
        message: `Campaign status is ${campaign.status}, not in sending status`,
        current_status: campaign.status
      })
    }

    // Count actual sent emails from email_tracking table
    const { data: emailStats, error: statsError } = await supabase
      .from('email_tracking')
      .select('sent_at')
      .eq('campaign_id', campaignId)

    if (statsError) {
      return NextResponse.json({ error: 'Failed to get email statistics' }, { status: 500 })
    }

    const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
    const totalContacts = campaign.total_contacts || 0

    console.log(`📊 Checking completion for campaign ${campaignId}: ${sentCount}/${totalContacts} sent`)

    // Check if campaign is complete
    if (sentCount >= totalContacts && totalContacts > 0) {
      console.log(`🎉 Campaign ${campaignId} is complete, updating status`)
      
      // Update campaign status to completed
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update campaign status' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Campaign marked as completed',
        previous_status: campaign.status,
        new_status: 'completed',
        sent_count: sentCount,
        total_contacts: totalContacts,
        completion_percentage: 100
      })
    }

    // Campaign is not yet complete
    return NextResponse.json({
      success: true,
      message: 'Campaign is still in progress',
      current_status: campaign.status,
      sent_count: sentCount,
      total_contacts: totalContacts,
      completion_percentage: totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0
    })

  } catch (error) {
    console.error('Error checking campaign completion:', error)
    return NextResponse.json({
      error: 'Failed to check campaign completion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})