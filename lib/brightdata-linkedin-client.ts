interface BrightDataConfig {
  apiKey: string
  datasetId: string
  baseUrl: string
}

interface LinkedInProfileRequest {
  url: string
}

interface LinkedInProfileResponse {
  // Basic Profile Information
  linkedin_id?: string
  name?: string
  first_name?: string
  last_name?: string
  headline?: string
  summary?: string
  
  // Location
  city?: string
  state?: string
  country?: string
  country_code?: string
  
  // Professional Information
  position?: string
  current_company?: string
  industry?: string
  
  // Profile URLs and Media
  profile_url?: string
  avatar_url?: string
  banner_url?: string
  
  // Experience and Education
  experience?: Array<{
    title?: string
    company?: string
    location?: string
    start_date?: string
    end_date?: string
    description?: string
    duration?: string
  }>
  
  education?: Array<{
    school?: string
    degree?: string
    field_of_study?: string
    start_year?: string
    end_year?: string
    description?: string
  }>
  
  // Skills and Certifications
  skills?: string[]
  certifications?: Array<{
    name?: string
    organization?: string
    issue_date?: string
    expiration_date?: string
    credential_id?: string
    credential_url?: string
  }>
  
  // Additional Information
  languages?: Array<{
    name?: string
    proficiency?: string
  }>
  
  honors_awards?: Array<{
    title?: string
    issuer?: string
    issue_date?: string
    description?: string
  }>
  
  volunteer_experience?: Array<{
    organization?: string
    role?: string
    cause?: string
    start_date?: string
    end_date?: string
    description?: string
  }>
  
  projects?: Array<{
    name?: string
    description?: string
    url?: string
    start_date?: string
    end_date?: string
  }>
  
  // Social and Contact
  recommendations?: Array<{
    text?: string
    recommender?: string
    relationship?: string
  }>
  
  contact_info?: {
    websites?: string[]
    phone?: string
    email?: string
  }
  
  // Metadata
  follower_count?: number
  connection_count?: number
  profile_completeness?: number
  
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
      datasetId: process.env.BRIGHTDATA_DATASET_ID || 'gd_l1viktl72bvl7bjuj0',
      baseUrl: process.env.BRIGHTDATA_API_URL || 'https://api.brightdata.com/datasets/v3/trigger'
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
      // Prepare request payload (convert Java format to TypeScript)
      const requestPayload = validUrls.map(url => ({ url }))

      const response = await fetch(`${this.config.baseUrl}?dataset_id=${this.config.datasetId}&include_errors=true`, {
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
      
      // Preserve the original hostname (including international domains)
      // but clean up the URL (remove tracking parameters, etc.)
      return `https://${urlObj.hostname}${urlObj.pathname}`.replace(/\/$/, '')
      
    } catch {
      throw new Error('Invalid LinkedIn URL format')
    }
  }

  /**
   * Normalize profile data structure
   */
  private normalizeProfile(profile: LinkedInProfileResponse): LinkedInProfileResponse {
    // Clean and normalize the profile data
    return {
      ...profile,
      // Ensure consistent name fields
      first_name: profile.first_name || profile.name?.split(' ')[0] || '',
      last_name: profile.last_name || profile.name?.split(' ').slice(1).join(' ') || '',
      
      // Normalize location data
      country_code: profile.country_code?.toUpperCase() || '',
      
      // Clean arrays
      skills: Array.isArray(profile.skills) ? profile.skills.filter(Boolean) : [],
      experience: Array.isArray(profile.experience) ? profile.experience.filter(exp => exp.title || exp.company) : [],
      education: Array.isArray(profile.education) ? profile.education.filter(edu => edu.school || edu.degree) : [],
      certifications: Array.isArray(profile.certifications) ? profile.certifications.filter(cert => cert.name) : [],
      
      // Set status
      status: profile.error ? 'error' : 'success'
    }
  }

  /**
   * Poll snapshot results until completion
   */
  async pollSnapshotResults(snapshotId: string, maxWaitTime = 120000, pollInterval = 5000): Promise<LinkedInProfileResponse[]> {
    console.log(`📊 Polling snapshot results for: ${snapshotId} (max wait: ${maxWaitTime}ms)`)
    
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = Math.ceil(maxWaitTime / pollInterval)

    while (Date.now() - startTime < maxWaitTime && attempts < maxAttempts) {
      attempts++
      
      try {
        console.log(`📊 Polling attempt ${attempts}/${maxAttempts}...`)
        
        const response = await fetch(`${this.config.baseUrl.replace('/trigger', '')}/snapshots/${snapshotId}`, {
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
          const snapshotData: BrightDataSnapshotResponse = await response.json()
          console.log(`📊 Snapshot status: ${snapshotData.status} (${snapshotData.rows_collected || 0}/${snapshotData.total_rows || 0} rows)`)

          if (snapshotData.status === 'completed' && snapshotData.data) {
            console.log(`✅ Snapshot completed with ${snapshotData.data.length} results`)
            return snapshotData.data
          } else if (snapshotData.status === 'failed') {
            throw new Error(`Snapshot processing failed: ${snapshotData.error || 'Unknown error'}`)
          }
          // Status is 'running', continue polling
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
    const response = await fetch(`${this.config.baseUrl.replace('/trigger', '')}/snapshots/${snapshotId}`, {
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
      const response = await fetch(`${this.config.baseUrl}?dataset_id=${this.config.datasetId}&include_errors=true`, {
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