import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Test end-to-end campaign flow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId } = body

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    switch (action) {
      case 'create_test_campaign':
        return await createTestCampaign(supabase, userId || 'ea1f9972-6109-44ec-93d5-05522f49760c')

      case 'test_cron_processing':
        return await testCronProcessing()

      case 'manual_process_test':
        const { campaignId } = body
        return await manualProcessTest(supabase, campaignId)

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Error in test campaign flow:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function createTestCampaign(supabase: any, userId: string) {
  // Create a test campaign scheduled for 1 minute from now
  const scheduledDate = new Date(Date.now() + 60 * 1000) // 1 minute from now

  const testCampaign = {
    user_id: userId,
    name: `Debug Test Campaign ${new Date().toISOString().slice(11, 19)}`,
    description: JSON.stringify({
      description: 'Test campaign for debugging scheduled flow',
      sender_name: 'Debug Test'
    }),
    status: 'scheduled',
    from_email_account_id: 'a6dfc536-dd78-42d3-854f-d82d24fba91e', // Use existing Gmail account
    scheduled_date: scheduledDate.toISOString(),
    html_content: '<p>Hello {{first_name}}, this is a test email from the debug system.</p>',
    email_subject: 'Debug Test Email',
    timezone: 'UTC',
    daily_send_limit: 10,
    send_days: [1, 2, 3, 4, 5, 6, 7],
    send_time_start: '09:00:00',
    send_time_end: '17:00:00',
    track_opens: true,
    track_clicks: true,
    track_replies: true,
    contact_list_ids: ['397351ee-7bb3-4f83-8347-5834ed9fbe9f'], // Use existing contact list
    total_contacts: 4,
    send_immediately: false
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert(testCampaign)
    .select()
    .single()

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    campaign: campaign,
    scheduled_for: scheduledDate.toISOString(),
    current_time: new Date().toISOString(),
    minutes_until_send: 1,
    test_instructions: [
      '1. Wait 1 minute for the scheduled time to pass',
      '2. Run the cron job: GET /api/cron/process-campaigns',
      '3. Check if campaign status changes from "scheduled" to "sending"',
      '4. Monitor campaign processing and completion'
    ]
  })
}

async function testCronProcessing() {
  try {
    // Call the cron job endpoint
    const response = await fetch('http://localhost:3002/api/cron/process-campaigns', {
      method: 'GET',
      headers: {
        'User-Agent': 'vercel-cron/1.0'
      }
    })

    const result = await response.json()

    return NextResponse.json({
      success: true,
      cron_result: result,
      status_code: response.status,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to test cron processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function manualProcessTest(supabase: any, campaignId: string) {
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  try {
    // Get campaign before processing
    const { data: beforeCampaign, error: beforeError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (beforeError) {
      return NextResponse.json({ error: beforeError.message }, { status: 500 })
    }

    // Force update to sending status
    await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        send_immediately: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    // Process with campaign processor
    const { campaignProcessor } = await import('@/lib/campaign-processor')
    await campaignProcessor.processReadyCampaigns()

    // Get campaign after processing
    const { data: afterCampaign, error: afterError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (afterError) {
      return NextResponse.json({ error: afterError.message }, { status: 500 })
    }

    // Get email tracking results
    const { data: emailTracking, error: trackingError } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      before: {
        status: beforeCampaign.status,
        emails_sent: beforeCampaign.emails_sent,
        emails_bounced: beforeCampaign.emails_bounced
      },
      after: {
        status: afterCampaign.status,
        emails_sent: afterCampaign.emails_sent,
        emails_bounced: afterCampaign.emails_bounced
      },
      email_tracking: {
        total_records: emailTracking?.length || 0,
        by_status: {
          pending: emailTracking?.filter(t => t.status === 'pending').length || 0,
          delivered: emailTracking?.filter(t => t.status === 'delivered').length || 0,
          failed: emailTracking?.filter(t => t.status === 'failed').length || 0
        },
        sent_count: emailTracking?.filter(t => t.sent_at !== null).length || 0,
        bounced_count: emailTracking?.filter(t => t.bounced_at !== null).length || 0
      },
      processing_success: afterCampaign.status === 'completed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Manual processing test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Test Campaign Flow Tool',
    available_actions: [
      'create_test_campaign - Create a test campaign scheduled for 1 minute from now',
      'test_cron_processing - Test the cron job endpoint',
      'manual_process_test - Manually process a specific campaign'
    ],
    usage: 'POST with { "action": "action_name", "userId": "uuid", "campaignId": "uuid" }'
  })
}