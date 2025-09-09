interface BrightDataConfig {
  apiKey: string
  datasetId: string
  baseUrl: string
}

interface LinkedInProfileRequest {
  url: string
}

interface LinkedInProfileResponse {
  // Core Profile Fields (Bright Data Schema)
  id?: string                           // Unique identifier for the person's LinkedIn profile
  linkedin_id?: string                  // Alternative LinkedIn ID format
  linkedin_num_id?: string             // Numeric LinkedIn ID
  name?: string                        // Profile name (97.39% coverage)
  first_name?: string
  last_name?: string
  headline?: string
  about?: string                       // Concise profile summary (18.96% coverage)
  
  // Location Information (High Coverage)
  city?: string                        // Geographical location (96.08% coverage)
  state?: string
  country?: string
  country_code?: string                // Geographical location (96.94% coverage)
  
  // Professional Information
  position?: string                    // Current job title (91.70% coverage)
  current_company?: string             // Legacy format
  current_company_name?: string        // Company name from current_company object
  current_company_company_id?: string  // Company ID from current_company object
  industry?: string
  
  // Current Company Object (100% coverage)
  current_company?: {
    name?: string
    company_id?: string
    industry?: string
    job_title?: string
    location?: string
    start_date?: string
  }
  
  // Media and URLs
  url?: string                         // LinkedIn profile URL
  input_url?: string                   // Original input URL
  profile_url?: string                 // Alternative URL format
  avatar?: string                      // Profile picture URL
  avatar_url?: string                  // Alternative avatar format
  banner_image?: string                // Banner image URL
  banner_url?: string                  // Alternative banner format
  timestamp?: string                   // Data extraction timestamp
  
  // Professional History (65.24% coverage)
  experience?: Array<{
    title?: string
    company?: string
    company_id?: string
    company_url?: string
    location?: string
    start_date?: string
    end_date?: string
    description?: string
    duration?: string
    industry?: string
  }>
  
  // Education Details
  education?: Array<{
    school?: string
    degree?: string
    field_of_study?: string
    start_year?: string
    end_year?: string
    start_date?: string
    end_date?: string
    description?: string
    school_url?: string
  }>
  
  educations_details?: Array<{
    institution?: string
    degree?: string
    field?: string
    start_year?: string
    end_year?: string
    description?: string
  }>
  
  // Skills and Certifications
  skills?: string[]
  certifications?: Array<{
    name?: string
    organization?: string
    organization_url?: string
    issue_date?: string
    expiration_date?: string
    credential_id?: string
    credential_url?: string
    description?: string
  }>
  
  // Languages and International
  languages?: Array<{
    name?: string
    proficiency?: string
  }>
  
  // Recognition and Awards
  honors_and_awards?: Array<{
    title?: string
    issuer?: string
    issue_date?: string
    description?: string
    url?: string
  }>
  
  honors_awards?: Array<{  // Legacy format compatibility
    title?: string
    issuer?: string
    issue_date?: string
    description?: string
  }>
  
  // Professional Activities
  volunteer_experience?: Array<{
    organization?: string
    role?: string
    cause?: string
    start_date?: string
    end_date?: string
    description?: string
    url?: string
  }>
  
  projects?: Array<{
    name?: string
    description?: string
    url?: string
    start_date?: string
    end_date?: string
    associated_with?: string
  }>
  
  courses?: Array<{
    name?: string
    institution?: string
    completion_date?: string
    url?: string
    description?: string
  }>
  
  publications?: Array<{
    title?: string
    publisher?: string
    publication_date?: string
    url?: string
    description?: string
    authors?: string[]
  }>
  
  patents?: Array<{
    title?: string
    patent_office?: string
    patent_number?: string
    issue_date?: string
    inventors?: string[]
    description?: string
    url?: string
  }>
  
  organizations?: Array<{
    name?: string
    position?: string
    start_date?: string
    end_date?: string
    description?: string
  }>
  
  // Social Activity (2.43% coverage)
  posts?: Array<{
    title?: string
    content?: string
    created_date?: string
    url?: string
    likes_count?: number
    comments_count?: number
    shares_count?: number
    media_type?: string
  }>
  
  activity?: Array<{
    type?: string
    title?: string
    date?: string
    url?: string
    engagement?: {
      likes?: number
      comments?: number
      shares?: number
    }
  }>
  
  // Social Metrics
  followers?: number                   // Alternative to follower_count
  follower_count?: number
  connections?: number                 // Alternative to connection_count  
  connection_count?: number
  recommendations_count?: number
  
  // Recommendations
  recommendations?: Array<{
    text?: string
    recommender?: string
    recommender_profile?: string
    relationship?: string
    date?: string
  }>
  
  // Related Profiles
  people_also_viewed?: Array<{
    name?: string
    profile_url?: string
    headline?: string
    current_company?: string
  }>
  
