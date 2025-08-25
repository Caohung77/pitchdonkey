import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { campaignProcessor } from '@/lib/campaign-processor'

/**
 * Campaign Processor Control Endpoint
 * Allows starting/stopping the automatic campaign processor
 */

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const { action } = await request.json()

    switch (action) {
      case 'start':
        console.log(`🚀 Starting automatic campaign processor for user: ${user.email}`)
        campaignProcessor.start(30000) // Check every 30 seconds
        
        return NextResponse.json({
          success: true,
          message: 'Campaign processor started',
          interval: '30 seconds',
          timestamp: new Date().toISOString()
        })

      case 'stop':
        console.log(`🛑 Stopping automatic campaign processor for user: ${user.email}`)
        campaignProcessor.stop()
        
        return NextResponse.json({
          success: true,
          message: 'Campaign processor stopped',
          timestamp: new Date().toISOString()
        })

      case 'process-now':
        console.log(`⚡ Manual campaign processing triggered by user: ${user.email}`)
        await campaignProcessor.processReadyCampaigns()
        
        return NextResponse.json({
          success: true,
          message: 'Campaign processing completed',
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['start', 'stop', 'process-now']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in campaign processor control:', error)
    return NextResponse.json({
      error: 'Failed to control campaign processor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

/**
 * Get campaign processor status
 */
export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Get campaigns currently being processed
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, status, emails_sent, total_contacts, created_at')
      .in('status', ['sending', 'scheduled'])
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        processorRunning: campaignProcessor['processingInterval'] !== null,
        activeCampaigns: campaigns?.length || 0,
        campaigns: campaigns?.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          progress: c.total_contacts > 0 ? Math.round((c.emails_sent / c.total_contacts) * 100) : 0,
          sent: c.emails_sent || 0,
          total: c.total_contacts || 0
        })) || []
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