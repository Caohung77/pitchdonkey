import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get recent email tracking records
    const { data: trackingRecords, error } = await supabase
      .from('email_tracking')
      .select('id, tracking_pixel_id, campaign_id, contact_id, sent_at, opened_at, delivered_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch tracking records',
        details: error.message
      }, { status: 500 })
    }

    // Also check if we have any completed campaigns with tracking
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, emails_sent')
      .eq('status', 'completed')
      .gt('emails_sent', 0)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      trackingRecords: trackingRecords || [],
      recentCampaigns: campaigns || [],
      recordCount: trackingRecords?.length || 0
    })

  } catch (error) {
    console.error('Error checking tracking:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}