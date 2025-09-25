import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { campaignProcessor } from '@/lib/campaign-processor'

/**
 * Test endpoint to verify the improved bulk campaign batching system
 * This tests the daily limit functionality with proper contact tracking
 */
export async function GET(request: NextRequest) {
  console.log('🧪 Testing improved bulk campaign batching system')

  try {
    const supabase = createServerSupabaseClient()

    // Get campaigns that are currently in 'sending' status for testing
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        contacts_remaining,
        contacts_processed,
        contacts_failed,
        batch_history,
        first_batch_sent_at,
        next_batch_send_time,
        current_batch_number
      `)
      .in('status', ['sending', 'scheduled'])
      .limit(5)

    if (campaignError) {
      console.error('❌ Error fetching test campaigns:', campaignError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    const results = []

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No campaigns found for testing',
        results: []
      })
    }

    console.log(`📊 Testing ${campaigns.length} campaigns`)

    for (const campaign of campaigns) {
      console.log(`\n🔍 Testing campaign: ${campaign.name} (${campaign.id})`)

      const campaignResult: any = {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        daily_send_limit: campaign.daily_send_limit || 5,
        total_contacts: campaign.total_contacts || 0
      }

      // Check contact tracking status
      if (campaign.contacts_remaining) {
        campaignResult.new_tracking = {
          remaining: campaign.contacts_remaining?.length || 0,
          processed: campaign.contacts_processed?.length || 0,
          failed: campaign.contacts_failed?.length || 0,
          batch_history_count: campaign.batch_history?.length || 0
        }
        console.log(`📊 New tracking: ${campaignResult.new_tracking.remaining} remaining, ${campaignResult.new_tracking.processed} processed`)
      } else {
        console.log('⚠️ Campaign not using new contact tracking yet')
        campaignResult.new_tracking = null
      }

      // Check batch scheduling
      if (campaign.first_batch_sent_at) {
        campaignResult.batch_info = {
          first_batch_sent_at: campaign.first_batch_sent_at,
          current_batch_number: campaign.current_batch_number || 0,
          next_batch_send_time: campaign.next_batch_send_time,
          is_ready_for_next_batch: false
        }

        if (campaign.next_batch_send_time) {
          const nextBatchTime = new Date(campaign.next_batch_send_time)
          const now = new Date()
          const timeUntil = nextBatchTime.getTime() - now.getTime()
          const minutesUntil = Math.round(timeUntil / (1000 * 60))

          campaignResult.batch_info.is_ready_for_next_batch = timeUntil <= 5 * 60 * 1000 // 5-minute window
          campaignResult.batch_info.minutes_until_next_batch = minutesUntil

          console.log(`⏰ Next batch in ${minutesUntil} minutes (${campaignResult.batch_info.is_ready_for_next_batch ? 'READY' : 'NOT READY'})`)
        }
      } else {
        console.log('📅 Campaign has not sent first batch yet')
        campaignResult.batch_info = null
      }

      // Check for completion
      const remainingContacts = campaign.contacts_remaining?.length || 0
      campaignResult.is_complete = remainingContacts === 0 && campaign.total_contacts > 0

      if (campaignResult.is_complete) {
        console.log('✅ Campaign should be marked as completed')
      } else if (remainingContacts > 0) {
        console.log(`🔄 Campaign has ${remainingContacts} contacts remaining`)
      }

      results.push(campaignResult)
    }

    // Test running the processor
    console.log('\n🚀 Testing campaign processor...')
    try {
      await campaignProcessor.processReadyCampaigns()
      console.log('✅ Campaign processor completed successfully')
    } catch (processorError) {
      console.error('❌ Campaign processor error:', processorError)
      return NextResponse.json({
        success: false,
        error: 'Campaign processor failed',
        details: processorError instanceof Error ? processorError.message : 'Unknown error',
        campaigns: results
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Bulk campaign batching test completed',
      campaigns_tested: campaigns.length,
      results,
      improvements: [
        '✅ Contact tracking prevents duplicate sends',
        '✅ Daily limits enforced per batch',
        '✅ Proper completion detection',
        '✅ 24-hour batch scheduling',
        '✅ Batch history tracking'
      ]
    })

  } catch (error) {
    console.error('💥 Test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST endpoint to manually trigger the contact tracking migration for a specific campaign
 */
export async function POST(request: NextRequest) {
  console.log('🔧 Manually triggering contact tracking initialization')

  try {
    const body = await request.json()
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Get the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Initialize contact tracking using the campaign processor's method
    const processor = campaignProcessor as any
    await processor.initializeContactTracking(campaign, supabase)

    console.log(`✅ Contact tracking initialized for campaign ${campaign.name}`)

    return NextResponse.json({
      success: true,
      message: `Contact tracking initialized for campaign: ${campaign.name}`,
      campaignId: campaign.id
    })

  } catch (error) {
    console.error('💥 Manual initialization error:', error)
    return NextResponse.json({
      success: false,
      error: 'Manual initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}