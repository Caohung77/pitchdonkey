import { promises as dns } from 'dns'
import { SPFRecord, DKIMRecord, DMARCRecord, DNSLookupError } from '@/lib/types/domain-auth'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'

/**
 * DNS Lookup Service
 * Handles DNS TXT record lookups for SPF, DKIM, and DMARC verification
 */
export class DNSLookupService {
  private static readonly DEFAULT_TIMEOUT = 10000 // 10 seconds
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAY = 1000 // 1 second

  /**
   * Lookup SPF record for a domain
   */
  static async lookupSPF(domain: string): Promise<{ record: SPFRecord | null; responseTime: number; rawResponse: string[] }> {
    const startTime = Date.now()
    
    try {
      const txtRecords = await this.lookupTXTWithRetry(domain)
      const responseTime = Date.now() - startTime
      
      // Find SPF record (should start with v=spf1)
      const spfRecord = txtRecords.find(record => 
        record.startsWith('v=spf1')
      )
      
      if (!spfRecord) {
        return {
          record: null,
          responseTime,
          rawResponse: txtRecords
        }
      }
      
      const parsed = SPFGenerator.parseRecord(spfRecord)
      
      return {
        record: parsed,
        responseTime,
        rawResponse: txtRecords
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      throw new DNSLookupError(
        `Failed to lookup SPF record for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        domain,
        'spf'
      )
    }
  }

  /**
   * Lookup DKIM record for a domain and selector
   */
  static async lookupDKIM(domain: string, selector: string): Promise<{ record: DKIMRecord | null; responseTime: number; rawResponse: string[] }> {
    const startTime = Date.now()
    const dkimDomain = `${selector}._domainkey.${domain}`
    
    try {
      const txtRecords = await this.lookupTXTWithRetry(dkimDomain)
      const responseTime = Date.now() - startTime
      
      // Find DKIM record (should contain v=DKIM1)
      const dkimRecord = txtRecords.find(record => 
        record.includes('v=DKIM1')
      )
      
      if (!dkimRecord) {
        return {
          record: null,
          responseTime,
          rawResponse: txtRecords
        }
      }
      
      const parsed = DKIMGenerator.parseRecord(dkimRecord, selector)
      
      return {
        record: parsed,
        responseTime,
        rawResponse: txtRecords
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      throw new DNSLookupError(
        `Failed to lookup DKIM record for ${dkimDomain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        domain,
        'dkim'
      )
    }
  }

  /**
   * Lookup DMARC record for a domain
   */
  static async lookupDMARC(domain: string): Promise<{ record: DMARCRecord | null; responseTime: number; rawResponse: string[] }> {
    const startTime = Date.now()
    const dmarcDomain = `_dmarc.${domain}`
    
    try {
      const txtRecords = await this.lookupTXTWithRetry(dmarcDomain)
      const responseTime = Date.now() - startTime
      
      // Find DMARC record (should start with v=DMARC1)
      const dmarcRecord = txtRecords.find(record => 
        record.startsWith('v=DMARC1')
      )
      
      if (!dmarcRecord) {
        return {
          record: null,
          responseTime,
          rawResponse: txtRecords
        }
      }
      
      const parsed = DMARCGenerator.parseRecord(dmarcRecord)
      
      return {
        record: parsed,
        responseTime,
        rawResponse: txtRecords
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      throw new DNSLookupError(
        `Failed to lookup DMARC record for ${dmarcDomain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        domain,
        'dmarc'
      )
    }
  }

  /**
   * Lookup all authentication records for a domain
   */
  static async lookupAll(domain: string, dkimSelector?: string): Promise<{
    spf: { record: SPFRecord | null; responseTime: number; rawResponse: string[] }
    dkim: { record: DKIMRecord | null; responseTime: number; rawResponse: string[] } | null
    dmarc: { record: DMARCRecord | null; responseTime: number; rawResponse: string[] }
  }> {
    const results = await Promise.allSettled([
      this.lookupSPF(domain),
      dkimSelector ? this.lookupDKIM(domain, dkimSelector) : null,
      this.lookupDMARC(domain)
    ])

    return {
      spf: results[0].status === 'fulfilled' ? results[0].value : { record: null, responseTime: 0, rawResponse: [] },
      dkim: results[1] && results[1].status === 'fulfilled' ? results[1].value : null,
      dmarc: results[2].status === 'fulfilled' ? results[2].value : { record: null, responseTime: 0, rawResponse: [] }
    }
  }

  /**
   * Check if a domain exists (has any DNS records)
   */
  static async checkDomainExists(domain: string): Promise<boolean> {
    try {
      // Try to resolve A record first (most common)
      await dns.resolve4(domain)
      return true
    } catch {
      try {
        // Try AAAA record (IPv6)
        await dns.resolve6(domain)
        return true
      } catch {
        try {
          // Try MX record (email)
          await dns.resolveMx(domain)
          return true
        } catch {
          try {
            // Try any TXT record
            await dns.resolveTxt(domain)
            return true
          } catch {
            return false
          }
        }
      }
    }
  }

  /**
   * Get nameservers for a domain
   */
  static async getNameservers(domain: string): Promise<string[]> {
    try {
      return await dns.resolveNs(domain)
    } catch (error) {
      throw new DNSLookupError(
        `Failed to get nameservers for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        domain,
        'spf' // Default type
      )
    }
  }

  /**
   * Lookup TXT records with retry logic
   */
  private static async lookupTXTWithRetry(domain: string, retries = this.MAX_RETRIES): Promise<string[]> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const records = await Promise.race([
          dns.resolveTxt(domain),
          this.timeoutPromise(this.DEFAULT_TIMEOUT)
        ])
        
        // Flatten the TXT records (each record can be an array of strings)
        return records.flat()
      } catch (error) {
        if (attempt === retries) {
          throw error
        }
        
        // Wait before retrying
        await this.delay(this.RETRY_DELAY * attempt)
      }
    }
    
    throw new Error('Max retries exceeded')
  }

