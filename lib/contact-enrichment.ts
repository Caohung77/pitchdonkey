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
  enrichment_source?: 'website' | 'email'
}

// Personal email domains that should be skipped for business enrichment
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'web.de', 'gmx.de', 'gmx.net', 't-online.de', 'freenet.de',
  'aol.com', 'live.com', 'me.com', 'msn.com', 'ymail.com',
  'protonmail.com', 'tutanota.com', '1und1.de', 'arcor.de'
])

/**
 * Extract domain from email address
 * Example: claus.overloeper@koeppen-du.de → koeppen-du.de
 */
function extractDomainFromEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/
  const match = email.match(emailRegex)
  return match ? match[1].toLowerCase() : null
}

/**
 * Check if domain is a personal email provider
 */
function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase())
}

/**
 * Convert domain to website URL
 * Example: koeppen-du.de → https://www.koeppen-du.de
 */
function convertDomainToWebsiteUrl(domain: string): string {
  return `https://www.${domain}`
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
        .select('id, website, email, company, enrichment_status, enrichment_data')
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

      // 2. Determine enrichment strategy: website-first, then email fallback
      let websiteUrl: string | null = null
      let enrichmentSource: 'website' | 'email' = 'website'

      // Try Strategy 1: existing website
      if (contact.website) {
        try {
          const normalized = PerplexityService.normalizeWebsiteUrl(contact.website)
          console.log(`🌐 Using existing website URL: ${normalized}`)
          const access = await PerplexityService.verifyWebsiteAccessible(normalized)
          if (access.ok) {
            websiteUrl = access.finalUrl || normalized
            enrichmentSource = 'website'
            console.log('✅ Website is accessible')
          } else {
            console.warn('⚠️ Provided website appears inaccessible, will attempt email-derived domain if available')
          }
        } catch (error) {
          console.error('❌ Invalid website URL format:', contact.website)
          // Fall through to email strategy
        }
      }

      // If no usable website yet, try Strategy 2: derive from business email
      if (!websiteUrl && contact.email) {
        const domain = extractDomainFromEmail(contact.email)
        if (!domain) {
          console.error('❌ Invalid email format:', contact.email)
        } else if (isPersonalEmailDomain(domain)) {
          console.error('❌ Personal email domain detected:', domain)
        } else {
          const candidate1 = convertDomainToWebsiteUrl(domain)
          const candidate2 = `https://${domain}`
          const access1 = await PerplexityService.verifyWebsiteAccessible(candidate1)
          const access2 = access1.ok ? access1 : await PerplexityService.verifyWebsiteAccessible(candidate2)
          if (access1.ok || access2.ok) {
            websiteUrl = (access1.ok ? access1.finalUrl : access2.finalUrl) || (access1.ok ? candidate1 : candidate2)
            enrichmentSource = 'email'
            console.log(`📧 Derived and verified website URL from email ${contact.email}: ${websiteUrl}`)
          } else {
            console.warn('⚠️ Derived website from email appears inaccessible')
          }
        }
      }

      // If still no usable website, return a business-rule failure
      if (!websiteUrl) {
        console.error('❌ No usable website URL found (neither existing nor derived)')
        return {
          success: false,
          error: 'No website URL or business email found for this contact',
          contact_id: contactId,
          website_url: ''
        }
      }

      console.log(`🌐 Analyzing website: ${websiteUrl} (source: ${enrichmentSource})`)

      // 3. Persist discovered/corrected website to the contact for future use
      try {
        const normalizedExisting = contact.website ? PerplexityService.normalizeWebsiteUrl(contact.website) : null
        if (!normalizedExisting || normalizedExisting !== websiteUrl) {
          const { error: siteSaveError } = await supabase
            .from('contacts')
            .update({ website: websiteUrl, updated_at: new Date().toISOString() })
            .eq('id', contactId)
            .eq('user_id', userId)
          if (siteSaveError) {
            console.warn('⚠️ Failed to persist derived website URL:', siteSaveError)
          } else {
            console.log('💾 Saved website URL to contact:', websiteUrl)
          }
        }
      } catch (e) {
        console.warn('⚠️ Error while attempting to persist website URL:', e)
      }

      // 4. Update status to processing
      await this.updateEnrichmentStatus(contactId, 'pending')

      // 5. Analyze website with Perplexity
      const enrichmentData = await this.perplexityService.analyzeWebsite(websiteUrl)

      // If nothing useful was extracted, mark as failed and do not label as enriched
      const hasMeaningful = !!(
        (enrichmentData.company_name && enrichmentData.company_name.trim().length > 0) ||
        (enrichmentData.industry && enrichmentData.industry.trim().length > 0) ||
        (Array.isArray(enrichmentData.products_services) && enrichmentData.products_services.length > 0) ||
        (Array.isArray(enrichmentData.target_audience) && enrichmentData.target_audience.length > 0) ||
        (Array.isArray(enrichmentData.unique_points) && enrichmentData.unique_points.length > 0) ||
        (enrichmentData.tone_style && enrichmentData.tone_style.trim().length > 0)
      )

      if (!hasMeaningful) {
        await this.updateEnrichmentStatus(contactId, 'failed', 'No extractable data found on website')
        return {
          success: false,
          error: 'No extractable data found on website',
          contact_id: contactId,
          website_url: websiteUrl
        }
      }

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

      console.log(`✅ Contact enrichment completed successfully (source: ${enrichmentSource})`)
      return {
        success: true,
        data: enrichmentData,
        contact_id: contactId,
        website_url: websiteUrl,
        enrichment_source: enrichmentSource
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
    hasBusinessEmail: boolean
    currentStatus?: string
    enrichmentSource?: 'website' | 'email'
  }> {
    const supabase = await createServerSupabaseClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('website, email, enrichment_status')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    if (error || !contact) {
      return {
        canEnrich: false,
        reason: 'Contact not found',
        hasWebsite: false,
        hasBusinessEmail: false
      }
    }

    const hasWebsite = !!contact.website
    const isProcessing = contact.enrichment_status === 'pending'

    // Check if contact has a business email (non-personal domain)
    let hasBusinessEmail = false
    let businessEmailDomain: string | null = null

    if (contact.email) {
      businessEmailDomain = extractDomainFromEmail(contact.email)
      hasBusinessEmail = !!(businessEmailDomain && !isPersonalEmailDomain(businessEmailDomain))
    }

    // Contact can be enriched if it has either a website OR a business email
    const canEnrich = (hasWebsite || hasBusinessEmail) && !isProcessing

    // Determine enrichment source and reason
    let reason: string | undefined
    let enrichmentSource: 'website' | 'email' | undefined

    if (isProcessing) {
      reason = 'Already processing'
    } else if (!hasWebsite && !hasBusinessEmail) {
      if (!contact.email) {
        reason = 'No website URL or email address'
      } else if (businessEmailDomain && isPersonalEmailDomain(businessEmailDomain)) {
        reason = 'Personal email domain detected'
      } else {
        reason = 'Invalid email format'
      }
    } else {
      // Determine which source will be used
      enrichmentSource = hasWebsite ? 'website' : 'email'
    }

    return {
      canEnrich,
      reason,
      hasWebsite,
      hasBusinessEmail,
      currentStatus: contact.enrichment_status,
      enrichmentSource
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
