import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { BulkContactEnrichmentService } from '@/lib/bulk-contact-enrichment'
import { ValidationError } from '@/lib/errors'

export const POST = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ job_id: string }> }) => {
  try {
    const { job_id: jobId } = await params
    
    if (!jobId) {
      throw new ValidationError('Job ID is required')
    }

    console.log(`🛑 Cancelling bulk enrichment job ${jobId}`)

    const enrichmentService = new BulkContactEnrichmentService()

    // First verify job exists and user owns it
    const job = await enrichmentService.getJobStatus(jobId)

    if (!job) {
      return createSuccessResponse({
        success: false,
        error: 'Job not found'
      }, 404)
    }

    if (job.user_id !== user.id) {
      return createSuccessResponse({
        success: false,
        error: 'Access denied'
      }, 403)
    }

    if (job.status !== 'running' && job.status !== 'pending') {
      return createSuccessResponse({
        success: false,
        error: `Cannot cancel job with status: ${job.status}`
      }, 400)
    }

    // Cancel the job
    const success = await enrichmentService.cancelJob(jobId)

    if (!success) {
      return createSuccessResponse({
        success: false,
        error: 'Failed to cancel job'
      }, 500)
    }

    console.log(`✅ Job ${jobId} cancelled successfully`)

    return createSuccessResponse({
      success: true,
      message: 'Job cancelled successfully',
      job_id: jobId
    })

  } catch (error) {
    console.error('❌ Cancel job API error:', error)
    return handleApiError(error)
  }
})