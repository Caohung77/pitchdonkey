import { createServerSupabaseClient } from './supabase-server'
import { BrightDataLinkedInClient, LinkedInProfileResponse } from './brightdata-linkedin-client'

interface LinkedInEnrichmentData {
  // Personal Information
  name: string
  first_name: string
  last_name: string
  headline: string
  summary: string
  about: string  // Added: "Info" section for personalization
  
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
  
  // Social proof and Network
  follower_count?: number
  connection_count?: number
  recommendations_count?: number
  recommendations?: string[]
  
  // Professional Content
  posts?: Array<{
    text?: string
    date?: string
    engagement?: {
      likes?: number
      comments?: number
      shares?: number
    }
  }>
  
  // Services (Serviceleistungen)
  services?: Array<{
    name?: string
    description?: string
  }>
  
  // Additional Professional Info
  volunteer_experience?: Array<{
    title?: string
    organization?: string
    cause?: string
    start_date?: string
    end_date?: string
  }>
  
  organizations?: Array<{
    name?: string
    position?: string
    start_date?: string
    end_date?: string
  }>
  
  honors_and_awards?: Array<{
    title?: string
    issuer?: string
    date?: string
    description?: string
  }>
  
  projects?: Array<{
    title?: string
    description?: string
    start_date?: string
    end_date?: string
  }>
  
  courses?: Array<{
    name?: string
    institution?: string
    completion_date?: string
  }>
  
  patents?: Array<{
    title?: string
    patent_office?: string
    patent_number?: string
    date?: string
  }>
  
  publications?: Array<{
    title?: string
    publisher?: string
    date?: string
    description?: string
  }>
  
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
        
        console.log('💾 Saving LinkedIn data to database:', {
          contact_id: contactId,
          experience_count: enrichmentData.experience?.length || 0,
          education_count: enrichmentData.education?.length || 0,
          has_about: !!enrichmentData.about,
          has_current_company: !!enrichmentData.current_company
        })
        
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

        // Verify the data was saved correctly
        const { data: verificationContact } = await supabase
          .from('contacts')
          .select('linkedin_profile_data, linkedin_extraction_status')
          .eq('id', contactId)
          .single()

