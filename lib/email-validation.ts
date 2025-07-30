interface EmailValidationResult {
  email: string
  isValid: boolean
  status: 'valid' | 'invalid' | 'risky' | 'unknown'
  reason?: string
  suggestions?: string[]
  deliverable?: boolean
  disposable?: boolean
  role?: boolean
  free?: boolean
  mx_found?: boolean
  smtp_check?: boolean
}

interface BulkEmailValidationResult {
  results: EmailValidationResult[]
  summary: {
    total: number
    valid: number
    invalid: number
    risky: number
    unknown: number
  }
}

export class EmailValidationService {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  private static readonly DISPOSABLE_DOMAINS = new Set([
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'yopmail.com',
    'temp-mail.org',
    'throwaway.email',
    'maildrop.cc',
    'sharklasers.com',
    'guerrillamailblock.com'
  ])

  private static readonly FREE_PROVIDERS = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'protonmail.com',
    'mail.com'
  ])

  private static readonly ROLE_PREFIXES = new Set([
    'admin',
    'administrator',
    'info',
    'support',
    'help',
    'sales',
    'marketing',
    'contact',
    'service',
    'team',
    'office',
    'hello',
    'mail',
    'email',
    'webmaster',
    'postmaster',
    'noreply',
    'no-reply'
  ])

  /**
   * Validate a single email address
   */
  static async validateEmail(email: string): Promise<EmailValidationResult> {
    const normalizedEmail = email.toLowerCase().trim()
    
    // Basic format validation
    if (!this.EMAIL_REGEX.test(normalizedEmail)) {
      return {
        email: normalizedEmail,
        isValid: false,
        status: 'invalid',
        reason: 'Invalid email format',
        deliverable: false
      }
    }

    const [localPart, domain] = normalizedEmail.split('@')
    
    // Check for disposable email
    const isDisposable = this.DISPOSABLE_DOMAINS.has(domain)
    if (isDisposable) {
      return {
        email: normalizedEmail,
        isValid: false,
        status: 'invalid',
        reason: 'Disposable email address',
        disposable: true,
        deliverable: false
      }
    }

    // Check for role-based email
    const isRole = this.ROLE_PREFIXES.has(localPart) || 
                   this.ROLE_PREFIXES.has(localPart.split('.')[0]) ||
                   this.ROLE_PREFIXES.has(localPart.split('+')[0])

    // Check if it's a free provider
    const isFree = this.FREE_PROVIDERS.has(domain)

    // Perform DNS MX record check
    const mxFound = await this.checkMXRecord(domain)
    
    // Determine status based on checks
    let status: 'valid' | 'invalid' | 'risky' | 'unknown' = 'valid'
    let reason = ''
    const suggestions: string[] = []

    if (!mxFound) {
      status = 'invalid'
      reason = 'Domain has no MX record'
    } else if (isRole) {
      status = 'risky'
      reason = 'Role-based email address'
      suggestions.push('Consider finding a personal email address')
    } else if (isFree && localPart.length < 3) {
      status = 'risky'
      reason = 'Short username on free provider'
    }

    return {
      email: normalizedEmail,
      isValid: status === 'valid' || status === 'risky',
      status,
      reason: reason || undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      deliverable: status === 'valid' || status === 'risky',
      disposable: isDisposable,
      role: isRole,
      free: isFree,
      mx_found: mxFound,
      smtp_check: false // Would require actual SMTP connection
    }
  }

  /**
   * Validate multiple email addresses
   */
  static async validateEmails(emails: string[]): Promise<BulkEmailValidationResult> {
    const results: EmailValidationResult[] = []
    const summary = {
      total: emails.length,
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0
    }

    // Process emails in batches to avoid overwhelming DNS
    const batchSize = 10
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(email => this.validateEmail(email))
      )
      
      results.push(...batchResults)
      
      // Update summary
      batchResults.forEach(result => {
        summary[result.status]++
      })

      // Small delay between batches to be respectful to DNS servers
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return { results, summary }
  }

  /**
   * Check if domain has MX record
   */
  private static async checkMXRecord(domain: string): Promise<boolean> {
    try {
      const dns = await import('dns/promises')
      const mxRecords = await dns.resolveMx(domain)
      return mxRecords && mxRecords.length > 0
    } catch (error) {
      // If DNS lookup fails, we'll assume it's invalid
      return false
    }
  }

  /**
   * Suggest corrections for common email typos
   */
  static suggestCorrections(email: string): string[] {
    const suggestions: string[] = []
    const [localPart, domain] = email.toLowerCase().split('@')
    
    if (!domain) return suggestions

    // Common domain typos
    const domainCorrections: Record<string, string> = {
      'gmai.com': 'gmail.com',
      'gmial.com': 'gmail.com',
      'gmail.co': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'hotmial.com': 'hotmail.com',
      'hotmai.com': 'hotmail.com',
      'outlok.com': 'outlook.com',
      'outloo.com': 'outlook.com'
    }

    if (domainCorrections[domain]) {
      suggestions.push(`${localPart}@${domainCorrections[domain]}`)
    }

    // Check for missing TLD
    if (!domain.includes('.')) {
      suggestions.push(`${localPart}@${domain}.com`)
    }

    return suggestions
  }

  /**
   * Clean and normalize email address
   */
  static normalizeEmail(email: string): string {
    let normalized = email.toLowerCase().trim()
    
    // Remove dots from Gmail addresses (they're ignored)
    const [localPart, domain] = normalized.split('@')
    if (domain === 'gmail.com') {
      const cleanLocal = localPart.replace(/\./g, '').split('+')[0]
      normalized = `${cleanLocal}@${domain}`
    }
    
    return normalized
  }

  /**
   * Check if email is likely to be a catch-all
   */
  static async isCatchAll(domain: string): Promise<boolean> {
    try {
      // This would require actual SMTP testing
      // For now, we'll return false as a placeholder
      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Get email provider information
   */
  static getEmailProvider(email: string): {
    provider: string
    type: 'free' | 'business' | 'education' | 'government' | 'unknown'
    country?: string
  } {
    const domain = email.split('@')[1]?.toLowerCase()
    
    if (!domain) {
      return { provider: 'unknown', type: 'unknown' }
    }

    // Free providers
    if (this.FREE_PROVIDERS.has(domain)) {
      return { provider: domain, type: 'free' }
    }

    // Education domains
    if (domain.endsWith('.edu') || domain.endsWith('.ac.uk') || domain.endsWith('.edu.au')) {
      return { provider: domain, type: 'education' }
    }

    // Government domains
    if (domain.endsWith('.gov') || domain.endsWith('.gov.uk') || domain.endsWith('.gc.ca')) {
      return { provider: domain, type: 'government' }
    }

    // Business domains (everything else)
    return { provider: domain, type: 'business' }
  }
}