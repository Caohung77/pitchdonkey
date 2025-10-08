import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createReplyJobProcessor } from '@/lib/reply-job-processor'
import { addSecurityHeaders } from '@/lib/auth-middleware'

/**
 * POST /api/cron/process-reply-jobs
 * Cron job to process scheduled autonomous reply jobs
 *
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions, or Ubuntu cron)
 * Recommended schedule: Every 1-5 minutes
 *
 * Security: Uses CRON_SECRET for authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🕐 Cron: Processing reply jobs triggered')

    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request - invalid or missing CRON_SECRET')
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    // Create Supabase client with service role for cron operations
    const supabase = createServerSupabaseClient()

    // Create reply job processor
    const processor = createReplyJobProcessor(supabase)

    // Process reply jobs
    const result = await processor.processReplyJobs(100) // Process up to 100 jobs per run

    console.log(`✅ Cron: Processed ${result.sent}/${result.processed} reply jobs successfully`)

    if (result.errors.length > 0) {
      console.error('⚠️ Cron: Errors occurred during processing:', result.errors)
    }

    const response = NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors,
      },
      message: `Processed ${result.sent}/${result.processed} reply jobs successfully`,
      timestamp: new Date().toISOString(),
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('❌ Cron: Error processing reply jobs:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

/**
 * GET /api/cron/process-reply-jobs
 * Health check endpoint for the cron job
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    // Get stats about reply jobs
    const supabase = createServerSupabaseClient()

    // Count jobs by status
    const { data: stats, error } = await supabase
      .from('reply_jobs')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    if (error) {
      console.error('Error fetching reply job stats:', error)
    }

    const statusCounts = stats?.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Count jobs ready to be sent
    const { data: readyJobs, error: readyError } = await supabase
      .from('reply_jobs')
      .select('id')
      .in('status', ['scheduled', 'approved'])
      .lte('scheduled_at', new Date().toISOString())

    const response = NextResponse.json({
      status: 'healthy',
      endpoint: '/api/cron/process-reply-jobs',
      last_24h_stats: statusCounts,
      ready_to_send: readyJobs?.length || 0,
      timestamp: new Date().toISOString(),
      cron_secret_configured: !!cronSecret,
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in cron health check:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