  /**
   * Create a timeout promise
   */
  private static timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DNS lookup timeout')), ms)
    })
  }

  /**
   * Delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Validate domain format before lookup
   */
  static validateDomainFormat(domain: string): { isValid: boolean; error?: string } {
    if (!domain || typeof domain !== 'string') {
      return { isValid: false, error: 'Domain is required and must be a string' }
    }

    // Remove trailing dot if present
    const normalizedDomain = domain.replace(/\.$/, '')

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    
    if (!domainRegex.test(normalizedDomain)) {
      return { isValid: false, error: 'Invalid domain format' }
    }

    if (normalizedDomain.length > 253) {
      return { isValid: false, error: 'Domain name too long (max 253 characters)' }
    }

    // Check for valid TLD (at least 2 characters)
    const parts = normalizedDomain.split('.')
    if (parts.length < 2 || parts[parts.length - 1].length < 2) {
      return { isValid: false, error: 'Domain must have a valid top-level domain' }
    }

    return { isValid: true }
  }

  /**
   * Get common DNS errors with user-friendly messages
   */
  static getDNSErrorMessage(error: any): string {
    if (!error) return 'Unknown DNS error'

    const errorCode = error.code || error.errno
    const errorMessage = error.message || ''

    switch (errorCode) {
      case 'ENOTFOUND':
        return 'Domain not found. Please check the domain name is correct.'
      
      case 'ENODATA':
        return 'No DNS records found for this domain.'
      
      case 'ETIMEOUT':
        return 'DNS lookup timed out. Please try again later.'
      
      case 'ECONNREFUSED':
        return 'DNS server connection refused. Please try again later.'
      
      case 'ESERVFAIL':
        return 'DNS server failure. The domain\'s DNS server may be down.'
      
      case 'ENXDOMAIN':
        return 'Domain does not exist.'
      
      default:
        if (errorMessage.includes('timeout')) {
          return 'DNS lookup timed out. Please try again later.'
        }
        if (errorMessage.includes('not found')) {
          return 'DNS record not found.'
        }
        return `DNS error: ${errorMessage}`
    }
  }

  /**
   * Test DNS connectivity
   */
  static async testConnectivity(): Promise<{ isWorking: boolean; error?: string; responseTime: number }> {
    const startTime = Date.now()
    
    try {
      // Test with a reliable domain
      await dns.resolve4('google.com')
      const responseTime = Date.now() - startTime
      
      return {
        isWorking: true,
        responseTime
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      
      return {
        isWorking: false,
        error: this.getDNSErrorMessage(error),
        responseTime
      }
    }
  }
}