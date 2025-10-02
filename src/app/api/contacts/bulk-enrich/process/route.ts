import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BulkContactEnrichmentService } from '@/lib/bulk-contact-enrichment'

// Vercel serverless function configuration
export const maxDuration = 60 // Maximum allowed on Vercel Pro (60 seconds)
export const dynamic = 'force-dynamic'

/**
 * Process ONE batch of a bulk enrichment job
 * This endpoint processes contacts in small batches and chains itself for the next batch
 * to avoid Vercel serverless timeout issues
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { job_id } = body

    const supabase = createServerSupabaseClient()
    const enrichmentService = new BulkContactEnrichmentService()

    let jobToProcess

    if (job_id) {
      // Process specific job
      const { data: job } = await supabase
        .from('bulk_enrichment_jobs')
        .select('*')
        .eq('id', job_id)
        .single()

      if (!job || (job.status !== 'pending' && job.status !== 'running')) {
        return NextResponse.json({
          error: 'Job not found or not in processable state',
          status: job?.status
        }, { status: 400 })
      }

      jobToProcess = job
    } else {
      // Find oldest pending job
      const { data: pendingJobs } = await supabase
        .from('bulk_enrichment_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)

      if (!pendingJobs || pendingJobs.length === 0) {
        return NextResponse.json({ message: 'No pending jobs to process' }, { status: 200 })
      }

      jobToProcess = pendingJobs[0]
    }

    console.log(`🚀 Processing batch for job ${jobToProcess.id}`)

    // Process one batch (will update job status and trigger next batch if needed)
    await enrichmentService.processNextBatch(jobToProcess.id)

    return NextResponse.json({
      success: true,
      message: 'Batch processed',
      job_id: jobToProcess.id
    }, { status: 200 })

  } catch (error) {
    console.error('Process endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
