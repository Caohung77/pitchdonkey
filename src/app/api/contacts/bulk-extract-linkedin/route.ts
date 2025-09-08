import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { LinkedInProfileExtractorService } from '@/lib/linkedin-profile-extractor'
import { SmartEnrichmentOrchestrator } from '@/lib/smart-enrichment-orchestrator'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface BulkLinkedInExtractionRequest {
  contact_ids: string[]
  smart_enrichment?: boolean
  max_concurrent?: number
}

interface BulkExtractionResult {
  contact_id: string
  success: boolean
  sources_used?: string[]
  linkedin_data?: any
  error?: string
  processing_time_ms: number
}

/**
 * POST /api/contacts/bulk-extract-linkedin
 * Extract LinkedIn profiles for multiple contacts in batch
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body: BulkLinkedInExtractionRequest = await request.json()
    const { contact_ids, smart_enrichment = true, max_concurrent = 3 } = body

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'contact_ids array is required and cannot be empty',
        message: 'Please provide an array of contact IDs to extract LinkedIn profiles for'
      }, { status: 400 })
    }

    if (contact_ids.length > 50) {
      return NextResponse.json({
        success: false,
        error: 'Too many contacts requested',
        message: 'Maximum 50 contacts can be processed in a single batch'
      }, { status: 400 })
    }

    console.log(`🚀 Bulk LinkedIn extraction for ${contact_ids.length} contacts`)

    const startTime = Date.now()
    const results: BulkExtractionResult[] = []
    
    // Validate contacts belong to user
    const supabase = await createServerSupabaseClient()
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, linkedin_url, website, first_name, last_name')
      .eq('user_id', user.id)
      .in('id', contact_ids)

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`)
    }

    if (contacts.length !== contact_ids.length) {
      const foundIds = contacts.map(c => c.id)
      const missingIds = contact_ids.filter(id => !foundIds.includes(id))
      return NextResponse.json({
        success: false,
        error: 'Some contacts not found or access denied',
        message: `Contacts not accessible: ${missingIds.join(', ')}`,
        data: { missing_contact_ids: missingIds }
      }, { status: 403 })
    }

    // Filter contacts that have LinkedIn URLs
    const contactsWithLinkedIn = contacts.filter(c => c.linkedin_url)
    console.log(`📊 ${contactsWithLinkedIn.length}/${contacts.length} contacts have LinkedIn URLs`)

    if (contactsWithLinkedIn.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No contacts with LinkedIn URLs found',
        message: 'None of the provided contacts have LinkedIn URLs to extract',
        data: { contacts_without_linkedin: contacts.length }
      }, { status: 400 })
    }

    // Process contacts in batches to avoid overwhelming the API
    const batchSize = Math.min(max_concurrent, 3)
    console.log(`⚡ Processing contacts in batches of ${batchSize}`)

    for (let i = 0; i < contactsWithLinkedIn.length; i += batchSize) {
      const batch = contactsWithLinkedIn.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(contactsWithLinkedIn.length / batchSize)}`)

      const batchPromises = batch.map(async (contact) => {
        const contactStartTime = Date.now()
        
        try {
          if (smart_enrichment) {
            // Smart enrichment (website + LinkedIn)
            const orchestrator = new SmartEnrichmentOrchestrator()
            const result = await orchestrator.enrichContact(contact.id, user.id)
            
            return {
              contact_id: contact.id,
              success: result.success,
              sources_used: result.sources_used,
              primary_source: result.primary_source,
              secondary_source: result.secondary_source,
              linkedin_data: result.linkedin_data,
              enrichment_data: result.enrichment_data,
              errors: result.errors,
              warnings: result.warnings,
              processing_time_ms: Date.now() - contactStartTime
            } as BulkExtractionResult

          } else {
            // LinkedIn-only extraction
            const linkedinExtractor = new LinkedInProfileExtractorService()
            const result = await linkedinExtractor.extractContactLinkedIn(contact.id, user.id)
            
            return {
              contact_id: contact.id,
              success: result.success,
              sources_used: result.success ? ['linkedin'] : [],
              linkedin_data: result.data,
              error: result.error,
              processing_time_ms: Date.now() - contactStartTime
            } as BulkExtractionResult
          }

        } catch (error) {
          console.error(`❌ Error processing contact ${contact.id}:`, error)
          return {
            contact_id: contact.id,
            success: false,
            sources_used: [],
            error: error instanceof Error ? error.message : 'Processing failed',
            processing_time_ms: Date.now() - contactStartTime
          } as BulkExtractionResult
        }
      })

      // Execute batch in parallel
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add a small delay between batches to be respectful to APIs
      if (i + batchSize < contactsWithLinkedIn.length) {
        console.log('⏳ Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Add results for contacts without LinkedIn URLs
    const contactsWithoutLinkedIn = contacts.filter(c => !c.linkedin_url)
    contactsWithoutLinkedIn.forEach(contact => {
      results.push({
        contact_id: contact.id,
        success: false,
        sources_used: [],
        error: 'No LinkedIn URL available',
        processing_time_ms: 0
      })
    })

    const totalTime = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    console.log(`✅ Bulk LinkedIn extraction completed: ${successCount} success, ${failureCount} failures in ${totalTime}ms`)

    return NextResponse.json({
      success: successCount > 0,
      data: {
        total_requested: contact_ids.length,
        total_processed: results.length,
        successful_extractions: successCount,
        failed_extractions: failureCount,
        contacts_with_linkedin: contactsWithLinkedIn.length,
        contacts_without_linkedin: contactsWithoutLinkedIn.length,
        processing_time_ms: totalTime,
        average_time_per_contact: totalTime / results.length,
        results: results
      },
      message: `Bulk LinkedIn extraction completed: ${successCount}/${results.length} contacts processed successfully`,
      warnings: failureCount > 0 ? [`${failureCount} contacts failed to process`] : []
    })

  } catch (error) {
    console.error('❌ Bulk LinkedIn extraction error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Bulk LinkedIn extraction failed',
      message: 'An unexpected error occurred during bulk LinkedIn extraction'
    }, { status: 500 })
  }
})

/**
 * GET /api/contacts/bulk-extract-linkedin
 * Get LinkedIn extraction statistics for the user
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log(`📊 Getting LinkedIn extraction stats for user ${user.id}`)

    const linkedinExtractor = new LinkedInProfileExtractorService()
    const orchestrator = new SmartEnrichmentOrchestrator()

    // Get LinkedIn-specific stats
    const linkedinStats = await linkedinExtractor.getLinkedInStats(user.id)
    
    // Get comprehensive enrichment stats
    const enrichmentStats = await orchestrator.getEnrichmentStats(user.id)

    return NextResponse.json({
      success: true,
      data: {
        user_id: user.id,
        linkedin_stats: linkedinStats,
        enrichment_stats: enrichmentStats,
        summary: {
          total_contacts: linkedinStats.total_contacts,
          linkedin_extraction_rate: linkedinStats.with_linkedin_urls > 0 
            ? Math.round((linkedinStats.extracted_profiles / linkedinStats.with_linkedin_urls) * 100) 
            : 0,
          dual_source_potential: enrichmentStats.dual_source_contacts,
          fully_enriched_contacts: enrichmentStats.fully_enriched,
          enrichment_completion_rate: linkedinStats.total_contacts > 0 
            ? Math.round((enrichmentStats.fully_enriched / linkedinStats.total_contacts) * 100) 
            : 0
        },
        recommendations: this.getRecommendations(linkedinStats, enrichmentStats)
      }
    })

  } catch (error) {
    console.error('❌ LinkedIn stats retrieval error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve LinkedIn statistics',
      message: 'An error occurred while retrieving LinkedIn extraction statistics'
    }, { status: 500 })
  }
})

/**
 * Generate recommendations based on extraction stats
 */
function getRecommendations(linkedinStats: any, enrichmentStats: any): string[] {
  const recommendations: string[] = []

  if (linkedinStats.with_linkedin_urls > linkedinStats.extracted_profiles) {
    recommendations.push(`Extract ${linkedinStats.with_linkedin_urls - linkedinStats.extracted_profiles} pending LinkedIn profiles`)
  }

  if (enrichmentStats.dual_source_contacts > enrichmentStats.fully_enriched) {
    recommendations.push(`Complete dual enrichment for ${enrichmentStats.dual_source_contacts - enrichmentStats.fully_enriched} contacts with both website and LinkedIn`)
  }

  if (linkedinStats.failed_extractions > 0) {
    recommendations.push(`Retry ${linkedinStats.failed_extractions} failed LinkedIn extractions`)
  }

  if (linkedinStats.pending_extractions > 0) {
    recommendations.push(`Monitor ${linkedinStats.pending_extractions} pending LinkedIn extractions`)
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Your LinkedIn extraction is up to date')
  }

  return recommendations
}