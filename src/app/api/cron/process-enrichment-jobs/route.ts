import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const maxDuration = 300 // 5 minutes for cron job
export const dynamic = 'force-dynamic'

/**
 * Cron job to process stuck enrichment jobs
 * Runs every 5 minutes to resume jobs that failed to chain to next batch
 *
 * Ubuntu Server Cron Configuration:
 * Add to crontab: crontab -e
 *
 * *\/5 * * * * curl -X GET https://pitchdonkey.vercel.app/api/cron/process-enrichment-jobs \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *   >> /var/log/enrichment-cron.log 2>&1
 *
 * Set CRON_SECRET in Vercel environment variables
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Cron: Starting stuck enrichment job recovery')

    // Verify this is a valid cron request from Ubuntu server
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('⚠️ Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Find jobs that are stuck (status='processing', updated >5 minutes ago, has remaining contacts)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: stuckJobs, error: fetchError } = await supabase
      .from('bulk_enrichment_jobs')
      .select('*')
      .in('status', ['processing', 'running'])
      .lt('updated_at', fiveMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(10) // Process max 10 stuck jobs per run

    if (fetchError) {
      console.error('❌ Error fetching stuck jobs:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch stuck jobs' }, { status: 500 })
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ No stuck enrichment jobs found')
      return NextResponse.json({
        success: true,
        message: 'No stuck jobs to process',
        processed: 0
      })
    }

    console.log(`🔍 Found ${stuckJobs.length} stuck enrichment job(s)`)

    const results = []
    const processorBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pitchdonkey.vercel.app'

    for (const job of stuckJobs) {
      try {
        console.log(`🔄 Attempting to resume job ${job.id}`)

        // Check if there are actually more contacts to process
        const progress = job.progress as any
        const completed = progress?.completed || 0
        const failed = progress?.failed || 0
        const total = progress?.total || 0
        const processed = completed + failed

        if (processed >= total) {
          // Job is actually complete, just mark it as such
          console.log(`✅ Job ${job.id} is complete (${processed}/${total}), marking as completed`)
          await supabase
            .from('bulk_enrichment_jobs')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', job.id)

          results.push({ job_id: job.id, action: 'marked_complete', success: true })
          continue
        }

        // Trigger processor to resume the job
        const processorUrl = `${processorBaseUrl}/api/contacts/bulk-enrich/process`
        console.log(`🔄 Triggering processor for job ${job.id} at ${processorUrl}`)

        const response = await fetch(processorUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id })
        })

        if (response.ok) {
          console.log(`✅ Successfully resumed job ${job.id}`)
          results.push({ job_id: job.id, action: 'resumed', success: true })
        } else {
          const errorText = await response.text()
          console.error(`❌ Failed to resume job ${job.id}: HTTP ${response.status}`, errorText)
          await supabase
            .from('bulk_enrichment_jobs')
            .update({
              status: 'pending',
              error: `Retry scheduled: ${errorText}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id)
          results.push({
            job_id: job.id,
            action: 'reset_pending',
            success: false,
            error: `HTTP ${response.status}: ${errorText}`
          })

          // If job has been stuck for >30 minutes, mark as failed
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
          if (job.updated_at < thirtyMinutesAgo) {
            console.log(`⏰ Job ${job.id} has been stuck for >30 minutes, marking as failed`)
            await supabase
              .from('bulk_enrichment_jobs')
              .update({
                status: 'failed',
                error: 'Job stuck for >30 minutes after multiple retry attempts',
                updated_at: new Date().toISOString()
              })
              .eq('id', job.id)

            results[results.length - 1].action = 'marked_failed'
          }
        }
      } catch (err) {
        console.error(`❌ Exception processing job ${job.id}:`, err)
        results.push({
          job_id: job.id,
          action: 'exception',
          success: false,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    console.log(`✅ Cron job completed: ${successCount}/${results.length} jobs processed successfully`)

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} stuck job(s)`,
      processed: results.length,
      successful: successCount,
      results
    })

  } catch (error) {
    console.error('❌ Cron job error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}
