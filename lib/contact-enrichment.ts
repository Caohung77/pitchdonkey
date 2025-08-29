import { createServerSupabaseClient } from './supabase-server'
import { PerplexityService } from './perplexity-service'

interface EnrichmentData {
  company_name: string
  industry: string
  products_services: string[]
  target_audience: string[]
  unique_points: string[]
  tone_style: string
}

interface EnrichmentResult {
  success: boolean
  data?: EnrichmentData
  error?: string
  contact_id: string
  website_url: string
}

export class ContactEnrichmentService {
  private perplexityService: PerplexityService

  constructor() {
    this.perplexityService = new PerplexityService()
  }

  /**
   * Enrich a single contact with website data
   */
  async enrichContact(contactId: string, userId: string): Promise<EnrichmentResult> {
    console.log(`🚀 Starting enrichment for contact ${contactId}`)

    try {
      const supabase = await createServerSupabaseClient()

      // 1. Get the contact and validate ownership
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, website, company, enrichment_status, enrichment_data')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single()

      if (contactError || !contact) {
        console.error('❌ Contact not found or access denied:', contactError)
        return {
          success: false,
          error: 'Contact not found or access denied',
          contact_id: contactId,
          website_url: ''
        }
      }

      // 2. Validate website URL exists
      if (!contact.website) {
        console.error('❌ No website URL found for contact')
        return {
          success: false,
          error: 'No website URL found for this contact',
          contact_id: contactId,
          website_url: ''
        }
      }

      // 3. Normalize and validate URL
      let websiteUrl: string
      try {
        websiteUrl = PerplexityService.normalizeWebsiteUrl(contact.website)
      } catch (error) {
        console.error('❌ Invalid website URL:', contact.website)
        return {
          success: false,
          error: 'Invalid website URL format',
          contact_id: contactId,
          website_url: contact.website
        }
      }

      console.log(`🌐 Analyzing website: ${websiteUrl}`)

      // 4. Update status to processing
      await this.updateEnrichmentStatus(contactId, 'pending')

      // 5. Analyze website with Perplexity
      const enrichmentData = await this.perplexityService.analyzeWebsite(websiteUrl)

      // 6. Save enrichment data to database and overwrite company field
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          company: enrichmentData.company_name || contact.company, // Overwrite company with enriched data
          enrichment_data: enrichmentData,
          enrichment_status: 'completed',
          enrichment_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId)
        .eq('user_id', userId)

      if (updateError) {
        console.error('❌ Failed to save enrichment data:', updateError)
        await this.updateEnrichmentStatus(contactId, 'failed', 'Failed to save enrichment data')
        return {
          success: false,
          error: 'Failed to save enrichment data',
          contact_id: contactId,
          website_url: websiteUrl
        }
      }

      console.log('✅ Contact enrichment completed successfully')
      return {
        success: true,
        data: enrichmentData,
        contact_id: contactId,
        website_url: websiteUrl
      }

    } catch (error) {
      console.error('❌ Enrichment error:', error)
      
      // Update status to failed
      await this.updateEnrichmentStatus(
        contactId, 
        'failed', 
        error instanceof Error ? error.message : 'Unknown error'
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        contact_id: contactId,
        website_url: ''
      }
    }
  }

  /**
   * Get enrichment data for a contact
   */
  async getEnrichmentData(contactId: string, userId: string): Promise<{
    enrichment_data: EnrichmentData | null
    enrichment_status: string | null
    enrichment_updated_at: string | null
  }> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('contacts')
      .select('enrichment_data, enrichment_status, enrichment_updated_at')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('❌ Failed to get enrichment data:', error)
      return {
        enrichment_data: null,
        enrichment_status: null,
        enrichment_updated_at: null
      }
    }

    return {
      enrichment_data: data.enrichment_data,
      enrichment_status: data.enrichment_status,
      enrichment_updated_at: data.enrichment_updated_at
    }
  }

  /**
   * Check if contact can be enriched
   */
  async canEnrichContact(contactId: string, userId: string): Promise<{
    canEnrich: boolean
    reason?: string
    hasWebsite: boolean
    currentStatus?: string
  }> {
    const supabase = await createServerSupabaseClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('website, enrichment_status')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    if (error || !contact) {
      return {
        canEnrich: false,
        reason: 'Contact not found',
        hasWebsite: false
      }
    }

    const hasWebsite = !!contact.website
    const isProcessing = contact.enrichment_status === 'pending'

    return {
      canEnrich: hasWebsite && !isProcessing,
      reason: !hasWebsite ? 'No website URL' : isProcessing ? 'Already processing' : undefined,
      hasWebsite,
      currentStatus: contact.enrichment_status
    }
  }

  /**
   * Update enrichment status
   */
  private async updateEnrichmentStatus(
    contactId: string, 
    status: 'pending' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient()
      
      const updateData: any = {
        enrichment_status: status,
        enrichment_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Note: We're not storing error messages in the database schema for simplicity
      // They're logged to console for debugging

      await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId)

      console.log(`📊 Updated enrichment status to: ${status}`)
      if (errorMessage) {
        console.error(`❌ Enrichment error for ${contactId}:`, errorMessage)
      }

    } catch (error) {
      console.error('❌ Failed to update enrichment status:', error)
    }
  }

  /**
   * Clear enrichment data (for re-enrichment)
   */
  async clearEnrichmentData(contactId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await createServerSupabaseClient()

      const { error } = await supabase
        .from('contacts')
        .update({
          enrichment_data: null,
          enrichment_status: null,
          enrichment_updated_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Failed to clear enrichment data:', error)
        return false
      }

      console.log('🗑️ Enrichment data cleared successfully')
      return true

    } catch (error) {
      console.error('❌ Error clearing enrichment data:', error)
      return false
    }
  }

  /**
   * Get enrichment statistics for a user
   */
  async getEnrichmentStats(userId: string): Promise<{
    total_contacts: number
    enriched_contacts: number
    pending_enrichments: number
    failed_enrichments: number
    contacts_with_websites: number
  }> {
    try {
      const supabase = await createServerSupabaseClient()

      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('website, enrichment_status')
        .eq('user_id', userId)
        .neq('status', 'deleted')

      if (error) {
        console.error('❌ Failed to get enrichment stats:', error)
        return {
          total_contacts: 0,
          enriched_contacts: 0,
          pending_enrichments: 0,
          failed_enrichments: 0,
          contacts_with_websites: 0
        }
      }

      const stats = contacts.reduce((acc, contact) => {
        acc.total_contacts++
        
        if (contact.website) {
          acc.contacts_with_websites++
        }
        
        switch (contact.enrichment_status) {
          case 'completed':
            acc.enriched_contacts++
            break
          case 'pending':
            acc.pending_enrichments++
            break
          case 'failed':
            acc.failed_enrichments++
            break
        }
        
        return acc
      }, {
        total_contacts: 0,
        enriched_contacts: 0,
        pending_enrichments: 0,
        failed_enrichments: 0,
        contacts_with_websites: 0
      })

      return stats

    } catch (error) {
      console.error('❌ Error getting enrichment stats:', error)
      return {
        total_contacts: 0,
        enriched_contacts: 0,
        pending_enrichments: 0,
        failed_enrichments: 0,
        contacts_with_websites: 0
      }
    }
  }
}