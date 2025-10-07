import { ContactEnrichmentService } from './contact-enrichment'
import { LinkedInProfileExtractorService, LinkedInEnrichmentData, LinkedInExtractionResult } from './linkedin-profile-extractor'
import { createServerSupabaseClient } from './supabase-server'

interface EnrichmentSource {
  type: 'website' | 'linkedin'
  available: boolean
  url: string
  status?: string
}

interface SmartEnrichmentResult {
  success: boolean
  sources_used: string[]
  primary_source: 'website' | 'linkedin' | 'none'
  secondary_source: 'website' | 'linkedin' | 'none'
  enrichment_data?: any
  linkedin_data?: LinkedInEnrichmentData
  errors: string[]
  warnings: string[]
  contact_id: string
}

interface MergedContactData {
  // Basic contact info
  first_name?: string
  last_name?: string
  position?: string
  company?: string
  city?: string
  country?: string
  
  // Company-focused data (from website)
  enrichment_data?: {
    company_name: string
    industry: string
    products_services: string[]
    target_audience: string[]
    unique_points: string[]
    tone_style: string
  }
  
  // LinkedIn-focused data (from profile)
  linkedin_profile_data?: LinkedInEnrichmentData
  
  // Metadata
  enrichment_sources: string[]
  enrichment_priority: 'company_first' | 'linkedin_only' | 'website_only'
}

/**
 * Smart Enrichment Orchestrator
 * Handles hierarchical enrichment strategy:
 * 1. Company website (primary) - for business context
 * 2. LinkedIn profile (secondary) - fills gaps with personal/professional data
 */
export class SmartEnrichmentOrchestrator {
  private contactEnrichmentService: ContactEnrichmentService
  private linkedinExtractorService: LinkedInProfileExtractorService

  constructor() {
    this.contactEnrichmentService = new ContactEnrichmentService()
    this.linkedinExtractorService = new LinkedInProfileExtractorService()
  }

  /**
   * Main enrichment method with smart prioritization
   */
  async enrichContact(contactId: string, userId: string): Promise<SmartEnrichmentResult> {
    console.log(`🎯 Starting smart enrichment for contact ${contactId}`)

    try {
      const supabase = await createServerSupabaseClient()

      // 1. Get contact and analyze available sources
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single()

      if (contactError || !contact) {
        return {
          success: false,
          sources_used: [],
          primary_source: 'none',
          secondary_source: 'none',
          errors: ['Contact not found or access denied'],
          warnings: [],
          contact_id: contactId
        }
      }

      // 2. Analyze available enrichment sources
      const sources = this.analyzeEnrichmentSources(contact)
      console.log('📊 Available sources:', sources)

      // 3. Execute enrichment strategy based on available sources
      return await this.executeEnrichmentStrategy(contactId, userId, contact, sources)

    } catch (error) {
      console.error('❌ Smart enrichment error:', error)
      return {
        success: false,
        sources_used: [],
        primary_source: 'none',
        secondary_source: 'none',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        contact_id: contactId
      }
    }
  }

  /**
   * Analyze what enrichment sources are available
   */
  private analyzeEnrichmentSources(contact: any): {
    website: EnrichmentSource
    linkedin: EnrichmentSource
    strategy: 'dual' | 'website_only' | 'linkedin_only' | 'none'
  } {
    const website: EnrichmentSource = {
      type: 'website',
      available: !!contact.website,
      url: contact.website || '',
      status: contact.enrichment_status
    }

    const linkedin: EnrichmentSource = {
      type: 'linkedin',
      available: !!contact.linkedin_url,
      url: contact.linkedin_url || '',
      status: contact.linkedin_extraction_status
    }

    let strategy: 'dual' | 'website_only' | 'linkedin_only' | 'none' = 'none'
    
    if (website.available && linkedin.available) {
      strategy = 'dual'
    } else if (website.available) {
      strategy = 'website_only'
    } else if (linkedin.available) {
      strategy = 'linkedin_only'
    }

    return { website, linkedin, strategy }
  }

