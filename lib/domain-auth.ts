import { createServerSupabaseClient } from '@/lib/supabase'
import { 
  DomainAuth, 
  DomainAuthOverview, 
  DNSProviderCredentials,
  DomainVerificationHistory,
  CreateDomainAuthRequest,
  UpdateDomainAuthRequest,
  DomainAuthError,
  DNSLookupError,
  ValidationError,
  VerificationResult,
  DomainVerificationStatus
} from '@/lib/types/domain-auth'
import { DomainVerificationEngine } from '@/lib/domain-verification-engine'
import { updateEmailAccountVerificationStatus } from '@/lib/domain-auth-integration'

/**
 * Domain Authentication Service
 * Handles CRUD operations for domain authentication records
 */
export class DomainAuthService {
  private supabase = createServerSupabaseClient()

  /**
   * Get all domain authentication records for a user
   */
  async getUserDomains(userId: string): Promise<DomainAuthOverview[]> {
    try {
      const { data, error } = await this.supabase
        .from('domain_auth_overview')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new DomainAuthError(`Failed to fetch user domains: ${error.message}`, 'FETCH_ERROR')
      }

      return data || []
    } catch (error) {
      console.error('Error fetching user domains:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to fetch domains', 'UNKNOWN_ERROR')
    }
  }

  /**
   * Get a specific domain authentication record
   */
  async getDomain(userId: string, domain: string): Promise<DomainAuth | null> {
    try {
      const { data, error } = await this.supabase
        .from('domain_auth')
        .select('*')
        .eq('user_id', userId)
        .eq('domain', domain)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // No record found
        }
        throw new DomainAuthError(`Failed to fetch domain: ${error.message}`, 'FETCH_ERROR', domain)
      }

      return data
    } catch (error) {
      console.error('Error fetching domain:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to fetch domain', 'UNKNOWN_ERROR', domain)
    }
  }

  /**
   * Create a new domain authentication record
   */
  async createDomain(userId: string, request: CreateDomainAuthRequest): Promise<DomainAuth> {
    try {
      const domainData = {
        user_id: userId,
        domain: request.domain.toLowerCase(),
        dns_provider: request.dns_provider || 'manual',
        auto_configured: request.auto_configure || false,
      }

      const { data, error } = await this.supabase
        .from('domain_auth')
        .insert(domainData)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new DomainAuthError('Domain already exists for this user', 'DUPLICATE_DOMAIN', request.domain)
        }
        throw new DomainAuthError(`Failed to create domain: ${error.message}`, 'CREATE_ERROR', request.domain)
      }

      return data
    } catch (error) {
      console.error('Error creating domain:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to create domain', 'UNKNOWN_ERROR', request.domain)
    }
  }

  /**
   * Update a domain authentication record
   */
  async updateDomain(userId: string, domain: string, request: UpdateDomainAuthRequest): Promise<DomainAuth> {
    try {
      const updateData = {
        ...request,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await this.supabase
        .from('domain_auth')
        .update(updateData)
        .eq('user_id', userId)
        .eq('domain', domain)
        .select()
        .single()

      if (error) {
        throw new DomainAuthError(`Failed to update domain: ${error.message}`, 'UPDATE_ERROR', domain)
      }

      return data
    } catch (error) {
      console.error('Error updating domain:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to update domain', 'UNKNOWN_ERROR', domain)
    }
  }

  /**
   * Delete a domain authentication record
   */
  async deleteDomain(userId: string, domain: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('domain_auth')
        .delete()
        .eq('user_id', userId)
        .eq('domain', domain)

      if (error) {
        throw new DomainAuthError(`Failed to delete domain: ${error.message}`, 'DELETE_ERROR', domain)
      }
    } catch (error) {
      console.error('Error deleting domain:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to delete domain', 'UNKNOWN_ERROR', domain)
    }
  }

  /**
   * Update verification status for a domain
   */
  async updateVerificationStatus(
    userId: string, 
    domain: string, 
    type: 'spf' | 'dkim' | 'dmarc', 
    verified: boolean, 
    record?: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        [`${type}_verified`]: verified,
        [`${type}_last_checked`]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (record) {
        // Use correct column names based on database schema
        if (type === 'dkim') {
          updateData['dkim_public_key'] = record  // DKIM stores raw record in dkim_public_key field
        } else {
          updateData[`${type}_record`] = record   // SPF and DMARC use _record suffix
        }
      }

      if (errorMessage) {
        updateData[`${type}_error_message`] = errorMessage
      } else {
        updateData[`${type}_error_message`] = null
      }

      const { error } = await this.supabase
        .from('domain_auth')
        .update(updateData)
        .eq('user_id', userId)
        .eq('domain', domain)

      if (error) {
        throw new DomainAuthError(`Failed to update verification status: ${error.message}`, 'UPDATE_ERROR', domain, type)
      }
    } catch (error) {
      console.error('Error updating verification status:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to update verification status', 'UNKNOWN_ERROR', domain, type)
    }
  }

  /**
   * Add verification history record
   */
  async addVerificationHistory(
    domainAuthId: string,
    type: 'spf' | 'dkim' | 'dmarc',
    status: boolean,
    errorMessage?: string,
    dnsResponse?: string,
    responseTimeMs?: number
  ): Promise<void> {
    try {
      const historyData = {
        domain_auth_id: domainAuthId,
        verification_type: type,
        status,
        error_message: errorMessage,
        dns_response: dnsResponse,
        response_time_ms: responseTimeMs,
      }

      const { error } = await this.supabase
        .from('domain_verification_history')
        .insert(historyData)

      if (error) {
        throw new DomainAuthError(`Failed to add verification history: ${error.message}`, 'HISTORY_ERROR')
      }
    } catch (error) {
      console.error('Error adding verification history:', error)
      // Don't throw here as this is not critical for the main operation
    }
  }

  /**
   * Get verification history for a domain
   */
  async getVerificationHistory(userId: string, domain: string, limit = 50): Promise<DomainVerificationHistory[]> {
    try {
      const { data, error } = await this.supabase
        .from('domain_verification_history')
        .select(`
          *,
          domain_auth!inner(user_id, domain)
        `)
        .eq('domain_auth.user_id', userId)
        .eq('domain_auth.domain', domain)
        .order('checked_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new DomainAuthError(`Failed to fetch verification history: ${error.message}`, 'FETCH_ERROR', domain)
      }

      return data || []
    } catch (error) {
      console.error('Error fetching verification history:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to fetch verification history', 'UNKNOWN_ERROR', domain)
    }
  }

  /**
   * Get domains that need verification (haven't been checked recently)
   */
  async getDomainsNeedingVerification(userId: string, hoursThreshold = 24): Promise<DomainAuth[]> {
    try {
      const thresholdDate = new Date()
      thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold)

      const { data, error } = await this.supabase
        .from('domain_auth')
        .select('*')
        .eq('user_id', userId)
        .or(`spf_last_checked.is.null,spf_last_checked.lt.${thresholdDate.toISOString()},dkim_last_checked.is.null,dkim_last_checked.lt.${thresholdDate.toISOString()},dmarc_last_checked.is.null,dmarc_last_checked.lt.${thresholdDate.toISOString()}`)

      if (error) {
        throw new DomainAuthError(`Failed to fetch domains needing verification: ${error.message}`, 'FETCH_ERROR')
      }

      return data || []
    } catch (error) {
      console.error('Error fetching domains needing verification:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to fetch domains needing verification', 'UNKNOWN_ERROR')
    }
  }

  /**
   * Get dashboard statistics for a user
   */
  async getDashboardStats(userId: string) {
    try {
      const domains = await this.getUserDomains(userId)
      
      const stats = {
        totalDomains: domains.length,
        fullyVerified: domains.filter(d => d.fully_verified).length,
        partiallyVerified: domains.filter(d => !d.fully_verified && (d.spf_verified || d.dkim_verified || d.dmarc_verified)).length,
        unverified: domains.filter(d => !d.spf_verified && !d.dkim_verified && !d.dmarc_verified).length,
      }

      const overallHealth = this.calculateOverallHealth(domains)

      return {
        domains,
        stats,
        overallHealth,
      }
    } catch (error) {
      console.error('Error getting dashboard stats:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to get dashboard stats', 'UNKNOWN_ERROR')
    }
  }

  /**
   * Verify domain authentication records and update database
   */
  async verifyDomain(userId: string, domain: string, dkimSelector?: string): Promise<DomainVerificationStatus> {
    try {
      // Get the domain record to ensure it exists
      const domainRecord = await this.getDomain(userId, domain)
      if (!domainRecord) {
        throw new DomainAuthError('Domain not found', 'NOT_FOUND', domain)
      }

      // Use the stored DKIM selector if not provided
      const selector = dkimSelector || domainRecord.dkim_selector || 'coldreach2024'

      // Perform verification
      const verificationStatus = await DomainVerificationEngine.verifyAll(domain, selector)

      // Update database with results
      await this.updateVerificationResults(userId, domain, verificationStatus, domainRecord.id)

      // Update email account verification status
      await updateEmailAccountVerificationStatus(userId, domain)

      return verificationStatus
    } catch (error) {
      console.error('Error verifying domain:', error)
      throw error instanceof DomainAuthError ? error : new DomainAuthError('Failed to verify domain', 'VERIFICATION_ERROR', domain)
    }
  }

  /**
   * Update database with verification results
   */
  private async updateVerificationResults(
    userId: string,
    domain: string,
    status: DomainVerificationStatus,
    domainAuthId: string
  ): Promise<void> {
    try {
      // Update SPF status
      if (status.spf) {
        await this.updateVerificationStatus(
          userId,
          domain,
          'spf',
          status.spf.success,
          status.spf.record?.raw,
          status.spf.success ? undefined : status.spf.validation.errors.join('; ')
        )

        // Add to history
        await this.addVerificationHistory(
          domainAuthId,
          'spf',
          status.spf.success,
          status.spf.success ? undefined : status.spf.validation.errors.join('; '),
          JSON.stringify(status.spf.record),
          status.spf.responseTime
        )
      }

      // Update DKIM status
      if (status.dkim) {
        await this.updateVerificationStatus(
          userId,
          domain,
          'dkim',
          status.dkim.success,
          status.dkim.record?.raw,
          status.dkim.success ? undefined : status.dkim.validation.errors.join('; ')
        )

        // Add to history
        await this.addVerificationHistory(
          domainAuthId,
          'dkim',
          status.dkim.success,
          status.dkim.success ? undefined : status.dkim.validation.errors.join('; '),
          JSON.stringify(status.dkim.record),
          status.dkim.responseTime
        )
      }

      // Update DMARC status
      if (status.dmarc) {
        await this.updateVerificationStatus(
          userId,
          domain,
          'dmarc',
          status.dmarc.success,
          status.dmarc.record?.raw,
          status.dmarc.success ? undefined : status.dmarc.validation.errors.join('; ')
        )

        // Add to history
        await this.addVerificationHistory(
          domainAuthId,
          'dmarc',
          status.dmarc.success,
          status.dmarc.success ? undefined : status.dmarc.validation.errors.join('; '),
          JSON.stringify(status.dmarc.record),
          status.dmarc.responseTime
        )
      }
    } catch (error) {
      console.error('Error updating verification results:', error)
      // Don't throw here as the verification itself succeeded
    }
  }

  /**
   * Verify multiple domains in batch
   */
  async verifyMultipleDomains(userId: string, domains: string[]): Promise<DomainVerificationStatus[]> {
    const results: DomainVerificationStatus[] = []

    // Process domains in parallel but limit concurrency
    const batchSize = 3
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(domain => this.verifyDomain(userId, domain))
      )

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          // Create error result for failed verification
          results.push({
            domain: batch[index],
            spf: null,
            dkim: null,
            dmarc: null,
            overallStatus: 'error',
            lastChecked: new Date().toISOString()
          })
        }
      })
    }

    return results
  }

  /**
   * Calculate overall health status based on domain verification states
   */
  private calculateOverallHealth(domains: DomainAuthOverview[]): 'excellent' | 'good' | 'needs-attention' | 'critical' {
    if (domains.length === 0) return 'critical'

    const fullyVerifiedCount = domains.filter(d => d.fully_verified).length
    const partiallyVerifiedCount = domains.filter(d => !d.fully_verified && (d.spf_verified || d.dkim_verified || d.dmarc_verified)).length
    const unverifiedCount = domains.filter(d => !d.spf_verified && !d.dkim_verified && !d.dmarc_verified).length

    const fullyVerifiedRatio = fullyVerifiedCount / domains.length
    const partiallyVerifiedRatio = partiallyVerifiedCount / domains.length
    const unverifiedRatio = unverifiedCount / domains.length

    if (fullyVerifiedRatio >= 0.8) return 'excellent'
    if (fullyVerifiedRatio >= 0.5 || (fullyVerifiedRatio + partiallyVerifiedRatio) >= 0.8) return 'good'
    if (unverifiedRatio < 0.5) return 'needs-attention'
    return 'critical'
  }
}

/**
 * Utility function to extract domain from email address
 */
export function extractDomainFromEmail(email: string): string {
  const parts = email.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new DomainAuthError('Invalid email address format', 'INVALID_EMAIL')
  }
  return parts[1].toLowerCase()
}

/**
 * Utility function to validate domain format
 */
export function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return domainRegex.test(domain) && domain.length <= 253
}

/**
 * Utility function to normalize domain (lowercase, remove trailing dot)
 */
export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/\.$/, '')
}