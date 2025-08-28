import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔍 Checking database structure and data...')
    
    // Check if email_tracking table exists and get its structure
    const { data: emailTrackingTest, error: emailTrackingError } = await supabase
      .from('email_tracking')
      .select('*')
      .limit(1)
    
    // Check campaigns table
    const { data: campaignTest, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status, total_contacts, emails_sent')
      .limit(5)
    
    // Count total email tracking records
    const { count: emailTrackingCount } = await supabase
      .from('email_tracking')
      .select('*', { count: 'exact', head: true })
    
    // Count campaigns by status
    const { data: campaignStats } = await supabase
      .from('campaigns')
      .select('status')
    
    const statusCounts = campaignStats?.reduce((acc, campaign) => {
      acc[campaign.status] = (acc[campaign.status] || 0) + 1
      return acc
    }, {}) || {}
    
    return NextResponse.json({
      success: true,
      database_status: {
        email_tracking: {
          table_exists: !emailTrackingError,
          total_records: emailTrackingCount || 0,
          sample_record: emailTrackingTest?.[0] || null,
          error: emailTrackingError?.message || null
        },
        campaigns: {
          table_exists: !campaignError,
          total_campaigns: campaignTest?.length || 0,
          sample_campaigns: campaignTest || [],
          status_breakdown: statusCounts,
          error: campaignError?.message || null
        }
      },
      recommendations: {
        needs_manual_setup: false,
        automatic_fix_available: true,
        next_steps: emailTrackingError ? [
          "email_tracking table might need to be created",
          "Run the migration API: POST /api/debug/migrate-email-tracking"
        ] : [
          "Database structure looks good",
          "Test by creating a new campaign"
        ]
      }
    })
    
  } catch (error) {
    console.error('💥 Database check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Database check failed',
      details: error.message,
      recommendations: {
        needs_manual_setup: true,
        manual_steps: [
          "Check Supabase dashboard for table existence",
          "Verify database connection",
          "Run migration script if needed"
        ]
      }
    }, { status: 500 })
  }
}