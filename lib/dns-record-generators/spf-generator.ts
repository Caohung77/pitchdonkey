import { SPFConfig, SPFRecord, DNSRecord } from '@/lib/types/domain-auth'

/**
 * SPF (Sender Policy Framework) Record Generator
 * Generates SPF records to authorize email servers to send emails on behalf of a domain
 */
export class SPFGenerator {
  /**
   * Generate SPF record based on configuration
   */
  static generateRecord(config: SPFConfig): { record: DNSRecord; parsed: SPFRecord } {
    const mechanisms: string[] = []
    
    // Add provider includes (Gmail, Outlook, etc.)
    config.includeProviders.forEach(provider => {
      mechanisms.push(`include:${provider}`)
    })
    
    // Add IP addresses
    config.ipAddresses.forEach(ip => {
      if (this.isIPv4(ip)) {
        mechanisms.push(`ip4:${ip}`)
      } else if (this.isIPv6(ip)) {
        mechanisms.push(`ip6:${ip}`)
      }
    })
    
    // Add the all mechanism with specified qualifier
    const qualifier = config.mechanism === 'hardfail' ? '-all' : '~all'
    mechanisms.push(qualifier)
    
    // Build the complete SPF record
    const spfValue = `v=spf1 ${mechanisms.join(' ')}`
    
    const record: DNSRecord = {
      type: 'TXT',
      name: config.domain,
      value: spfValue,
      ttl: 3600
    }
    
    const parsed: SPFRecord = {
      version: 'spf1',
      mechanisms: mechanisms.slice(0, -1), // All except the qualifier
      qualifier: config.mechanism === 'hardfail' ? 'fail' : 'softfail',
      raw: spfValue
    }
    
    return { record, parsed }
  }
  
  /**
   * Generate SPF record for common email providers
   */
  static generateForProviders(domain: string, providers: string[]): { record: DNSRecord; parsed: SPFRecord } {
    const providerIncludes: Record<string, string> = {
      'gmail': '_spf.google.com',
      'google': '_spf.google.com',
      'outlook': 'spf.protection.outlook.com',
      'microsoft': 'spf.protection.outlook.com',
      'office365': 'spf.protection.outlook.com',
      'sendgrid': 'sendgrid.net',
      'mailgun': 'mailgun.org',
      'mailchimp': 'servers.mcsv.net',
      'constantcontact': 'spf.constantcontact.com'
    }
    
    const includeProviders = providers
      .map(provider => providerIncludes[provider.toLowerCase()])
      .filter(Boolean)
    
    const config: SPFConfig = {
      domain,
      includeProviders,
      ipAddresses: [],
      mechanism: 'softfail'
    }
    
    return this.generateRecord(config)
  }
  
  /**
   * Generate SPF record for SMTP server
   */
  static generateForSMTP(domain: string, smtpHost: string, additionalIPs: string[] = []): { record: DNSRecord; parsed: SPFRecord } {
    const config: SPFConfig = {
      domain,
      includeProviders: [],
      ipAddresses: [smtpHost, ...additionalIPs],
      mechanism: 'softfail'
    }
    
    return this.generateRecord(config)
  }
  
