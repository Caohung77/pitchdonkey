import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { ContactEnrichmentService } from '@/lib/contact-enrichment'
import { ValidationError } from '@/lib/errors'

export const POST = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: contactId } = await params
    
    if (!contactId) {
      throw new ValidationError('Contact ID is required')
    }

    console.log(`🚀 Starting enrichment for contact ${contactId} by user ${user.id}`)

    const enrichmentService = new ContactEnrichmentService()

    // Check if contact can be enriched
    const canEnrich = await enrichmentService.canEnrichContact(contactId, user.id)

    if (!canEnrich.canEnrich) {
      console.log(`❌ Cannot enrich contact ${contactId}: ${canEnrich.reason}`)
      // Business-rule validation: return 200 with success=false so clients can handle gracefully
      return createSuccessResponse({
        success: false,
        error: canEnrich.reason,
        canEnrich: false,
        hasWebsite: canEnrich.hasWebsite,
        hasBusinessEmail: canEnrich.hasBusinessEmail,
        currentStatus: canEnrich.currentStatus,
        enrichmentSource: canEnrich.enrichmentSource
      }, 200)
    }

    // Perform enrichment
    const result = await enrichmentService.enrichContact(contactId, user.id)

    if (!result.success) {
      console.log(`❌ Enrichment failed for contact ${contactId}: ${result.error}`)
      // Operational failure but not a protocol error: return 200 with success=false
      return createSuccessResponse({
        success: false,
        error: result.error,
        contact_id: result.contact_id,
        website_url: result.website_url
      }, 200)
    }

    console.log(`✅ Enrichment completed successfully for contact ${contactId}`)
    
    return createSuccessResponse({
      success: true,
      message: 'Contact enriched successfully',
      contact_id: result.contact_id,
      website_url: result.website_url,
      enrichment_data: result.data,
      enrichment_source: result.enrichment_source
    })

  } catch (error) {
    console.error('❌ Enrichment API error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available')
    return handleApiError(error)
  }
})

export const GET = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: contactId } = await params
    
    if (!contactId) {
      throw new ValidationError('Contact ID is required')
    }

    const enrichmentService = new ContactEnrichmentService()

    // Get enrichment data
    const enrichmentData = await enrichmentService.getEnrichmentData(contactId, user.id)
    
    // Check enrichment eligibility
    const canEnrich = await enrichmentService.canEnrichContact(contactId, user.id)

    return createSuccessResponse({
      contact_id: contactId,
      enrichment_data: enrichmentData.enrichment_data,
      enrichment_status: enrichmentData.enrichment_status,
      enrichment_updated_at: enrichmentData.enrichment_updated_at,
      can_enrich: canEnrich.canEnrich,
      has_website: canEnrich.hasWebsite,
      has_business_email: canEnrich.hasBusinessEmail,
      enrichment_source: canEnrich.enrichmentSource,
      reason: canEnrich.reason
    })

  } catch (error) {
    console.error('❌ Get enrichment API error:', error)
    return handleApiError(error)
  }
})

export const DELETE = withAuth(async (request: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id: contactId } = await params
    
    if (!contactId) {
      throw new ValidationError('Contact ID is required')
    }

    console.log(`🗑️ Clearing enrichment data for contact ${contactId}`)

    const enrichmentService = new ContactEnrichmentService()
    const success = await enrichmentService.clearEnrichmentData(contactId, user.id)

    if (!success) {
      return createSuccessResponse({
        success: false,
        error: 'Failed to clear enrichment data'
      }, 400)
    }

    return createSuccessResponse({
      success: true,
      message: 'Enrichment data cleared successfully',
      contact_id: contactId
    })

  } catch (error) {
    console.error('❌ Clear enrichment API error:', error)
    return handleApiError(error)
  }
})
