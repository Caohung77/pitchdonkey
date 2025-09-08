import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { LinkedInProfileExtractorService } from '@/lib/linkedin-profile-extractor'
import { SmartEnrichmentOrchestrator } from '@/lib/smart-enrichment-orchestrator'

/**
 * POST /api/contacts/[id]/extract-linkedin
 * Extract LinkedIn profile data for a specific contact
 */
export const POST = withAuth(async (request: NextRequest, { user }, { params }: { params: { id: string } }) => {
  try {
    const contactId = params.id
    const body = await request.json().catch(() => ({}))
    const useSmartEnrichment = body.smart_enrichment !== false // Default to true

    console.log(`🔍 LinkedIn extraction request for contact ${contactId}`)

    if (useSmartEnrichment) {
      // Use smart enrichment orchestrator (handles both website + LinkedIn)
      console.log('🎯 Using smart enrichment orchestrator')
      const orchestrator = new SmartEnrichmentOrchestrator()
      const result = await orchestrator.enrichContact(contactId, user.id)

      return NextResponse.json({
        success: result.success,
        data: {
          contact_id: contactId,
          sources_used: result.sources_used,
          primary_source: result.primary_source,
          secondary_source: result.secondary_source,
          enrichment_data: result.enrichment_data,
          linkedin_data: result.linkedin_data,
          strategy: result.sources_used.length > 1 ? 'dual_enrichment' : 'single_source'
        },
        errors: result.errors,
        warnings: result.warnings,
        message: result.success 
          ? `Contact enriched using ${result.sources_used.join(' + ')} data`
          : 'Enrichment failed'
      })

    } else {
      // Use LinkedIn-only extraction
      console.log('🔗 Using LinkedIn-only extraction')
      const linkedinExtractor = new LinkedInProfileExtractorService()
      const result = await linkedinExtractor.extractContactLinkedIn(contactId, user.id)

      return NextResponse.json({
        success: result.success,
        data: {
          contact_id: contactId,
          linkedin_url: result.linkedin_url,
          linkedin_data: result.data,
          status: result.status,
          snapshot_id: result.snapshot_id
        },
        error: result.error,
        message: result.success 
          ? 'LinkedIn profile extracted successfully'
          : `LinkedIn extraction failed: ${result.error}`
      })
    }

  } catch (error) {
    console.error('❌ LinkedIn extraction API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn extraction failed',
      message: 'An unexpected error occurred during LinkedIn extraction'
    }, { status: 500 })
  }
})

/**
 * GET /api/contacts/[id]/extract-linkedin
 * Get LinkedIn extraction status and data for a contact
 */
export const GET = withAuth(async (request: NextRequest, { user }, { params }: { params: { id: string } }) => {
  try {
    const contactId = params.id
    const linkedinExtractor = new LinkedInProfileExtractorService()
    
    console.log(`📊 Getting LinkedIn data for contact ${contactId}`)

    // Get LinkedIn extraction data
    const linkedinData = await linkedinExtractor.getLinkedInData(contactId, user.id)
    
    // Get extraction capability status
    const capability = await linkedinExtractor.canExtractLinkedIn(contactId, user.id)
    
    // Get enrichment status from orchestrator
    const orchestrator = new SmartEnrichmentOrchestrator()
    const enrichmentStatus = await orchestrator.getEnrichmentStatus(contactId, user.id)

    return NextResponse.json({
      success: true,
      data: {
        contact_id: contactId,
        linkedin_profile_data: linkedinData.linkedin_profile_data,
        linkedin_extraction_status: linkedinData.linkedin_extraction_status,
        linkedin_extracted_at: linkedinData.linkedin_extracted_at,
        can_extract_linkedin: capability.canExtract,
        extraction_reason: capability.reason,
        has_linkedin_url: capability.hasLinkedInUrl,
        enrichment_status: {
          website_status: enrichmentStatus.website_status,
          linkedin_status: enrichmentStatus.linkedin_status,
          sources_used: enrichmentStatus.sources_used,
          priority_strategy: enrichmentStatus.priority_strategy,
          last_enriched: enrichmentStatus.last_enriched
        }
      }
    })

  } catch (error) {
    console.error('❌ LinkedIn data retrieval error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve LinkedIn data',
      message: 'An error occurred while retrieving LinkedIn extraction data'
    }, { status: 500 })
  }
})

/**
 * DELETE /api/contacts/[id]/extract-linkedin
 * Clear LinkedIn extraction data for a contact (for re-extraction)
 */
export const DELETE = withAuth(async (request: NextRequest, { user }, { params }: { params: { id: string } }) => {
  try {
    const contactId = params.id
    const linkedinExtractor = new LinkedInProfileExtractorService()
    
    console.log(`🗑️ Clearing LinkedIn data for contact ${contactId}`)

    const success = await linkedinExtractor.clearLinkedInData(contactId, user.id)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'LinkedIn data cleared successfully. You can now re-extract the profile.',
        data: {
          contact_id: contactId,
          cleared_at: new Date().toISOString()
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to clear LinkedIn data',
        message: 'An error occurred while clearing LinkedIn extraction data'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ LinkedIn data clearing error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear LinkedIn data',
      message: 'An unexpected error occurred while clearing LinkedIn data'
    }, { status: 500 })
  }
})