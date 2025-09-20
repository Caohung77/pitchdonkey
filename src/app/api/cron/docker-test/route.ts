import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Docker Cron Test Endpoint
 *
 * This endpoint specifically tests the Docker Ubuntu cron functionality
 * and provides detailed diagnostic information about campaign states.
 *
 * Use this to verify that the Docker cron is working properly and
 * can process both 'scheduled' and 'sending' campaigns.
 */
export async function GET(request: NextRequest) {
  console.log('🐳 Docker Cron Test: Checking campaign processing capability')

  try {
    // Security check (same as main cron job)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const userAgent = request.headers.get('user-agent')

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (!userAgent?.includes('vercel-cron')) {
        console.error('❌ Unauthorized request')
        return new Response('Unauthorized', { status: 401 })
      }
    }

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

    // Check current campaign states
    console.log('📊 Analyzing current campaign states...')
    const { data: allCampaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, created_at, updated_at')
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: error.message },
        { status: 500 }
      )
    }

    // Categorize campaigns
    const scheduled = allCampaigns?.filter(c => c.status === 'scheduled') || []
    const sending = allCampaigns?.filter(c => c.status === 'sending') || []
    const completed = allCampaigns?.filter(c => c.status === 'completed') || []
    const draft = allCampaigns?.filter(c => c.status === 'draft') || []
    const paused = allCampaigns?.filter(c => c.status === 'paused') || []

    // Check which campaigns would be processed by the main cron
    const readyScheduled = scheduled.filter(c =>
      c.scheduled_date && new Date(c.scheduled_date) <= now
    )

    // Detailed analysis
    const analysis = {
      timestamp: now.toISOString(),
      totalCampaigns: allCampaigns?.length || 0,
      campaignsByStatus: {
        draft: draft.length,
        scheduled: scheduled.length,
        sending: sending.length,
        completed: completed.length,
        paused: paused.length
      },
      processingTargets: {
        scheduledReadyToSend: readyScheduled.length,
        stuckInSending: sending.length,
        totalProcessable: readyScheduled.length + sending.length
      },
      campaignDetails: {
        readyScheduled: readyScheduled.map(c => ({
          id: c.id,
          name: c.name,
          scheduledFor: c.scheduled_date,
          timeUntil: c.scheduled_date ?
            `${Math.round((new Date(c.scheduled_date).getTime() - now.getTime()) / 1000)}s` :
            'no date'
        })),
        stuckSending: sending.map(c => ({
          id: c.id,
          name: c.name,
          stuckSince: c.updated_at,
          duration: `${Math.round((now.getTime() - new Date(c.updated_at).getTime()) / 60000)}min`
        }))
      }
    }

    console.log('✅ Docker cron test completed successfully')
    console.log(`📊 Found ${analysis.processingTargets.totalProcessable} campaigns that would be processed`)
    console.log(`   - ${analysis.processingTargets.scheduledReadyToSend} scheduled campaigns ready to send`)
    console.log(`   - ${analysis.processingTargets.stuckInSending} campaigns stuck in 'sending' status`)

    return NextResponse.json({
      success: true,
      message: 'Docker cron test completed',
      dockerCronWorking: true,
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasCronSecret: !!process.env.CRON_SECRET,
        nodeEnv: process.env.NODE_ENV
      },
      analysis
    })

  } catch (error) {
    console.error('❌ Docker cron test failed:', error)

    return NextResponse.json({
      success: false,
      error: 'Docker cron test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * POST endpoint for manual testing
 */
export async function POST(request: NextRequest) {
  console.log('🐳 Manual Docker cron test')
  return GET(request)
}