  // Contact Information
  contact_info?: {
    websites?: string[]
    phone?: string
    email?: string
    twitter?: string
    address?: string
  }
  
  // Metadata and Quality
  profile_completeness?: number
  data_quality_score?: number
  extraction_confidence?: number
  
  // Error handling
  error?: string
  status?: 'success' | 'error' | 'partial'
}

interface BrightDataApiResponse {
  snapshot_id?: string
  status?: string
  error?: string
  data?: LinkedInProfileResponse[]
}

interface BrightDataSnapshotResponse {
  snapshot_id: string
  status: 'running' | 'completed' | 'failed'
  total_rows?: number
  rows_collected?: number
  data?: LinkedInProfileResponse[]
  error?: string
}

/**
 * Bright Data LinkedIn API Client
 * Based on the Java implementation provided
 */
export class BrightDataLinkedInClient {
  private config: BrightDataConfig

  constructor() {
    this.config = {
      apiKey: process.env.BRIGHTDATA_API_KEY!,
      // LinkedIn Profiles API dataset ID (working one)
      datasetId: process.env.BRIGHTDATA_DATASET_ID || 'gd_l1viktl72bvl7bjuj0',
      baseUrl: process.env.BRIGHTDATA_API_URL || 'https://api.brightdata.com/datasets/v3'
    }

    if (!this.config.apiKey) {
      throw new Error('BRIGHTDATA_API_KEY is not configured')
    }
  }

  /**
   * Extract LinkedIn profile data for a single URL
   */
  async extractProfile(linkedinUrl: string): Promise<LinkedInProfileResponse> {
    const profiles = await this.extractProfiles([linkedinUrl])
    
    if (profiles.length === 0) {
      throw new Error('No profile data returned from Bright Data API')
    }
    
    return profiles[0]
  }