  /**
   * Execute the appropriate enrichment strategy
   */
  private async executeEnrichmentStrategy(
    contactId: string,
    userId: string,
    contact: any,
    sources: any
  ): Promise<SmartEnrichmentResult> {
    const { website, linkedin, strategy } = sources

    console.log(`📋 Executing enrichment strategy: ${strategy}`)

    switch (strategy) {
      case 'dual':
        return await this.executeDualEnrichment(contactId, userId, contact, website, linkedin)
      
      case 'website_only':
        return await this.executeWebsiteOnlyEnrichment(contactId, userId, contact)
      
      case 'linkedin_only':
        return await this.executeLinkedInOnlyEnrichment(contactId, userId, contact)
      
      default:
        console.log(`⏭️ Skipping contact ${contactId} - No enrichment sources available`)

        // Mark both statuses as failed to prevent retries
        const supabase = await createServerSupabaseClient()
        await supabase
          .from('contacts')
          .update({
            enrichment_status: 'failed',
            linkedin_extraction_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', contactId)
          .eq('user_id', userId)

        return {
          success: false,
          sources_used: [],
          primary_source: 'none',
          secondary_source: 'none',
          errors: ['No enrichment sources available'],
          warnings: ['Contact has no website URL or LinkedIn URL'],
          contact_id: contactId
        }
    }
  }

  /**
   * Dual enrichment: Company website first, LinkedIn fills gaps
   */
  private async executeDualEnrichment(
    contactId: string,
    userId: string,
    contact: any,
    website: EnrichmentSource,
    linkedin: EnrichmentSource
  ): Promise<SmartEnrichmentResult> {
    console.log('🔄 Executing dual enrichment: Company first, LinkedIn fills gaps')

    const errors: string[] = []
    const warnings: string[] = []
    const sourcesUsed: string[] = []

    let websiteData: any = null
    let linkedinData: LinkedInEnrichmentData | null = null

    // PHASE 1: Company website enrichment (PRIMARY with 90s timeout)
    console.log('🌐 Phase 1: Company website enrichment')
    try {
      const websiteResult = await Promise.race([
        this.contactEnrichmentService.enrichContact(contactId, userId),
        new Promise<{ success: false; error: string; contact_id: string; website_url: string }>((resolve) =>
          setTimeout(() => {
            console.warn(`⏰ Website enrichment timeout after 90 seconds`)
            resolve({ success: false, error: 'Timeout after 90 seconds', contact_id: contactId, website_url: '' })
          }, 90000)
        )
      ])

      if (websiteResult.success && websiteResult.data) {
        websiteData = websiteResult.data
        sourcesUsed.push('website')
        console.log('✅ Website enrichment successful')
      } else {
        errors.push(`Website enrichment failed: ${websiteResult.error}`)
        warnings.push('Primary enrichment source (website) failed, relying on LinkedIn')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Website enrichment failed'
      errors.push(errorMsg)
      console.warn('⚠️ Website enrichment failed:', errorMsg)
    }

    // PHASE 2: LinkedIn enrichment (SECONDARY - fills gaps with 90s timeout)
    console.log('🔗 Phase 2: LinkedIn profile enrichment (gap filling)')
    try {
      const linkedinResult = await Promise.race([
        this.linkedinExtractorService.extractContactLinkedIn(contactId, userId),
        new Promise<{ success: false; error: string; contact_id: string; linkedin_url: string; status: 'failed' }>((resolve) =>
          setTimeout(() => {
            console.warn(`⏰ LinkedIn enrichment timeout after 90 seconds`)
            resolve({ success: false, error: 'Timeout after 90 seconds', contact_id: contactId, linkedin_url: '', status: 'failed' })
          }, 90000)
        )
      ])

      if (linkedinResult.success && linkedinResult.data) {
        linkedinData = linkedinResult.data
        sourcesUsed.push('linkedin')
        console.log('✅ LinkedIn enrichment successful')
      } else {
        errors.push(`LinkedIn enrichment failed: ${linkedinResult.error}`)
        warnings.push('Secondary enrichment source (LinkedIn) failed')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'LinkedIn enrichment failed'
      errors.push(errorMsg)
      console.warn('⚠️ LinkedIn enrichment failed:', errorMsg)
    }

    // PHASE 3: Smart merging (company data has priority)
    console.log('🔄 Phase 3: Smart data merging')
    const mergedData = this.smartMergeData(contact, websiteData, linkedinData)
    
    // PHASE 4: Save merged results
    await this.saveMergedData(contactId, userId, mergedData)

    const success = sourcesUsed.length > 0

    return {
      success,
      sources_used: sourcesUsed,
      primary_source: sourcesUsed.includes('website') ? 'website' : 'none',
      secondary_source: sourcesUsed.includes('linkedin') ? 'linkedin' : 'none',
      enrichment_data: websiteData,
      linkedin_data: linkedinData,
      errors,
      warnings,
      contact_id: contactId
    }
  }

  /**
   * Website-only enrichment (existing functionality)
   */
  private async executeWebsiteOnlyEnrichment(
    contactId: string,
    userId: string,
    contact: any
  ): Promise<SmartEnrichmentResult> {
    console.log('🌐 Executing website-only enrichment')

    try {
      // Add 90 second timeout
      const result = await Promise.race([
        this.contactEnrichmentService.enrichContact(contactId, userId),
        new Promise<{ success: false; error: string; contact_id: string; website_url: string }>((resolve) =>
          setTimeout(() => {
            console.warn(`⏰ Website enrichment timeout after 90 seconds`)
            resolve({ success: false, error: 'Timeout after 90 seconds', contact_id: contactId, website_url: '' })
          }, 90000)
        )
      ])
      
      return {
        success: result.success,
        sources_used: result.success ? ['website'] : [],
        primary_source: result.success ? 'website' : 'none',
        secondary_source: 'none',
        enrichment_data: result.data,
        errors: result.success ? [] : [result.error || 'Website enrichment failed'],
        warnings: [],
        contact_id: contactId
      }
    } catch (error) {
      return {
        success: false,
        sources_used: [],
        primary_source: 'none',
        secondary_source: 'none',
        errors: [error instanceof Error ? error.message : 'Website enrichment failed'],
        warnings: [],
        contact_id: contactId
      }
    }
  }

  /**
   * LinkedIn-only enrichment
   */
  private async executeLinkedInOnlyEnrichment(
    contactId: string,
    userId: string,
    contact: any
  ): Promise<SmartEnrichmentResult> {
    console.log('🔗 Executing LinkedIn-only enrichment')

    try {
      // Add 90 second timeout
      const result = await Promise.race([
        this.linkedinExtractorService.extractContactLinkedIn(contactId, userId),
        new Promise<{ success: false; error: string; contact_id: string; linkedin_url: string; status: 'failed' }>((resolve) =>
          setTimeout(() => {
            console.warn(`⏰ LinkedIn enrichment timeout after 90 seconds`)
            resolve({ success: false, error: 'Timeout after 90 seconds', contact_id: contactId, linkedin_url: '', status: 'failed' })
          }, 90000)
        )
      ])
      
      if (result.success && result.data) {
        // Perform smart merge even for LinkedIn-only to save enrichment metadata
        console.log('🔄 Saving LinkedIn enrichment metadata')
        const mergedData = this.smartMergeData(contact, null, result.data)
        await this.saveMergedData(contactId, userId, mergedData)
      }
      
      return {
        success: result.success,
        sources_used: result.success ? ['linkedin'] : [],
        primary_source: result.success ? 'linkedin' : 'none',
        secondary_source: 'none',
        linkedin_data: result.data,
        errors: result.success ? [] : [result.error || 'LinkedIn enrichment failed'],
        warnings: [],
        contact_id: contactId
      }
    } catch (error) {
      return {
        success: false,
        sources_used: [],
        primary_source: 'none',
        secondary_source: 'none',
        errors: [error instanceof Error ? error.message : 'LinkedIn enrichment failed'],
        warnings: [],
        contact_id: contactId
      }
    }
  }

  /**
   * Smart data merging with company data priority
   */
  private smartMergeData(
    existingContact: any,
    websiteData: any,
    linkedinData: LinkedInEnrichmentData | null
  ): MergedContactData {
    console.log('🧠 Performing smart data merge (company data has priority)')

    const merged: MergedContactData = {
      enrichment_sources: [],
      enrichment_priority: websiteData && linkedinData ? 'company_first' : 
                          websiteData ? 'website_only' : 
                          linkedinData ? 'linkedin_only' : 'company_first'
    }

    // PRIORITY 1: Company website data (never overwrite)
    if (websiteData) {
      merged.enrichment_data = websiteData
      merged.enrichment_sources.push('website')
      
      // Company data takes precedence for business context
      merged.company = websiteData.company_name
      console.log('✅ Company data from website applied')
    }

    // PRIORITY 2: LinkedIn data (fills gaps only)
    if (linkedinData) {
      merged.linkedin_profile_data = linkedinData
      merged.enrichment_sources.push('linkedin')
      
      // Personal/professional data from LinkedIn (only if not already set)
      if (!existingContact.first_name && linkedinData.first_name) {
        merged.first_name = linkedinData.first_name
      }
      if (!existingContact.last_name && linkedinData.last_name) {
        merged.last_name = linkedinData.last_name
      }
      if (!existingContact.position && linkedinData.position) {
        merged.position = linkedinData.position
      }
      if (!existingContact.city && linkedinData.city) {
        merged.city = linkedinData.city
      }
      if (!existingContact.country && linkedinData.country) {
        merged.country = linkedinData.country
      }
      
      // Company name from LinkedIn ONLY if no website data
      if (!merged.company && linkedinData.current_company) {
        merged.company = linkedinData.current_company
      }
      
      console.log('✅ LinkedIn data applied to fill gaps')
    }

    console.log(`🎯 Merge completed using sources: ${merged.enrichment_sources.join(', ')}`)
    return merged
  }

  /**
   * Save merged enrichment data to database
   */
  private async saveMergedData(
    contactId: string,
    userId: string,
    mergedData: MergedContactData
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient()
      
      const updateData: any = {
        updated_at: new Date().toISOString()
      }
      
      // Add basic contact fields
      if (mergedData.first_name) updateData.first_name = mergedData.first_name
      if (mergedData.last_name) updateData.last_name = mergedData.last_name
      if (mergedData.position) updateData.position = mergedData.position
      if (mergedData.company) updateData.company = mergedData.company
      if (mergedData.city) updateData.city = mergedData.city
      if (mergedData.country) updateData.country = mergedData.country
      
      // Add enrichment metadata
      updateData.enrichment_sources = mergedData.enrichment_sources
      updateData.enrichment_priority = mergedData.enrichment_priority
      
      // Add LinkedIn profile data if available
      if (mergedData.linkedin_profile_data) {
        updateData.linkedin_profile_data = mergedData.linkedin_profile_data
      }
      
      const { error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Failed to save merged data:', error)
        throw error
      }

      console.log('✅ Merged enrichment data saved successfully')
    } catch (error) {
      console.error('❌ Error saving merged data:', error)
      throw error
    }
  }

  /**
   * Get enrichment status for a contact
   */
  async getEnrichmentStatus(contactId: string, userId: string): Promise<{
    website_status: string | null
    linkedin_status: string | null
    sources_used: string[]
    priority_strategy: string | null
    last_enriched: string | null
  }> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        enrichment_status,
        enrichment_updated_at,
        linkedin_extraction_status,
        linkedin_extracted_at,
        enrichment_sources,
        enrichment_priority
      `)
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('❌ Failed to get enrichment status:', error)
      return {
        website_status: null,
        linkedin_status: null,
        sources_used: [],
        priority_strategy: null,
        last_enriched: null
      }
    }

    return {
      website_status: data.enrichment_status,
      linkedin_status: data.linkedin_extraction_status,
      sources_used: data.enrichment_sources || [],
      priority_strategy: data.enrichment_priority,
      last_enriched: data.enrichment_updated_at || data.linkedin_extracted_at
    }
  }

  /**
   * Get comprehensive enrichment statistics
   */
  async getEnrichmentStats(userId: string): Promise<{
    total_contacts: number
    fully_enriched: number    // Both website and LinkedIn
    website_only: number
    linkedin_only: number
    not_enriched: number
    dual_source_contacts: number
  }> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        website,
        linkedin_url,
        enrichment_status,
        linkedin_extraction_status,
        enrichment_sources
      `)
      .eq('user_id', userId)
      .neq('status', 'deleted')

    if (error) {
      console.error('❌ Failed to get enrichment stats:', error)
      return {
        total_contacts: 0,
        fully_enriched: 0,
        website_only: 0,
        linkedin_only: 0,
        not_enriched: 0,
        dual_source_contacts: 0
      }
    }

    const stats = data.reduce((acc, contact) => {
      acc.total_contacts++
      
      const hasWebsite = !!contact.website
      const hasLinkedIn = !!contact.linkedin_url
      const websiteEnriched = contact.enrichment_status === 'completed'
      const linkedinEnriched = contact.linkedin_extraction_status === 'completed'
      const sources = contact.enrichment_sources || []
      
      if (hasWebsite && hasLinkedIn) {
        acc.dual_source_contacts++
      }
      
      if (websiteEnriched && linkedinEnriched) {
        acc.fully_enriched++
      } else if (websiteEnriched && !linkedinEnriched) {
        acc.website_only++
      } else if (!websiteEnriched && linkedinEnriched) {
        acc.linkedin_only++
      } else {
        acc.not_enriched++
      }
      
      return acc
    }, {
      total_contacts: 0,
      fully_enriched: 0,
      website_only: 0,
      linkedin_only: 0,
      not_enriched: 0,
      dual_source_contacts: 0
    })

    return stats
  }
}

// Export types
export type { SmartEnrichmentResult, MergedContactData }