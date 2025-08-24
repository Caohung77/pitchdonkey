import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { campaignProcessor } from '@/lib/campaign-processor'

/**
 * Manual campaign processing trigger endpoint
 * This can be used to manually trigger campaign processing for testing
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log(`🚀 Manual campaign processing triggered by user: ${user.email}`)

    // Process campaigns immediately
    await campaignProcessor.processReadyCampaigns()

    return NextResponse.json({
      success: true,
      message: 'Campaign processing completed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in manual campaign processing:', error)
    return NextResponse.json({
      error: 'Failed to process campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

/**
 * Get campaign processor status
 */
export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Get campaigns that would be processed
    const { data: pendingCampaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id, name, status, created_at, scheduled_date,
        contact_list_ids,
        email_accounts!inner(email, provider)
      `)
      .in('status', ['sending', 'scheduled'])
      .eq('email_accounts.user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    // Check for scheduled campaigns ready to send
    const now = new Date()
    const readyToSend = pendingCampaigns?.filter(campaign => {
      if (campaign.status === 'sending') return true
      if (campaign.status === 'scheduled' && campaign.scheduled_date) {
        return new Date(campaign.scheduled_date) <= now
      }
      return false
    }) || []

    const waitingToSend = pendingCampaigns?.filter(campaign => {
      if (campaign.status === 'scheduled' && campaign.scheduled_date) {
        return new Date(campaign.scheduled_date) > now
      }
      return false
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        totalPending: pendingCampaigns?.length || 0,
        readyToSend: readyToSend.length,
        waitingScheduled: waitingToSend.length,
        campaigns: {
          readyToSend: readyToSend.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            contactLists: c.contact_list_ids?.length || 0,
            emailAccount: c.email_accounts?.email
          })),
          waitingScheduled: waitingToSend.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            scheduledDate: c.scheduled_date,
            contactLists: c.contact_list_ids?.length || 0,
            emailAccount: c.email_accounts?.email
          }))
        }
      }
    })

  } catch (error) {
    console.error('Error getting campaign processor status:', error)
    return NextResponse.json({
      error: 'Failed to get processor status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})