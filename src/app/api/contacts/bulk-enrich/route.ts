import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { BulkContactEnrichmentService } from '@/lib/bulk-contact-enrichment'
import { ValidationError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { contact_ids, options } = body

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      throw new ValidationError('contact_ids is required and must be a non-empty array')
    }

    if (contact_ids.length > 100) {
      throw new ValidationError('Cannot enrich more than 100 contacts at once')
    }

    console.log(`🚀 Starting bulk enrichment for ${contact_ids.length} contacts by user ${user.id}`)

    // Check for existing running/pending jobs to prevent concurrent enrichment
    const supabase = createServerSupabaseClient()
    const { data: runningJobs } = await supabase
      .from('bulk_enrichment_jobs')
      .select('id, status, progress')
      .eq('user_id', user.id)
      .in('status', ['running', 'pending'])

    if (runningJobs && runningJobs.length > 0) {
      const job = runningJobs[0]
      const progress = job.progress as any
      const progressText = progress
        ? `${progress.completed || 0}/${progress.total || 0} contacts enriched`
        : 'in progress'

      console.log(`⚠️ Enrichment job already running for user ${user.id}`)
      throw new ValidationError(
        `An enrichment job is already running (${progressText}). Please wait for it to complete before starting a new one.`
      )
    }

    const enrichmentService = new BulkContactEnrichmentService()

    // Create bulk enrichment job
    const result = await enrichmentService.createBulkEnrichmentJob(user.id, contact_ids, options)

    console.log('🔍 Full result from createBulkEnrichmentJob:', JSON.stringify(result, null, 2))

    if (!result.success) {
      console.log(`❌ Failed to create bulk enrichment job: ${result.error}`)
      throw new ValidationError(result.error || 'Failed to create bulk enrichment job')
    }

    console.log(`✅ Bulk enrichment job created successfully: ${result.job_id}`)

    // Immediately trigger the processor endpoint to start processing the first batch
    const processorUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contacts/bulk-enrich/process`
    console.log(`🔄 Triggering processor at: ${processorUrl}`)

    // Use await with proper error handling instead of fire-and-forget
    try {
      console.log(`🔄 Making POST request to: ${processorUrl}`)
      console.log(`📦 Request payload:`, { job_id: result.job_id })

      const triggerResponse = await fetch(processorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: result.job_id })
      })

      console.log(`📡 Processor response status: ${triggerResponse.status} ${triggerResponse.statusText}`)

      if (triggerResponse.ok) {
        const responseData = await triggerResponse.json()
        console.log(`✅ Successfully triggered processor for job ${result.job_id}`)
        console.log(`📊 Processor response:`, responseData)
      } else {
        console.error(`❌ Processor trigger failed: HTTP ${triggerResponse.status}`)
        const errorText = await triggerResponse.text()
        console.error(`❌ Error response body:`, errorText)
      }
    } catch (err) {
      console.error('❌ Failed to trigger processor - EXCEPTION:', err)
      console.error('❌ Error type:', err instanceof Error ? err.constructor.name : typeof err)
      console.error('❌ Error message:', err instanceof Error ? err.message : String(err))
      console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace')
      console.error('⚠️  Job created but not started. Manual trigger required or wait for cron.')
    }

    return createSuccessResponse({
      success: true,
      job_id: result.job_id,
      message: 'Bulk enrichment started. Processing in background.',
      summary: result.summary
    })

  } catch (error) {
    console.error('❌ Bulk enrichment API error:', error)
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return handleApiError(error)
  }
})