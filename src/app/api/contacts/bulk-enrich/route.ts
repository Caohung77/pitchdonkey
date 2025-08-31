import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { BulkContactEnrichmentService } from '@/lib/bulk-contact-enrichment'
import { ValidationError } from '@/lib/errors'

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

    const enrichmentService = new BulkContactEnrichmentService()

    // Create bulk enrichment job
    const result = await enrichmentService.createBulkEnrichmentJob(user.id, contact_ids, options)

    console.log('🔍 Full result from createBulkEnrichmentJob:', JSON.stringify(result, null, 2))

    if (!result.success) {
      console.log(`❌ Failed to create bulk enrichment job: ${result.error}`)
      throw new ValidationError(result.error || 'Failed to create bulk enrichment job')
    }

    console.log(`✅ Bulk enrichment job created successfully: ${result.job_id}`)
    
    return createSuccessResponse({
      success: true,
      job_id: result.job_id,
      message: 'Bulk enrichment job started successfully',
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