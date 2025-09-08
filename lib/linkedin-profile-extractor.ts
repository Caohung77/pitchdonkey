import { createServerSupabaseClient } from './supabase-server'
import { BrightDataLinkedInClient, LinkedInProfileResponse } from './brightdata-linkedin-client'

interface LinkedInEnrichmentData {
  // Personal Information
  name: string
  first_name: string
  last_name: string
  headline: string
  summary: string
  
  // Location
  city: string
  country: string
  country_code: string
  
  // Professional Information
  position: string
  current_company: string
  industry: string
  
  // Experience and Education
  experience: Array<{
    title?: string
    company?: string
    location?: string
    start_date?: string
    end_date?: string
    description?: string
    duration?: string
  }>
  
  education: Array<{
    school?: string
    degree?: string
    field_of_study?: string
    start_year?: string
    end_year?: string
  }>
  
  // Skills and Additional Info
  skills: string[]
  certifications: Array<{
    name?: string
    organization?: string
    issue_date?: string
  }>
  
  languages: Array<{
    name?: string
    proficiency?: string
  }>
  
  // Social proof
  follower_count?: number
  connection_count?: number
  
  // Contact info
  contact_info?: {
    websites?: string[]
    phone?: string
    email?: string
  }
}

interface LinkedInExtractionResult {
  success: boolean
  data?: LinkedInEnrichmentData
  error?: string
  contact_id: string
  linkedin_url: string
  snapshot_id?: string
  status: 'pending' | 'completed' | 'failed' | 'processing'
}

export class LinkedInProfileExtractorService {
  private brightDataClient: BrightDataLinkedInClient
  
  constructor() {
    this.brightDataClient = new BrightDataLinkedInClient()
  }

  /**
   * Extract LinkedIn profile for a contact
   * Handles both immediate and asynchronous processing
   */
  async extractContactLinkedIn(contactId: string, userId: string): Promise<LinkedInExtractionResult> {
    console.log(`🔍 Starting LinkedIn extraction for contact ${contactId}`)

    try {
      const supabase = await createServerSupabaseClient()

      // 1. Get the contact and validate ownership
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, linkedin_url, first_name, last_name, linkedin_profile_data, linkedin_extraction_status')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single()

      if (contactError || !contact) {
        console.error('❌ Contact not found or access denied:', contactError)
        return {
          success: false,
          error: 'Contact not found or access denied',
          contact_id: contactId,
          linkedin_url: '',
          status: 'failed'
        }
      }

      // 2. Validate LinkedIn URL exists
      if (!contact.linkedin_url) {
        console.error('❌ No LinkedIn URL found for contact')
        return {
          success: false,
          error: 'No LinkedIn URL found for this contact',
          contact_id: contactId,
          linkedin_url: '',
          status: 'failed'
        }
      }

      // 3. Normalize and validate URL
      let linkedinUrl: string
      try {
        linkedinUrl = this.brightDataClient.normalizeLinkedInUrl(contact.linkedin_url)
      } catch (error) {
        console.error('❌ Invalid LinkedIn URL:', contact.linkedin_url)
        return {
          success: false,
          error: 'Invalid LinkedIn URL format',
          contact_id: contactId,
          linkedin_url: contact.linkedin_url,
          status: 'failed'
        }
      }

      console.log(`🔗 Processing LinkedIn URL: ${linkedinUrl}`)

      // 4. Check if already processing
      if (contact.linkedin_extraction_status === 'pending') {
        return {
          success: false,
          error: 'LinkedIn extraction already in progress',
          contact_id: contactId,
          linkedin_url: linkedinUrl,
          status: 'processing'
        }
      }

      // 5. Update status to processing
      await this.updateLinkedInStatus(contactId, 'pending')

      try {
        // 6. Extract profile with Bright Data (async)
        const profileData = await this.brightDataClient.extractProfile(linkedinUrl)
        
        if (!profileData) {
          await this.updateLinkedInStatus(contactId, 'failed', 'No profile data returned')
          return {
            success: false,
            error: 'No profile data returned from LinkedIn',
            contact_id: contactId,
            linkedin_url: linkedinUrl,
            status: 'failed'
          }
        }

        // 7. Process and save the data
        const enrichmentData = this.processLinkedInData(profileData)
        
        // 8. Update contact with LinkedIn data
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            // Update personal fields if empty
            first_name: contact.first_name || enrichmentData.first_name,
            last_name: contact.last_name || enrichmentData.last_name,
            position: enrichmentData.position,
            city: enrichmentData.city,
            country: enrichmentData.country,
            
            // Store complete LinkedIn profile data
            linkedin_profile_data: enrichmentData,
            linkedin_extraction_status: 'completed',
            linkedin_extracted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', contactId)
          .eq('user_id', userId)

        if (updateError) {
          console.error('❌ Failed to save LinkedIn data:', updateError)
          await this.updateLinkedInStatus(contactId, 'failed', 'Failed to save LinkedIn data')
          return {
            success: false,
            error: 'Failed to save LinkedIn data',
            contact_id: contactId,
            linkedin_url: linkedinUrl,
            status: 'failed'
          }
        }

        console.log('✅ LinkedIn extraction completed successfully')
        return {
          success: true,
          data: enrichmentData,
          contact_id: contactId,
          linkedin_url: linkedinUrl,
          status: 'completed'
        }

      } catch (extractionError) {
        console.error('❌ LinkedIn extraction failed:', extractionError)
        await this.updateLinkedInStatus(
          contactId, 
          'failed', 
          extractionError instanceof Error ? extractionError.message : 'Extraction failed'
        )
        
        return {
          success: false,
          error: extractionError instanceof Error ? extractionError.message : 'LinkedIn extraction failed',
          contact_id: contactId,
          linkedin_url: linkedinUrl,
          status: 'failed'
        }
      }

    } catch (error) {
      console.error('❌ LinkedIn extraction error:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        contact_id: contactId,
        linkedin_url: '',
        status: 'failed'
      }
    }
  }

