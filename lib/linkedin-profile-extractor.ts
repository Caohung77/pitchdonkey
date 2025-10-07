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
  recommendations?: Array<{
    text?: string
    recommender?: string
    recommender_profile?: string
    relationship?: string
    date?: string
  }> | string[]
  
  // Professional Content
  posts?: Array<{
    title?: string
    text?: string
    content?: string
    date?: string
    created_date?: string
    url?: string
    likes_count?: number
    comments_count?: number
    shares_count?: number
    media_type?: string
    engagement?: {
      likes?: number
      comments?: number
      shares?: number
    }
  }>
  
  // Recent LinkedIn Activity (interactions, likes, shares)
  activity?: Array<{
    interaction?: string
    link?: string
    title?: string
    img?: string
    id?: string
    date?: string
    type?: string
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
        .select('id, linkedin_url, first_name, last_name, website, linkedin_profile_data, linkedin_extraction_status')
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
        console.log(`⏭️ Skipping contact ${contactId} - No LinkedIn URL found`)

        // Mark as failed to skip in future processing
        await this.updateLinkedInStatus(contactId, 'failed', 'No LinkedIn URL found')

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
        // 6. Extract profile with Bright Data (async with 90 second timeout)
        const profileData = await Promise.race([
          this.brightDataClient.extractProfile(linkedinUrl),
          new Promise<null>((resolve) =>
            setTimeout(() => {
              console.warn(`⏰ LinkedIn extraction timeout after 90 seconds for ${linkedinUrl}`)
              resolve(null)
            }, 90000)
          )
        ])
        
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
        
        // Extract company URL from LinkedIn bio_links
        const extractedCompanyUrl = this.extractCompanyUrlFromLinkedIn(profileData)
        
        console.log('💾 Saving LinkedIn data to database:', {
          contact_id: contactId,
          experience_count: enrichmentData.experience?.length || 0,
          education_count: enrichmentData.education?.length || 0,
          has_about: !!enrichmentData.about,
          has_current_company: !!enrichmentData.current_company,
          extracted_company_url: extractedCompanyUrl || 'none'
        })
        
        // 7.1. Validate that we have meaningful data
        const hasValidData = this.validateLinkedInData(enrichmentData)
        
        if (!hasValidData) {
          console.warn('⚠️ LinkedIn data appears to be empty or insufficient - marking as failed')
          await this.updateLinkedInStatus(contactId, 'failed', 'LinkedIn profile contains no extractable data (may be private or restricted)')
          return {
            success: false,
            error: 'LinkedIn profile contains no extractable data. This may be due to privacy settings or profile restrictions.',
            contact_id: contactId,
            linkedin_url: linkedinUrl,
            status: 'failed'
          }
        }
        
        // 8. Update contact with LinkedIn data - both JSON blob and individual fields
        const updateData: any = {
          // Update personal fields if empty
          first_name: contact.first_name || enrichmentData.first_name,
          last_name: contact.last_name || enrichmentData.last_name,
          position: enrichmentData.position,
          city: enrichmentData.city,
          country: enrichmentData.country,
          
          // Store complete LinkedIn profile data (backwards compatibility)
          linkedin_profile_data: enrichmentData,
          linkedin_extraction_status: 'completed',
          linkedin_extracted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          
          // NEW: Individual LinkedIn fields for better querying and display
          linkedin_first_name: enrichmentData.first_name,
          linkedin_last_name: enrichmentData.last_name,
          linkedin_headline: enrichmentData.headline,
          linkedin_summary: enrichmentData.summary,
          linkedin_about: enrichmentData.about, // CRITICAL for personalization
          linkedin_current_company: enrichmentData.current_company,
          linkedin_current_position: enrichmentData.position,
          linkedin_industry: enrichmentData.industry,
          linkedin_location: enrichmentData.city && enrichmentData.country ? 
            `${enrichmentData.city}, ${enrichmentData.country}` : 
            enrichmentData.city || enrichmentData.country || null,
          linkedin_city: enrichmentData.city,
          linkedin_country: enrichmentData.country,
          linkedin_country_code: enrichmentData.country_code,
          linkedin_follower_count: enrichmentData.follower_count || null,
          linkedin_connection_count: enrichmentData.connection_count || null,
          linkedin_recommendations_count: enrichmentData.recommendations_count || null,
          linkedin_profile_completeness: profileData.profile_completeness || null,
          linkedin_avatar_url: profileData.avatar || profileData.avatar_url || null,
          linkedin_banner_url: profileData.banner_image || profileData.banner_url || null,
          
          // JSONB fields for complex data structures
          linkedin_experience: enrichmentData.experience?.length > 0 ? enrichmentData.experience : null,
          linkedin_education: enrichmentData.education?.length > 0 ? enrichmentData.education : null,
          linkedin_skills: enrichmentData.skills?.length > 0 ? enrichmentData.skills : null,
          linkedin_languages: enrichmentData.languages?.length > 0 ? enrichmentData.languages : null,
          linkedin_certifications: enrichmentData.certifications?.length > 0 ? enrichmentData.certifications : null,
          linkedin_volunteer_experience: enrichmentData.volunteer_experience?.length > 0 ? enrichmentData.volunteer_experience : null,
          linkedin_honors_awards: enrichmentData.honors_and_awards?.length > 0 ? enrichmentData.honors_and_awards : null,
          linkedin_projects: enrichmentData.projects?.length > 0 ? enrichmentData.projects : null,
          linkedin_courses: enrichmentData.courses?.length > 0 ? enrichmentData.courses : null,
          linkedin_publications: enrichmentData.publications?.length > 0 ? enrichmentData.publications : null,
          linkedin_patents: enrichmentData.patents?.length > 0 ? enrichmentData.patents : null,
          linkedin_organizations: enrichmentData.organizations?.length > 0 ? enrichmentData.organizations : null,
          linkedin_posts: enrichmentData.posts?.length > 0 ? enrichmentData.posts : null,
          linkedin_activity: enrichmentData.activity?.length > 0 ? enrichmentData.activity : null,
          linkedin_recommendations: enrichmentData.recommendations?.length > 0 ? enrichmentData.recommendations : null,
          linkedin_people_also_viewed: profileData.people_also_viewed?.length > 0 ? profileData.people_also_viewed : null,
          linkedin_contact_info: enrichmentData.contact_info && Object.keys(enrichmentData.contact_info).length > 0 ? enrichmentData.contact_info : null,
          linkedin_services: enrichmentData.services?.length > 0 ? enrichmentData.services : null
        }

        // Only add company URL if contact doesn't have a website and we extracted one from LinkedIn
        let shouldEnrichWebsite = false
        if (!contact.website && extractedCompanyUrl) {
          updateData.website = extractedCompanyUrl
          shouldEnrichWebsite = true
          console.log('🌐 Added company website from LinkedIn:', extractedCompanyUrl)
        }

        const { error: updateError } = await supabase
          .from('contacts')
          .update(updateData)
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

        // If we added a company website, trigger website enrichment
        if (shouldEnrichWebsite && extractedCompanyUrl) {
          console.log('🔄 Triggering website enrichment for extracted company URL...')
          try {
            // Import here to avoid circular dependency
            const { ContactEnrichmentService } = await import('./contact-enrichment')
            const websiteService = new ContactEnrichmentService()
            
            // Trigger website enrichment asynchronously (don't wait for completion)
            websiteService.enrichContact(contactId, userId).catch((error) => {
              console.error('⚠️ Website enrichment failed for extracted company URL:', error)
              // Don't fail the LinkedIn extraction if website enrichment fails
            })
            
            console.log('✅ Website enrichment triggered for company URL:', extractedCompanyUrl)
          } catch (error) {
            console.error('⚠️ Failed to trigger website enrichment:', error)
            // Don't fail the LinkedIn extraction if we can't trigger website enrichment
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
            stored_experience_count: (verificationContact.linkedin_profile_data as any)?.experience?.length || 0,
            stored_education_count: (verificationContact.linkedin_profile_data as any)?.education?.length || 0,
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
      linkedin_profile_data: data.linkedin_profile_data as LinkedInEnrichmentData | null,
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
      current_company: typeof rawData.current_company === 'object' && rawData.current_company !== null && 'name' in rawData.current_company 
        ? rawData.current_company.name || ''
        : (typeof rawData.current_company === 'string' ? rawData.current_company : ''),
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
      activity: Array.isArray(rawData.activity) ? rawData.activity.slice(0, 15) : [], // Recent LinkedIn activity for personalization
      
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
   * Process experience data with comprehensive validation and synthesis
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
    let validExperience: Array<any> = [];
    
    // First, try to process formal experience array
    if (experienceData && Array.isArray(experienceData)) {
      // Filter out null/empty entries and ensure required fields
      validExperience = experienceData
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

      console.log(`📊 Processed ${validExperience.length} formal experience entries from ${experienceData.length} raw entries`);
    } else {
      console.log('⚠️ No formal experience array found in LinkedIn profile');
    }
    
    // If we have no experience entries but have current company data, synthesize an entry
    if (validExperience.length === 0 && (rawData.position || rawData.current_company)) {
      console.log('🔧 Synthesizing experience entry from current company data...');
      
      let currentCompanyName = '';
      if (typeof rawData.current_company === 'object' && rawData.current_company !== null) {
        currentCompanyName = rawData.current_company.name || '';
      } else if (typeof rawData.current_company === 'string') {
        currentCompanyName = rawData.current_company;
      }
      
      if (rawData.position || currentCompanyName) {
        const synthesizedEntry = {
          title: rawData.position || 'Professional',
          company: currentCompanyName || 'Current Company',
          location: rawData.city || '',
          start_date: '', // We don't have start date info
          end_date: '', // Current position, no end date
          description: rawData.headline || rawData.about || '',
          duration: 'Current'
        };
        
        validExperience.push(synthesizedEntry);
        console.log('✅ Synthesized experience entry:', {
          title: synthesizedEntry.title,
          company: synthesizedEntry.company,
          location: synthesizedEntry.location
        });
      }
    }
    
    console.log(`🎯 Final processed experience count: ${validExperience.length}`);
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
      .filter(edu => edu && ((edu as any).school || (edu as any).institution || (edu as any).degree || (edu as any).title))
      .map(edu => {
        const eduAny = edu as any
        return {
          school: eduAny.school || eduAny.institution || eduAny.title || '',
          degree: eduAny.degree || '',
          field_of_study: eduAny.field_of_study || eduAny.field || '',
          start_year: eduAny.start_year || eduAny.start_date || '',
          end_year: eduAny.end_year || eduAny.end_date || ''
        }
      });

    console.log(`📊 Processed ${validEducation.length} valid education entries from ${educationData.length} raw entries`);
    return validEducation;
  }

  /**
   * Extract company URL from LinkedIn profile bio_links or contact_info
   */
  private extractCompanyUrlFromLinkedIn(rawData: any): string | null {
    console.log('🔍 Extracting company URL from LinkedIn data...')
    
    // Check bio_links first (most common source for company websites)
    if (Array.isArray(rawData.bio_links) && rawData.bio_links.length > 0) {
      for (const link of rawData.bio_links) {
        if (link && (link.title || link.name)) {
          const title = (link.title || link.name || '').toLowerCase()
          
          // Look for company website indicators
          if (title.includes('website') || 
              title.includes('company') || 
              title.includes('homepage') ||
              title.includes('web') ||
              title.includes('site')) {
            
            const url = link.link || link.url
            if (url && this.isValidCompanyUrl(url)) {
              console.log('🌐 Found company URL in bio_links:', url)
              return this.normalizeUrl(url)
            }
          }
        }
      }
    }

    // Check contact_info.websites as fallback
    if (rawData.contact_info?.websites && Array.isArray(rawData.contact_info.websites)) {
      for (const website of rawData.contact_info.websites) {
        if (website && this.isValidCompanyUrl(website)) {
          console.log('🌐 Found company URL in contact_info.websites:', website)
          return this.normalizeUrl(website)
        }
      }
    }

    // Check if bio_links has any URLs even without obvious titles
    if (Array.isArray(rawData.bio_links) && rawData.bio_links.length > 0) {
      const firstLink = rawData.bio_links[0]
      if (firstLink && (firstLink.link || firstLink.url)) {
        const url = firstLink.link || firstLink.url
        if (url && this.isValidCompanyUrl(url)) {
          console.log('🌐 Found company URL in first bio_link:', url)
          return this.normalizeUrl(url)
        }
      }
    }

    console.log('⚠️ No company URL found in LinkedIn data')
    return null
  }

  /**
   * Validate if a URL looks like a company website (not social media)
   */
  private isValidCompanyUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false
    
    // Normalize URL for checking
    const cleanUrl = url.toLowerCase().trim()
    
    // Must be a valid URL format
    if (!cleanUrl.match(/^https?:\/\/.+/)) return false
    
    // Exclude social media and common non-company domains
    const excludePatterns = [
      'linkedin.com',
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'youtube.com',
      'github.com',
      'stackoverflow.com',
      'medium.com',
      'behance.net',
      'dribbble.com'
    ]
    
    for (const pattern of excludePatterns) {
      if (cleanUrl.includes(pattern)) {
        return false
      }
    }
    
    return true
  }

  /**
   * Normalize URL to ensure consistent format
   */
  private normalizeUrl(url: string): string {
    if (!url) return url
    
    let normalized = url.trim()
    
    // Ensure it starts with http/https
    if (!normalized.match(/^https?:\/\//)) {
      normalized = `https://${normalized}`
    }
    
    // Remove trailing slash for consistency
    normalized = normalized.replace(/\/$/, '')
    
    return normalized
  }

  /**
   * Validate if LinkedIn data contains meaningful information
   */
  private validateLinkedInData(data: LinkedInEnrichmentData): boolean {
    console.log('🔍 Validating LinkedIn data quality:', {
      has_name: !!(data.name || data.first_name || data.last_name),
      has_headline: !!data.headline,
      has_about: !!data.about,
      has_summary: !!data.summary,
      has_position: !!data.position,
      has_company: !!data.current_company,
      has_experience: !!(data.experience && data.experience.length > 0),
      has_education: !!(data.education && data.education.length > 0),
      has_skills: !!(data.skills && data.skills.length > 0),
      has_location: !!(data.city || data.country),
      name_value: data.name,
      headline_value: data.headline,
      position_value: data.position
    })

    // Check if we have at least some basic meaningful data
    // A valid LinkedIn profile should have at least:
    // 1. A name OR headline OR position, AND
    // 2. Some additional meaningful field (about, company, experience, etc.)
    
    const hasBasicIdentity = !!(
      data.name?.trim() || 
      data.first_name?.trim() || 
      data.last_name?.trim() || 
      data.headline?.trim() || 
      data.position?.trim()
    )
    
    const hasAdditionalInfo = !!(
      data.about?.trim() ||
      data.summary?.trim() ||
      data.current_company?.toString()?.trim() ||
      (data.experience && data.experience.length > 0) ||
      (data.education && data.education.length > 0) ||
      (data.skills && data.skills.length > 0) ||
      data.city?.trim() ||
      data.country?.trim() ||
      data.industry?.trim()
    )

    // DEBUG: Log validation details for troubleshooting
    if (!hasBasicIdentity || !hasAdditionalInfo) {
      console.log('🔍 Detailed validation breakdown:', {
        'data.name': data.name,
        'data.current_company': data.current_company,
        'data.city': data.city,
        'hasBasicIdentity': hasBasicIdentity,
        'hasAdditionalInfo': hasAdditionalInfo
      })
    }
    
    const isValid = hasBasicIdentity && hasAdditionalInfo
    
    console.log(`✅ LinkedIn data validation result: ${isValid ? 'VALID' : 'INVALID'}`, {
      hasBasicIdentity,
      hasAdditionalInfo
    })
    
    return isValid
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