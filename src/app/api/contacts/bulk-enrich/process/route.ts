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
  console.log('🎯 === PROCESSOR ENDPOINT CALLED ===')
  console.log('🎯 Request URL:', request.url)
  console.log('🎯 Request method:', request.method)

  try {
    const body = await request.json().catch((err) => {
      console.error('❌ Failed to parse request body:', err)
      return {}
    })

    console.log('📦 Request body:', body)
    const { job_id } = body

    if (!job_id) {
      console.log('⚠️  No job_id provided in request')
    }

    const supabase = createServerSupabaseClient()
    const enrichmentService = new BulkContactEnrichmentService()

    console.log('✅ Supabase client and enrichment service created')

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
      // Find oldest pending or stuck running job
      const { data: pendingJobs } = await supabase
        .from('bulk_enrichment_jobs')
        .select('*')
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: true })
        .limit(10)

      if (!pendingJobs || pendingJobs.length === 0) {
        return NextResponse.json({ message: 'No pending jobs to process' }, { status: 200 })
      }

      // Prioritize jobs that need retry or are truly pending
      jobToProcess = pendingJobs.find((job: any) => {
        const options = job.options as any
        return options?.needs_retry || job.status === 'pending'
      }) || pendingJobs[0]

      console.log(`📋 Selected job ${jobToProcess.id} with status ${jobToProcess.status}`)
    }

    console.log(`🚀 Processing batch for job ${jobToProcess.id}`)

    // Process one batch
    const result = await enrichmentService.processNextBatch(jobToProcess.id)

    // If there are more batches, trigger the next one immediately
    if (result.hasMore) {
      console.log(`🔄 Triggering next batch for job ${jobToProcess.id}`)
      const processorUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.url.split('/api')[0]}/api/contacts/bulk-enrich/process`
      console.log(`🔄 Next batch URL: ${processorUrl}`)

      // Fire-and-forget fetch to trigger next batch
      fetch(processorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobToProcess.id })
      })
      .then(async (res) => {
        console.log(`✅ Next batch trigger response: ${res.status} ${res.statusText}`)
        if (!res.ok) {
          const errorText = await res.text()
          console.error(`❌ Next batch trigger failed with body:`, errorText)
        }
      })
      .catch(err => {
        console.error('❌ Failed to trigger next batch - EXCEPTION:', err)
        console.error('❌ Error message:', err instanceof Error ? err.message : String(err))
      })
    } else {
      console.log(`✅ No more batches to process for job ${jobToProcess.id}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Batch processed',
      job_id: jobToProcess.id,
      has_more: result.hasMore
    }, { status: 200 })

  } catch (error) {
    console.error('Process endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
