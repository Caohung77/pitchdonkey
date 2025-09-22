import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    console.log('🔍 Checking click tracking database schema...')

    const results = {
      clickTrackingTable: null,
      emailEventsTable: null,
      sampleData: null,
      errors: []
    }

    // Check if click_tracking table exists
    try {
      const { data: clickTrackingData, error: clickError } = await supabase
        .from('click_tracking')
        .select('*')
        .limit(5)

      if (clickError) {
        results.errors.push(`click_tracking table error: ${clickError.message}`)
        results.clickTrackingTable = { exists: false, error: clickError.message }
      } else {
        results.clickTrackingTable = {
          exists: true,
          recordCount: clickTrackingData?.length || 0,
          sampleRecord: clickTrackingData?.[0] || null
        }
        console.log(`✅ click_tracking table exists with ${clickTrackingData?.length || 0} records`)
      }
    } catch (error) {
      results.errors.push(`click_tracking table check failed: ${error.message}`)
      results.clickTrackingTable = { exists: false, error: error.message }
    }

    // Check if email_events table exists and has click events
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('email_events')
        .select('*')
        .eq('type', 'clicked')
        .limit(5)

      if (eventsError) {
        results.errors.push(`email_events table error: ${eventsError.message}`)
        results.emailEventsTable = { exists: false, error: eventsError.message }
      } else {
        results.emailEventsTable = {
          exists: true,
          clickEventCount: eventsData?.length || 0,
          sampleClickEvent: eventsData?.[0] || null
        }
        console.log(`✅ email_events table exists with ${eventsData?.length || 0} click events`)
      }
    } catch (error) {
      results.errors.push(`email_events table check failed: ${error.message}`)
      results.emailEventsTable = { exists: false, error: error.message }
    }

    // Get some sample campaign data to work with
    try {
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .limit(3)

      if (!campaignError && campaignData) {
        results.sampleData = {
          campaigns: campaignData,
          campaignCount: campaignData.length
        }
      }
    } catch (error) {
      console.log('Could not fetch sample campaign data:', error.message)
    }

    // Check if the click tracking tables have the right structure
    const schemaCheck = {
      clickTrackingRequired: [
        'id', 'message_id', 'recipient_email', 'original_url', 'tracking_url',
        'campaign_id', 'contact_id', 'clicked', 'click_count', 'created_at'
      ],
      emailEventsRequired: [
        'id', 'message_id', 'type', 'timestamp', 'recipient_email',
        'campaign_id', 'contact_id', 'event_data'
      ]
    }

    return NextResponse.json({
      success: true,
      message: 'Click tracking schema check completed',
      timestamp: new Date().toISOString(),
      results,
      schemaCheck,
      recommendations: [
        'Verify click_tracking table has all required columns',
        'Check if tracking URLs are being generated correctly',
        'Test the /api/tracking/click/[clickId] endpoint',
        'Verify link rewriting is working in email content'
      ]
    })

  } catch (error) {
    console.error('💥 Schema check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Schema check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}