  /**
   * Get LinkedIn extraction data for a contact
   */
  async getLinkedInData(contactId: string, userId: string): Promise<{
    linkedin_profile_data: LinkedInEnrichmentData | null
    linkedin_extraction_status: string | null
    linkedin_extracted_at: string | null
  }> {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('contacts')
      .select('linkedin_profile_data, linkedin_extraction_status, linkedin_extracted_at')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('❌ Failed to get LinkedIn data:', error)
      return {
        linkedin_profile_data: null,
        linkedin_extraction_status: null,
        linkedin_extracted_at: null
      }
    }

    return {
      linkedin_profile_data: data.linkedin_profile_data,
      linkedin_extraction_status: data.linkedin_extraction_status,
      linkedin_extracted_at: data.linkedin_extracted_at
    }
  }

  /**
   * Check if contact can have LinkedIn extracted
   */
  async canExtractLinkedIn(contactId: string, userId: string): Promise<{
    canExtract: boolean
    reason?: string
    hasLinkedInUrl: boolean
    currentStatus?: string
  }> {
    const supabase = await createServerSupabaseClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('linkedin_url, linkedin_extraction_status')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    if (error || !contact) {
      return {
        canExtract: false,
        reason: 'Contact not found',
        hasLinkedInUrl: false
      }
    }

    const hasLinkedInUrl = !!contact.linkedin_url
    const isProcessing = contact.linkedin_extraction_status === 'pending'

    return {
      canExtract: hasLinkedInUrl && !isProcessing,
      reason: !hasLinkedInUrl ? 'No LinkedIn URL' : isProcessing ? 'Already processing' : undefined,
      hasLinkedInUrl,
      currentStatus: contact.linkedin_extraction_status
    }
  }

  /**
   * Clear LinkedIn data (for re-extraction)
   */
  async clearLinkedInData(contactId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await createServerSupabaseClient()

      const { error } = await supabase
        .from('contacts')
        .update({
          linkedin_profile_data: null,
          linkedin_extraction_status: null,
          linkedin_extracted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Failed to clear LinkedIn data:', error)
        return false
      }

      console.log('🗑️ LinkedIn data cleared successfully')
      return true

    } catch (error) {
      console.error('❌ Error clearing LinkedIn data:', error)
      return false
    }
  }

  /**
   * Process raw LinkedIn data into structured enrichment format
   */
  private processLinkedInData(rawData: LinkedInProfileResponse): LinkedInEnrichmentData {
    return {
      // Personal Information
      name: rawData.name || '',
      first_name: rawData.first_name || rawData.name?.split(' ')[0] || '',
      last_name: rawData.last_name || rawData.name?.split(' ').slice(1).join(' ') || '',
      headline: rawData.headline || '',
      summary: rawData.summary || '',
      
      // Location
      city: rawData.city || '',
      country: rawData.country || '',
      country_code: rawData.country_code || '',
      
      // Professional Information
      position: rawData.position || rawData.headline || '',
      current_company: rawData.current_company || '',
      industry: rawData.industry || '',
      
      // Experience and Education
      experience: Array.isArray(rawData.experience) ? rawData.experience.slice(0, 5) : [], // Limit to top 5
      education: Array.isArray(rawData.education) ? rawData.education.slice(0, 3) : [], // Limit to top 3
      
      // Skills and Additional Info
      skills: Array.isArray(rawData.skills) ? rawData.skills.slice(0, 10) : [], // Limit to top 10
      certifications: Array.isArray(rawData.certifications) ? rawData.certifications.slice(0, 5) : [],
      languages: Array.isArray(rawData.languages) ? rawData.languages : [],
      
      // Social proof
      follower_count: rawData.follower_count || 0,
      connection_count: rawData.connection_count || 0,
      
      // Contact info
      contact_info: rawData.contact_info || { websites: [], phone: '', email: '' }
    }
  }

  /**
   * Update LinkedIn extraction status
   */
  private async updateLinkedInStatus(
    contactId: string,
    status: 'pending' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient()
      
      const updateData: any = {
        linkedin_extraction_status: status,
        linkedin_extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId)

      console.log(`📊 Updated LinkedIn status to: ${status}`)
      if (errorMessage) {
        console.error(`❌ LinkedIn error for ${contactId}:`, errorMessage)
      }

    } catch (error) {
      console.error('❌ Failed to update LinkedIn status:', error)
    }
  }

  /**
   * Get LinkedIn extraction statistics for a user
   */
  async getLinkedInStats(userId: string): Promise<{
    total_contacts: number
    with_linkedin_urls: number
    extracted_profiles: number
    pending_extractions: number
    failed_extractions: number
  }> {
    try {
      const supabase = await createServerSupabaseClient()

      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('linkedin_url, linkedin_extraction_status')
        .eq('user_id', userId)
        .neq('status', 'deleted')

      if (error) {
        console.error('❌ Failed to get LinkedIn stats:', error)
        return {
          total_contacts: 0,
          with_linkedin_urls: 0,
          extracted_profiles: 0,
          pending_extractions: 0,
          failed_extractions: 0
        }
      }

      const stats = contacts.reduce((acc, contact) => {
        acc.total_contacts++
        
        if (contact.linkedin_url) {
          acc.with_linkedin_urls++
        }
        
        switch (contact.linkedin_extraction_status) {
          case 'completed':
            acc.extracted_profiles++
            break
          case 'pending':
            acc.pending_extractions++
            break
          case 'failed':
            acc.failed_extractions++
            break
        }
        
        return acc
      }, {
        total_contacts: 0,
        with_linkedin_urls: 0,
        extracted_profiles: 0,
        pending_extractions: 0,
        failed_extractions: 0
      })

      return stats

    } catch (error) {
      console.error('❌ Error getting LinkedIn stats:', error)
      return {
        total_contacts: 0,
        with_linkedin_urls: 0,
        extracted_profiles: 0,
        pending_extractions: 0,
        failed_extractions: 0
      }
    }
  }

  /**
   * Extract personalization hooks from LinkedIn data
   */
  getPersonalizationHooks(linkedinData: LinkedInEnrichmentData): {
    professional: string[]
    educational: string[]
    personal: string[]
    geographical: string[]
  } {
    const hooks = {
      professional: [],
      educational: [],
      personal: [],
      geographical: []
    }

    // Professional hooks
    if (linkedinData.position && linkedinData.current_company) {
      hooks.professional.push(`${linkedinData.position} at ${linkedinData.current_company}`)
    }
    if (linkedinData.industry) {
      hooks.professional.push(`Experience in ${linkedinData.industry}`)
    }
    if (linkedinData.experience && linkedinData.experience.length > 1) {
      hooks.professional.push(`Career progression through ${linkedinData.experience.length} roles`)
    }

    // Educational hooks
    if (linkedinData.education && linkedinData.education.length > 0) {
      const school = linkedinData.education[0].school
      if (school) {
        hooks.educational.push(`Alumni of ${school}`)
      }
      const degree = linkedinData.education[0].degree
      if (degree) {
        hooks.educational.push(`${degree} background`)
      }
    }

    // Personal hooks
    if (linkedinData.skills && linkedinData.skills.length > 0) {
      hooks.personal.push(`Expertise in ${linkedinData.skills.slice(0, 3).join(', ')}`)
    }
    if (linkedinData.certifications && linkedinData.certifications.length > 0) {
      hooks.personal.push(`Professional certifications in ${linkedinData.certifications[0].name}`)
    }
    if (linkedinData.languages && linkedinData.languages.length > 1) {
      hooks.personal.push(`Multilingual professional`)
    }

    // Geographical hooks
    if (linkedinData.city && linkedinData.country) {
      hooks.geographical.push(`Based in ${linkedinData.city}, ${linkedinData.country}`)
    }

    return hooks
  }
}

// Export types for use in other modules
export type { LinkedInEnrichmentData, LinkedInExtractionResult }