  /**
   * Validate SPF record syntax
   */
  static validateRecord(spfRecord: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check if record starts with v=spf1
    if (!spfRecord.startsWith('v=spf1')) {
      errors.push('SPF record must start with "v=spf1"')
    }
    
    // Check for multiple SPF records (should be handled at DNS level)
    const mechanisms = spfRecord.split(' ').slice(1) // Remove v=spf1
    
    // Validate mechanisms
    let hasAllMechanism = false
    for (const mechanism of mechanisms) {
      if (mechanism.match(/^[~+-]?all$/)) {
        hasAllMechanism = true
        if (mechanism === '+all') {
          warnings.push('Using "+all" allows any server to send emails, which is not recommended')
        }
      } else if (mechanism.startsWith('include:')) {
        const domain = mechanism.substring(8)
        if (!this.isValidDomain(domain)) {
          errors.push(`Invalid domain in include mechanism: ${domain}`)
        }
      } else if (mechanism.startsWith('ip4:')) {
        const ip = mechanism.substring(4)
        if (!this.isIPv4(ip) && !this.isIPv4CIDR(ip)) {
          errors.push(`Invalid IPv4 address or CIDR: ${ip}`)
        }
      } else if (mechanism.startsWith('ip6:')) {
        const ip = mechanism.substring(4)
        if (!this.isIPv6(ip) && !this.isIPv6CIDR(ip)) {
          errors.push(`Invalid IPv6 address or CIDR: ${ip}`)
        }
      } else if (mechanism.startsWith('a:') || mechanism.startsWith('mx:')) {
        const domain = mechanism.substring(2)
        if (!this.isValidDomain(domain)) {
          errors.push(`Invalid domain in ${mechanism.substring(0, 2)} mechanism: ${domain}`)
        }
      }
    }
    
    if (!hasAllMechanism) {
      warnings.push('SPF record should end with an "all" mechanism (~all or -all)')
    }
    
    // Check record length (DNS TXT record limit is 255 characters per string)
    if (spfRecord.length > 255) {
      warnings.push('SPF record is longer than 255 characters, which may cause DNS issues')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Parse existing SPF record
   */
  static parseRecord(spfRecord: string): SPFRecord | null {
    if (!spfRecord.startsWith('v=spf1')) {
      return null
    }
    
    const parts = spfRecord.split(' ')
    const mechanisms: string[] = []
    let qualifier: 'pass' | 'fail' | 'softfail' | 'neutral' = 'neutral'
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      if (part.match(/^[~+-]?all$/)) {
        if (part === '-all') qualifier = 'fail'
        else if (part === '~all') qualifier = 'softfail'
        else if (part === '+all') qualifier = 'pass'
        else qualifier = 'neutral'
      } else {
        mechanisms.push(part)
      }
    }
    
    return {
      version: 'spf1',
      mechanisms,
      qualifier,
      raw: spfRecord
    }
  }
  
  /**
   * Get setup instructions for SPF
   */
  static getSetupInstructions(domain: string, record: DNSRecord): string {
    return `
To set up SPF for ${domain}:

1. Log in to your DNS provider (GoDaddy, Cloudflare, Namecheap, etc.)
2. Go to DNS management for ${domain}
3. Add a new TXT record:
   - Name/Host: @ (or leave blank for root domain)
   - Type: TXT
   - Value: ${record.value}
   - TTL: 3600 (or 1 hour)

What this does:
- SPF tells receiving email servers which servers are authorized to send emails from your domain
- This helps prevent email spoofing and improves deliverability
- The record authorizes your email providers and SMTP servers to send on your behalf

Note: You can only have ONE SPF record per domain. If you already have an SPF record, you need to modify it to include your new email servers, not create a second one.
    `.trim()
  }
  
  // Helper methods
  private static isIPv4(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipv4Regex.test(ip)
  }
  
  private static isIPv6(ip: string): boolean {
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    return ipv6Regex.test(ip)
  }
  
  private static isIPv4CIDR(cidr: string): boolean {
    const parts = cidr.split('/')
    if (parts.length !== 2) return false
    const [ip, mask] = parts
    const maskNum = parseInt(mask, 10)
    return this.isIPv4(ip) && maskNum >= 0 && maskNum <= 32
  }
  
  private static isIPv6CIDR(cidr: string): boolean {
    const parts = cidr.split('/')
    if (parts.length !== 2) return false
    const [ip, mask] = parts
    const maskNum = parseInt(mask, 10)
    return this.isIPv6(ip) && maskNum >= 0 && maskNum <= 128
  }
  
  private static isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return domainRegex.test(domain) && domain.length <= 253
  }
}