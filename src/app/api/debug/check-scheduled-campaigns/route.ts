import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Debug endpoint to check why scheduled campaigns aren't being processed
 */
export async function GET(request: NextRequest) {
  console.log('🔍 Debug: Checking scheduled campaigns')

  try {
    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date()

    console.log(`🕐 Current time (UTC): ${now.toISOString()}`)

    // First, let's check ALL campaigns and their statuses
    const { data: allCampaigns, error: allError } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, created_at, user_id')
      .order('created_at', { ascending: false })

    if (allError) {
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: allError.message },
        { status: 500 }
      )
    }

    // Now let's specifically check scheduled campaigns
    const { data: scheduledCampaigns, error: scheduledError } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, created_at, user_id')
      .eq('status', 'scheduled')

    if (scheduledError) {
      return NextResponse.json(
        { error: 'Failed to fetch scheduled campaigns', details: scheduledError.message },
        { status: 500 }
      )
    }

    // Check the specific query that the cron job uses
    const { data: cronQuery, error: cronError } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, created_at, user_id')
      .in('status', ['scheduled', 'sending'])
      .or(`scheduled_date.lte.${now.toISOString()},status.eq.sending`)

    if (cronError) {
      return NextResponse.json(
        { error: 'Failed to run cron query', details: cronError.message },
        { status: 500 }
      )
    }

    // Analysis
    const analysis = {
      timestamp: now.toISOString(),
      totalCampaigns: allCampaigns?.length || 0,
      campaignsByStatus: {
        draft: allCampaigns?.filter(c => c.status === 'draft').length || 0,
        scheduled: allCampaigns?.filter(c => c.status === 'scheduled').length || 0,
        sending: allCampaigns?.filter(c => c.status === 'sending').length || 0,
        completed: allCampaigns?.filter(c => c.status === 'completed').length || 0,
        paused: allCampaigns?.filter(c => c.status === 'paused').length || 0,
      },
      scheduledCampaignsDetails: scheduledCampaigns?.map(c => ({
        id: c.id,
        name: c.name,
        scheduledDate: c.scheduled_date,
        isPastDue: c.scheduled_date ? new Date(c.scheduled_date) <= now : false,
        minutesOverdue: c.scheduled_date ? Math.round((now.getTime() - new Date(c.scheduled_date).getTime()) / 60000) : null,
      })) || [],
      cronQueryResults: cronQuery?.length || 0,
      cronQueryDetails: cronQuery?.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        scheduledDate: c.scheduled_date,
        isPastDue: c.scheduled_date ? new Date(c.scheduled_date) <= now : false,
      })) || []
    }

    console.log('📊 Campaign Analysis:')
    console.log(`   Total campaigns: ${analysis.totalCampaigns}`)
    console.log(`   Scheduled campaigns: ${analysis.campaignsByStatus.scheduled}`)
    console.log(`   Cron query matches: ${analysis.cronQueryResults}`)

    return NextResponse.json({
      success: true,
      analysis,
      debugging: {
        supabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        currentTime: now.toISOString(),
        cronQuery: `status in ('scheduled', 'sending') AND (scheduled_date <= '${now.toISOString()}' OR status = 'sending')`
      }
    })

  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}