import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

/**
 * Debug API for Email Tracking
 * Check what's actually in the email_tracking table and test queries
 */
export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')
    
    const results: any = {
      message: 'Email tracking debug information',
      user_id: user.id,
      campaign_id: campaignId
    }

    // Test 1: Check table schema by getting one record
    console.log('🔍 Testing email_tracking table schema...')
    
    const { data: sampleRecords, error: sampleError } = await supabase
      .from('email_tracking')
      .select('*')
      .limit(1)

    if (sampleError) {
      results.schema_test = {
        success: false,
        error: sampleError.message,
        details: sampleError
      }
    } else {
      results.schema_test = {
        success: true,
        sample_record: sampleRecords?.[0] || null,
        fields_available: sampleRecords?.[0] ? Object.keys(sampleRecords[0]) : []
      }
    }

    // Test 2: Get all records for user (if no specific campaign)
    if (!campaignId) {
      const { data: userRecords, error: userError } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(10)

      results.user_records = {
        success: !userError,
        error: userError?.message,
        count: userRecords?.length || 0,
        records: userRecords || []
      }
    }

    // Test 3: Campaign-specific records (if campaign_id provided)
    if (campaignId) {
      console.log(`🔍 Testing queries for campaign: ${campaignId}`)
      
      // Test timestamp-based query
      const { data: timestampRecords, error: timestampError } = await supabase
        .from('email_tracking')
        .select('sent_at, delivered_at, opened_at, bounced_at')
        .eq('campaign_id', campaignId)

      results.campaign_records = {
        success: !timestampError,
        error: timestampError?.message,
        total_records: timestampRecords?.length || 0,
        sent_count: timestampRecords?.filter(r => r.sent_at !== null).length || 0,
        delivered_count: timestampRecords?.filter(r => r.delivered_at !== null).length || 0,
        opened_count: timestampRecords?.filter(r => r.opened_at !== null).length || 0,
        failed_count: timestampRecords?.filter(r => r.bounced_at !== null).length || 0,
        records: timestampRecords || []
      }

      // Test old status-based query (should fail)
      const { data: statusRecords, error: statusError } = await supabase
        .from('email_tracking')
        .select('status')
        .eq('campaign_id', campaignId)

      results.old_status_query = {
        success: !statusError,
        error: statusError?.message,
        note: 'This should fail if status field does not exist'
      }
    }

    return NextResponse.json({
      success: true,
      debug_results: results
    })

  } catch (error) {
    console.error('Debug email tracking error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const { action, campaign_id } = await request.json()

    if (action === 'create_test_record' && campaign_id) {
      // Create a test email tracking record
      const testRecord = {
        user_id: user.id,
        campaign_id: campaign_id,
        contact_id: user.id, // Use user id as dummy contact
        message_id: `test_${Date.now()}`,
        sent_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('email_tracking')
        .insert(testRecord)
        .select()

      return NextResponse.json({
        success: !error,
        error: error?.message,
        test_record: testRecord,
        created_record: data?.[0]
      })
    }

    return NextResponse.json({
      error: 'Invalid action or missing campaign_id'
    }, { status: 400 })

  } catch (error) {
    console.error('Debug email tracking POST error:', error)
    return NextResponse.json({
      error: 'Debug action failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})