        if (verificationContact) {
          console.log('✅ Database verification:', {
            stored_experience_count: verificationContact.linkedin_profile_data?.experience?.length || 0,
            stored_education_count: verificationContact.linkedin_profile_data?.education?.length || 0,
            extraction_status: verificationContact.linkedin_extraction_status
          })
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
    // DEBUGGING: Log raw LinkedIn data structure
    console.log('🔍 Processing LinkedIn data - Raw experience field:', {
      experience_type: typeof rawData.experience,
      experience_is_array: Array.isArray(rawData.experience),
      experience_length: Array.isArray(rawData.experience) ? rawData.experience.length : 'N/A',
      experience_sample: Array.isArray(rawData.experience) && rawData.experience.length > 0 ? rawData.experience[0] : null
    })
    
    console.log('🔍 Processing LinkedIn data - Raw education field:', {
      education_type: typeof rawData.education,
      education_is_array: Array.isArray(rawData.education),
      education_length: Array.isArray(rawData.education) ? rawData.education.length : 'N/A',
      education_sample: Array.isArray(rawData.education) && rawData.education.length > 0 ? rawData.education[0] : null,
      educations_details_type: typeof rawData.educations_details,
      educations_details_is_array: Array.isArray(rawData.educations_details),
      educations_details_length: Array.isArray(rawData.educations_details) ? rawData.educations_details.length : 'N/A'
    })

    // Process experience data with validation
    const processedExperience = this.processExperienceData(rawData)
    const processedEducation = this.processEducationData(rawData)

    console.log('✅ Processed LinkedIn arrays:', {
      final_experience_count: processedExperience.length,
      final_education_count: processedEducation.length,
      experience_titles: processedExperience.map(exp => exp.title).filter(Boolean).slice(0, 3),
      education_schools: processedEducation.map(edu => edu.school).filter(Boolean).slice(0, 3)
    })

    return {
      // Personal Information
      name: rawData.name || '',
      first_name: rawData.first_name || rawData.name?.split(' ')[0] || '',
      last_name: rawData.last_name || rawData.name?.split(' ').slice(1).join(' ') || '',
      headline: rawData.headline || '',
      summary: rawData.summary || '',
      about: rawData.about || '',  // CRITICAL: "Info" section for personalization
      
      // Location
      city: rawData.city || '',
      country: rawData.country || '',
      country_code: rawData.country_code || '',
      
      // Professional Information
      position: rawData.position || rawData.headline || '',
      current_company: typeof rawData.current_company === 'object' && rawData.current_company?.name ? rawData.current_company.name : rawData.current_company || '',
      industry: rawData.industry || '',
      
      // Experience and Education (with comprehensive processing)
      experience: processedExperience,
      education: processedEducation,
      
      // Skills and Additional Info
      skills: Array.isArray(rawData.skills) ? rawData.skills : [], // Keep all skills
      certifications: Array.isArray(rawData.certifications) ? rawData.certifications : [],
      languages: Array.isArray(rawData.languages) ? rawData.languages : [],
      
      // Social proof and Network (CRITICAL for outreach context)
      follower_count: rawData.followers || rawData.follower_count || 0,
      connection_count: rawData.connections || rawData.connection_count || 0,
      recommendations_count: rawData.recommendations_count || 0,
      recommendations: Array.isArray(rawData.recommendations) ? rawData.recommendations : [],
      
      // Professional Content (for engagement insights)
      posts: Array.isArray(rawData.posts) ? rawData.posts.slice(0, 10) : [], // Recent posts for personalization
      
      // Services (Serviceleistungen) - CRITICAL for German LinkedIn profiles
      services: Array.isArray(rawData.services) ? rawData.services : [],
      
      // Additional Professional Info (rich context for outreach)
      volunteer_experience: Array.isArray(rawData.volunteer_experience) ? rawData.volunteer_experience : [],
      organizations: Array.isArray(rawData.organizations) ? rawData.organizations : [],
      honors_and_awards: Array.isArray(rawData.honors_and_awards) ? rawData.honors_and_awards : [],
      projects: Array.isArray(rawData.projects) ? rawData.projects : [],
      courses: Array.isArray(rawData.courses) ? rawData.courses : [],
      patents: Array.isArray(rawData.patents) ? rawData.patents : [],
      publications: Array.isArray(rawData.publications) ? rawData.publications : [],
      
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
   * Process experience data with comprehensive validation
   */
  private processExperienceData(rawData: LinkedInProfileResponse): Array<{
    title?: string
    company?: string
    location?: string
    start_date?: string
    end_date?: string
    description?: string
    duration?: string
  }> {
    // Handle multiple possible experience data sources
    const experienceData = rawData.experience;
    
    if (!experienceData) {
      console.log('⚠️ No experience data found in LinkedIn profile');
      return [];
    }

    if (!Array.isArray(experienceData)) {
      console.log('⚠️ Experience data is not an array:', typeof experienceData);
      return [];
    }

    // Filter out null/empty entries and ensure required fields
    const validExperience = experienceData
      .filter(exp => exp && (exp.title || exp.company))
      .map(exp => ({
        title: exp.title || '',
        company: exp.company || '',
        location: exp.location || '',
        start_date: exp.start_date || '',
        end_date: exp.end_date || '',
        description: exp.description || '',
        duration: exp.duration || ''
      }));

    console.log(`📊 Processed ${validExperience.length} valid experience entries from ${experienceData.length} raw entries`);
    return validExperience;
  }

  /**
   * Process education data with comprehensive validation
   */
  private processEducationData(rawData: LinkedInProfileResponse): Array<{
    school?: string
    degree?: string
    field_of_study?: string
    start_year?: string
    end_year?: string
  }> {
    // Handle multiple possible education data sources
    const educationData = rawData.education || rawData.educations_details;
    
    if (!educationData) {
      console.log('⚠️ No education data found in LinkedIn profile');
      return [];
    }

    if (!Array.isArray(educationData)) {
      console.log('⚠️ Education data is not an array:', typeof educationData);
      return [];
    }

    // Filter out null/empty entries and ensure required fields
    const validEducation = educationData
      .filter(edu => edu && (edu.school || edu.institution || edu.degree || edu.title))
      .map(edu => ({
        school: edu.school || edu.institution || edu.title || '',
        degree: edu.degree || '',
        field_of_study: edu.field_of_study || edu.field || '',
        start_year: edu.start_year || edu.start_date || '',
        end_year: edu.end_year || edu.end_date || ''
      }));

    console.log(`📊 Processed ${validEducation.length} valid education entries from ${educationData.length} raw entries`);
    return validEducation;
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