interface EmailValidationResult {
  email: string
  status: 'valid' | 'invalid' | 'risky' | 'unknown'
  isValid: boolean
  reason?: string
}

interface BulkEmailValidationResult {
  results: EmailValidationResult[]
  summary: {
    total: number
    valid: number
    invalid: number
    risky: number
  }
}

export class EmailValidationService {
  /**
   * Basic email validation using regex
   */
  static async validateEmail(email: string): Promise<EmailValidationResult> {
    const normalizedEmail = this.normalizeEmail(email)
    
    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return {
        email: normalizedEmail,
        status: 'invalid',
        isValid: false,
        reason: 'Invalid email format'
      }
    }

    // Check for common disposable email domains
    const disposableDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'yopmail.com'
    ]

    const domain = normalizedEmail.split('@')[1].toLowerCase()
    if (disposableDomains.includes(domain)) {
      return {
        email: normalizedEmail,
        status: 'risky',
        isValid: true,
        reason: 'Disposable email domain'
      }
    }

    // For now, consider all other emails as valid
    // In a real implementation, you would integrate with an email validation service
    return {
      email: normalizedEmail,
      status: 'valid',
      isValid: true
    }
  }

  /**
   * Validate multiple emails in bulk
   */
  static async validateEmails(emails: string[]): Promise<BulkEmailValidationResult> {
    const results: EmailValidationResult[] = []
    const summary = {
      total: emails.length,
      valid: 0,
      invalid: 0,
      risky: 0
    }

    for (const email of emails) {
      const result = await this.validateEmail(email)
      results.push(result)

      switch (result.status) {
        case 'valid':
          summary.valid++
          break
        case 'invalid':
          summary.invalid++
          break
        case 'risky':
          summary.risky++
          break
      }
    }

    return { results, summary }
  }

  /**
   * Normalize email address (lowercase, trim)
   */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  /**
   * Check if email domain exists (basic check)
   */
  static async checkDomainExists(email: string): Promise<boolean> {
    try {
      const domain = email.split('@')[1]
      // In a real implementation, you would do a DNS lookup
      // For now, just check if it has a valid format
      return domain && domain.includes('.')
    } catch {
      return false
    }
  }
}