  /**
   * Extract LinkedIn profile data for multiple URLs (batch processing)
   */
  async extractProfiles(linkedinUrls: string[]): Promise<LinkedInProfileResponse[]> {
    if (!linkedinUrls || linkedinUrls.length === 0) {
      throw new Error('No LinkedIn URLs provided')
    }

    // Validate URLs
    const validUrls = linkedinUrls.filter(url => this.isValidLinkedInUrl(url))
    if (validUrls.length === 0) {
      throw new Error('No valid LinkedIn URLs provided')
    }

    console.log(`🔍 Extracting ${validUrls.length} LinkedIn profiles via Bright Data...`)

    try {
      // Prepare request payload for LinkedIn Profiles API
      // According to Bright Data docs, LinkedIn profiles need specific format
      const requestPayload = validUrls.map(url => ({ 
        url: this.normalizeLinkedInUrl(url)
      }))

      console.log('📤 Request payload:', JSON.stringify(requestPayload, null, 2))

      const response = await fetch(`${this.config.baseUrl}/trigger?dataset_id=${this.config.datasetId}&include_errors=true&format=json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Bright Data API Error:', response.status, response.statusText)
        console.error('❌ Error Details:', errorText)
        throw new Error(`Bright Data API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data: BrightDataApiResponse = await response.json()
      console.log('✅ Bright Data API response received')
      console.log('📊 Full API Response:', JSON.stringify(data, null, 2))

      // Handle API response
      if (data.error) {
        throw new Error(`Bright Data API error: ${data.error}`)
      }

      // If we got a snapshot_id, poll for results
      if (data.snapshot_id && (!data.data || data.data.length === 0)) {
        console.log('📝 Snapshot ID received, polling for results:', data.snapshot_id)
        const snapshotResults = await this.pollSnapshotResults(data.snapshot_id)
        if (snapshotResults && snapshotResults.length > 0) {
          console.log(`📊 Successfully retrieved ${snapshotResults.length} LinkedIn profiles from snapshot`)
          return snapshotResults.map(profile => this.normalizeProfile(profile))
        }
      }

      if (!data.data || data.data.length === 0) {
        console.warn('⚠️ No profile data returned from Bright Data API')
        return []
      }

      console.log(`📊 Successfully extracted ${data.data.length} LinkedIn profiles`)
      return data.data.map(profile => this.normalizeProfile(profile))

    } catch (error) {
      console.error('❌ Error extracting LinkedIn profiles:', error)
      throw new Error(`Failed to extract LinkedIn profiles: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate LinkedIn URL format (supports international domains)
   */
  isValidLinkedInUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      // Support international LinkedIn domains
      const validHostnames = [
        'linkedin.com',
        'www.linkedin.com',
        'de.linkedin.com',
        'fr.linkedin.com', 
        'es.linkedin.com',
        'it.linkedin.com',
        'br.linkedin.com',
        'in.linkedin.com',
        'au.linkedin.com',
        'ca.linkedin.com',
        'uk.linkedin.com'
      ]
      
      const isValidHostname = validHostnames.includes(urlObj.hostname) || 
                             urlObj.hostname.endsWith('.linkedin.com')
      
      return isValidHostname && urlObj.pathname.includes('/in/')
    } catch {
      return false
    }
  }

  /**
   * Normalize LinkedIn profile URL
   */
  normalizeLinkedInUrl(url: string): string {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      
      const urlObj = new URL(url)
      
      // Ensure it's a LinkedIn profile URL
      if (!this.isValidLinkedInUrl(url)) {
        throw new Error('Invalid LinkedIn profile URL')
      }
      
      // Normalize to www.linkedin.com for consistent processing
      // Remove query parameters and fragments
      let cleanPath = urlObj.pathname
      if (cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1)
      }
      
      const normalizedUrl = `https://www.linkedin.com${cleanPath}`
      console.log(`🔗 Normalized URL: ${url} → ${normalizedUrl}`)
      
      return normalizedUrl
      
    } catch (error) {
      console.error('❌ URL normalization error:', error)
      throw new Error(`Invalid LinkedIn URL format: ${url}`)
    }
  }

  /**
   * Normalize profile data structure
   */
  private normalizeProfile(profile: LinkedInProfileResponse): LinkedInProfileResponse {
    // Log the raw profile data structure for debugging
    console.log('🔧 BrightData profile normalization - Raw arrays:', {
      experience_raw: {
        type: typeof profile.experience,
        is_array: Array.isArray(profile.experience),
        length: Array.isArray(profile.experience) ? profile.experience.length : 'N/A',
        sample: Array.isArray(profile.experience) && profile.experience.length > 0 ? profile.experience[0] : null
      },
      education_raw: {
        type: typeof profile.education,
        is_array: Array.isArray(profile.education),
        length: Array.isArray(profile.education) ? profile.education.length : 'N/A',
        sample: Array.isArray(profile.education) && profile.education.length > 0 ? profile.education[0] : null
      },
      educations_details_raw: {
        type: typeof profile.educations_details,
        is_array: Array.isArray(profile.educations_details),
        length: Array.isArray(profile.educations_details) ? profile.educations_details.length : 'N/A'
      }
    })

    // Clean arrays with logging
    const cleanedExperience = Array.isArray(profile.experience) 
      ? profile.experience.filter(exp => exp && (exp.title || exp.company))
      : []
    
    // Education can come in multiple shapes. BrightData sometimes returns
    // entries with only a title or institution name. Accept those as valid.
    const cleanedEducation = Array.isArray(profile.education)
      ? profile.education.filter(edu =>
          edu && (edu.school || edu.degree || (edu as any).title || (edu as any).institution)
        )
      : []

    console.log('🔧 BrightData profile normalization - Cleaned arrays:', {
      original_experience_count: Array.isArray(profile.experience) ? profile.experience.length : 0,
      cleaned_experience_count: cleanedExperience.length,
      original_education_count: Array.isArray(profile.education) ? profile.education.length : 0,
      cleaned_education_count: cleanedEducation.length
    })

    // Clean and normalize the profile data
    const normalized: LinkedInProfileResponse = {
      ...profile,
      // Ensure consistent name fields
      first_name: profile.first_name || profile.name?.split(' ')[0] || '',
      last_name: profile.last_name || profile.name?.split(' ').slice(1).join(' ') || '',
      
      // Normalize location data
      country_code: profile.country_code?.toUpperCase() || '',
      
      // Clean arrays
      skills: Array.isArray(profile.skills) ? profile.skills.filter(Boolean) : [],
      experience: cleanedExperience,
      education: cleanedEducation,
      certifications: Array.isArray(profile.certifications) ? profile.certifications.filter(cert => cert.name) : [],
      
      // Set status
      status: profile.error ? 'error' : 'success'
    }

    // Fallback: some profiles only include `educations_details` (strings/loose objects)
    if ((!normalized.education || normalized.education.length === 0) && Array.isArray(profile.educations_details)) {
      normalized.education = profile.educations_details
        .filter(Boolean)
        .map((e: any) => ({
          school: e?.institution || e?.institute || e?.title || e?.school || undefined,
          degree: e?.degree || undefined,
          field_of_study: e?.field || undefined,
          start_year: e?.start_year || e?.start_date || undefined,
          end_year: e?.end_year || e?.end_date || undefined,
          description: e?.description || undefined,
          school_url: e?.url || undefined
        }))
        .filter(edu => edu.school || edu.degree || edu.field_of_study)
    }

    return normalized
  }

  /**
   * Poll snapshot results until completion
   */
  async pollSnapshotResults(snapshotId: string, maxWaitTime = 180000, pollInterval = 10000): Promise<LinkedInProfileResponse[]> {
    console.log(`📊 Polling snapshot results for: ${snapshotId} (max wait: ${maxWaitTime}ms)`)
    console.log(`📡 Progress endpoint: ${this.config.baseUrl}/progress/${snapshotId}`)
    console.log(`📥 Data endpoint: ${this.config.baseUrl}/snapshot/${snapshotId}`)
    
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = Math.ceil(maxWaitTime / pollInterval)

    while (Date.now() - startTime < maxWaitTime && attempts < maxAttempts) {
      attempts++
      
      try {
        console.log(`📊 Polling attempt ${attempts}/${maxAttempts}...`)
        
        const response = await fetch(`${this.config.baseUrl}/progress/${snapshotId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          }
        })

        if (!response.ok) {
          console.warn(`⚠️ Snapshot polling attempt ${attempts} failed: ${response.status}`)
          if (attempts >= maxAttempts) {
            throw new Error(`Snapshot polling failed after ${attempts} attempts: ${response.status}`)
          }
        } else {
          const progressData = await response.json()
          console.log(`📊 Snapshot status: ${progressData.status} (${progressData.rows_collected || 0}/${progressData.total_rows || 0} rows)`)

          if (progressData.status === 'completed' || (progressData.status === 'ready' && (progressData.records > 0 || progressData.rows_collected > 0))) {
            // Job is completed, now download the actual data
            console.log(`✅ Snapshot completed, downloading data...`)
            const dataResponse = await fetch(`${this.config.baseUrl}/snapshot/${snapshotId}?format=json`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
              }
            })
            
            if (!dataResponse.ok) {
              const errorText = await dataResponse.text()
              console.error('❌ Data download error:', errorText)
              throw new Error(`Failed to download snapshot data: ${dataResponse.status} - ${errorText}`)
            }
            
            const actualData = await dataResponse.json()
            console.log(`✅ Downloaded data:`, JSON.stringify(actualData, null, 2))
            
            if (!actualData || (Array.isArray(actualData) && actualData.length === 0)) {
              console.warn('⚠️ No data in completed snapshot')
              return []
            }
            
            return Array.isArray(actualData) ? actualData : [actualData]
            
          } else if (progressData.status === 'failed') {
            throw new Error(`Snapshot processing failed: ${progressData.error || 'Unknown error'}`)
          }
          
          // Status is 'running' or 'ready' (without data), continue polling
        }

        // Wait before next poll
        if (attempts < maxAttempts) {
          console.log(`⏳ Waiting ${pollInterval}ms before next poll...`)
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }

      } catch (error) {
        console.error(`❌ Error polling snapshot ${snapshotId}:`, error instanceof Error ? error.message : 'Unknown error')
        if (attempts >= maxAttempts) {
          throw error
        }
        // Continue polling on error
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    throw new Error(`Snapshot polling timeout after ${maxWaitTime}ms`)
  }

  /**
   * Get snapshot status without polling
   */
  async getSnapshotStatus(snapshotId: string): Promise<BrightDataSnapshotResponse> {
    const response = await fetch(`${this.config.baseUrl}/progress/${snapshotId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get snapshot status: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * Check API quota and rate limits
   */
  async checkApiStatus(): Promise<{ available: boolean; message?: string }> {
    try {
      // This is a placeholder - Bright Data may have specific endpoints for quota checking
      // For now, we'll do a basic connectivity test
      const response = await fetch(`${this.config.baseUrl}/trigger?dataset_id=${this.config.datasetId}&include_errors=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([]) // Empty request to check connectivity
      })

      return {
        available: response.status !== 429, // 429 = Too Many Requests
        message: response.status === 429 ? 'Rate limit exceeded' : 'API available'
      }
    } catch (error) {
      return {
        available: false,
        message: `API connectivity error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get suggested fields for personalization
   */
  getPersonalizationFields(profile: LinkedInProfileResponse): {
    basic: Record<string, any>
    professional: Record<string, any>
    personal: Record<string, any>
  } {
    return {
      basic: {
        name: profile.name,
        position: profile.position,
        company: profile.current_company,
        location: [profile.city, profile.country].filter(Boolean).join(', ')
      },
      professional: {
        industry: profile.industry,
        experience_count: profile.experience?.length || 0,
        current_role: profile.experience?.[0]?.title,
        education: profile.education?.[0]?.school,
        skills: profile.skills?.slice(0, 5) // Top 5 skills
      },
      personal: {
        volunteer: profile.volunteer_experience?.length || 0,
        projects: profile.projects?.length || 0,
        awards: profile.honors_awards?.length || 0,
        languages: profile.languages?.map(l => l.name) || []
      }
    }
  }
}

// Export types for use in other modules
export type { LinkedInProfileResponse, LinkedInProfileRequest, BrightDataApiResponse }