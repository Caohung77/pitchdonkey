import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { BulkContactEnrichmentService } from '@/lib/bulk-contact-enrichment'
import { ValidationError } from '@/lib/errors'

export const GET = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ job_id: string }> }) => {
  try {
    const { job_id: jobId } = await params
    
    if (!jobId) {
      throw new ValidationError('Job ID is required')
    }

    console.log(`📊 Getting status for bulk enrichment job ${jobId}`)

    const enrichmentService = new BulkContactEnrichmentService()

    // Get job status
    const job = await enrichmentService.getJobStatus(jobId)
    
    console.log(`📊 Job status retrieved:`, job ? { 
      id: job.id, 
      status: job.status, 
      progress: job.progress 
    } : 'null')

    if (!job) {
      return createSuccessResponse({
        success: false,
        error: 'Job not found'
      }, 404)
    }

    // Verify job ownership
    if (job.user_id !== user.id) {
      return createSuccessResponse({
        success: false,
        error: 'Access denied'
      }, 403)
    }

    // Calculate percentage and estimated remaining time
    const percentage = job.progress.total > 0 
      ? Math.round(((job.progress.completed + job.progress.failed) / job.progress.total) * 100)
      : 0

    let estimated_remaining: string | undefined
    if (job.status === 'running' && percentage > 0 && percentage < 100) {
      const completedCount = job.progress.completed + job.progress.failed
      const remainingCount = job.progress.total - completedCount
      const avgTimePerContact = 30 // seconds
      const estimatedSeconds = remainingCount * avgTimePerContact
      
      if (estimatedSeconds < 60) {
        estimated_remaining = `${estimatedSeconds} seconds`
      } else {
        const minutes = Math.ceil(estimatedSeconds / 60)
        estimated_remaining = `${minutes} minute${minutes !== 1 ? 's' : ''}`
      }
    }

    console.log(`📊 Job ${jobId} status: ${job.status}, progress: ${percentage}%`)

    return createSuccessResponse({
      job_id: jobId,
      status: job.status,
      progress: {
        ...job.progress,
        percentage,
        estimated_remaining
      },
      results: job.results || [],
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      summary: job.status === 'completed' ? {
        successful_scrapes: job.results?.filter((r: any) => r.scrape_status === 'completed').length || 0,
        failed_scrapes: job.results?.filter((r: any) => r.scrape_status === 'failed').length || 0,
        data_points_extracted: job.results?.filter((r: any) => r.enrichment_data).length || 0,
        website_enriched: job.results?.filter((r: any) => r.scrape_status === 'completed' && r.website_url).length || 0,
        linkedin_enriched: job.results?.filter((r: any) => r.scrape_status === 'completed' && r.linkedin_data).length || 0,
        sources_used: {
          website: job.results?.filter((r: any) => r.scrape_status === 'completed' && r.website_url && !r.linkedin_data).length || 0,
          linkedin: job.results?.filter((r: any) => r.scrape_status === 'completed' && r.linkedin_data && !r.website_url).length || 0,
          hybrid: job.results?.filter((r: any) => r.scrape_status === 'completed' && r.website_url && r.linkedin_data).length || 0
        }
      } : undefined
    })

  } catch (error) {
    console.error('❌ Get job status API error:', error)
    return handleApiError(error)
  }
})