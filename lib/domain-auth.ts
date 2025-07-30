import dns from 'dns/promises'

export interface DomainAuthRecord {
  type: 'SPF' | 'DKIM' | 'DMARC'
  status: 'valid' | 'warning' | 'missing' | 'unknown'
  record: string | null
  issues: string[]
  recommendations: string[]
}

export interface DomainAuthResult {
  domain: string
  spf: DomainAuthRecord
  dkim: DomainAuthRecord
  dmarc: DomainAuthRecord
  overall_score: number
  overall_status: 'excellent' | 'good' | 'warning' | 'critical'
  recommendations: string[]
  last_checked: string
}

export class DomainAuthService {
  private static readonly DKIM_SELECTORS = [
    'default',
    'google',
    'gmail',
    'outlook',
    'mail',
    'dkim',
    'selector1',
    'selector2',
    'k1',
    'k2',
    's1',
    's2'
  ]

  /**
   * Check domain authentication records (SPF, DKIM, DMARC)
   */
  static async checkDomainAuthentication(domain: string): Promise<DomainAuthResult> {
    const cleanDomain = this.cleanDomain(domain)
    const timestamp = new Date().toISOString()

    try {
      const [spfResult, dkimResult, dmarcResult] = await Promise.all([
        this.checkSPF(cleanDomain),
        this.checkDKIM(cleanDomain),
        this.checkDMARC(cleanDomain)
      ])

      const overallScore = this.calculateOverallScore(spfResult, dkimResult, dmarcResult)
      const overallStatus = this.getOverallStatus(overallScore)
      const recommendations = this.generateRecommendations(spfResult, dkimResult, dmarcResult, overallStatus)

      return {
        domain: cleanDomain,
        spf: spfResult,
        dkim: dkimResult,
        dmarc: dmarcResult,
        overall_score: overallScore,
        overall_status: overallStatus,
        recommendations,
        last_checked: timestamp
      }
    } catch (error) {
      // If there's a general error, return unknown status for all records
      return {
        domain: cleanDomain,
        spf: this.createUnknownRecord('SPF'),
        dkim: this.createUnknownRecord('DKIM'),
        dmarc: this.createUnknownRecord('DMARC'),
        overall_score: 0,
        overall_status: 'critical',
        recommendations: ['🔴 Critical: Unable to check domain authentication due to DNS issues'],
        last_checked: timestamp
      }
    }
  }

  /**
   * Clean domain input by removing protocol, www, and paths
   */
  private static cleanDomain(input: string): string {
    let domain = input.toLowerCase()
    
    // Remove protocol
    domain = domain.replace(/^https?:\/\//, '')
    
    // Remove www
    domain = domain.replace(/^www\./, '')
    
    // Remove path and query parameters
    domain = domain.split('/')[0].split('?')[0]
    
    return domain
  }

  /**
   * Check SPF record
   */
  private static async checkSPF(domain: string): Promise<DomainAuthRecord> {
    try {
      const txtRecords = await dns.resolveTxt(domain)
      const spfRecords = txtRecords
        .flat()
        .filter(record => record.startsWith('v=spf1'))

      if (spfRecords.length === 0) {
        return {
          type: 'SPF',
          status: 'missing',
          record: null,
          issues: ['No SPF record found'],
          recommendations: ['Add an SPF record to prevent email spoofing']
        }
      }

      if (spfRecords.length > 1) {
        return {
          type: 'SPF',
          status: 'warning',
          record: spfRecords[0],
          issues: ['Multiple SPF records found'],
          recommendations: ['Consolidate into a single SPF record']
        }
      }

      const spfRecord = spfRecords[0]
      const issues = this.analyzeSPFRecord(spfRecord)
      const status = issues.length > 0 ? 'warning' : 'valid'

      return {
        type: 'SPF',
        status,
        record: spfRecord,
        issues,
        recommendations: issues.length > 0 ? ['Review and fix SPF record issues'] : []
      }
    } catch (error) {
      return this.createUnknownRecord('SPF')
    }
  }

  /**
   * Analyze SPF record for common issues
   */
  private static analyzeSPFRecord(record: string): string[] {
    const issues: string[] = []

    // Check for too many DNS lookups (includes and redirects)
    const includeCount = (record.match(/include:/g) || []).length
    const redirectCount = (record.match(/redirect=/g) || []).length
    const totalLookups = includeCount + redirectCount

    if (totalLookups > 10) {
      issues.push('Too many DNS lookups (limit is 10)')
    }

    // Check for proper termination
    if (!record.includes('-all') && !record.includes('~all') && !record.includes('+all') && !record.includes('?all')) {
      issues.push('SPF record missing proper termination mechanism')
    }

    // Check for dangerous +all
    if (record.includes('+all')) {
      issues.push('SPF record uses +all which allows all senders')
    }

    // Check for syntax issues
    if (!record.startsWith('v=spf1 ')) {
      issues.push('SPF record has invalid syntax')
    }

    return issues
  }

  /**
   * Check DKIM records
   */
  private static async checkDKIM(domain: string): Promise<DomainAuthRecord> {
    try {
      let foundRecord: string | null = null
      let foundSelector: string | null = null

      // Try common DKIM selectors
      for (const selector of this.DKIM_SELECTORS) {
        try {
          const dkimDomain = `${selector}._domainkey.${domain}`
          const txtRecords = await dns.resolveTxt(dkimDomain)
          const dkimRecords = txtRecords
            .flat()
            .filter(record => record.startsWith('v=DKIM1'))

          if (dkimRecords.length > 0) {
            foundRecord = dkimRecords[0]
            foundSelector = selector
            break
          }
        } catch (error) {
          // Continue to next selector
          continue
        }
      }

      if (!foundRecord) {
        return {
          type: 'DKIM',
          status: 'missing',
          record: null,
          issues: ['No DKIM records found for common selectors'],
          recommendations: ['Set up DKIM signing with your email provider']
        }
      }

      const issues = this.analyzeDKIMRecord(foundRecord)
      const status = issues.length > 0 ? 'warning' : 'valid'

      return {
        type: 'DKIM',
        status,
        record: foundRecord,
        issues,
        recommendations: issues.length > 0 ? ['Review and fix DKIM record issues'] : []
      }
    } catch (error) {
      return this.createUnknownRecord('DKIM')
    }
  }

  /**
   * Analyze DKIM record for common issues
   */
  private static analyzeDKIMRecord(record: string): string[] {
    const issues: string[] = []

    // Check for empty public key
    const publicKeyMatch = record.match(/p=([^;]*)/)
    if (!publicKeyMatch || !publicKeyMatch[1] || publicKeyMatch[1].trim() === '') {
      issues.push('DKIM public key is empty')
    }

    // Check for deprecated SHA-1
    if (record.includes('h=sha1')) {
      issues.push('DKIM uses SHA-1 which is deprecated')
    }

    // Check for valid syntax
    if (!record.startsWith('v=DKIM1')) {
      issues.push('DKIM record has invalid syntax')
    }

    return issues
  }

  /**
   * Check DMARC record
   */
  private static async checkDMARC(domain: string): Promise<DomainAuthRecord> {
    try {
      const dmarcDomain = `_dmarc.${domain}`
      const txtRecords = await dns.resolveTxt(dmarcDomain)
      const dmarcRecords = txtRecords
        .flat()
        .filter(record => record.startsWith('v=DMARC1'))

      if (dmarcRecords.length === 0) {
        return {
          type: 'DMARC',
          status: 'missing',
          record: null,
          issues: ['No DMARC record found'],
          recommendations: ['Add a DMARC record to protect against email spoofing']
        }
      }

      if (dmarcRecords.length > 1) {
        return {
          type: 'DMARC',
          status: 'warning',
          record: dmarcRecords[0],
          issues: ['Multiple DMARC records found'],
          recommendations: ['Use only one DMARC record']
        }
      }

      const dmarcRecord = dmarcRecords[0]
      const issues = this.analyzeDMARCRecord(dmarcRecord)
      const status = issues.length > 0 ? 'warning' : 'valid'

      return {
        type: 'DMARC',
        status,
        record: dmarcRecord,
        issues,
        recommendations: issues.length > 0 ? ['Review and fix DMARC record issues'] : []
      }
    } catch (error) {
      return this.createUnknownRecord('DMARC')
    }
  }

  /**
   * Analyze DMARC record for common issues
   */
  private static analyzeDMARCRecord(record: string): string[] {
    const issues: string[] = []

    // Check policy
    const policyMatch = record.match(/p=([^;]*)/i)
    if (!policyMatch) {
      issues.push('DMARC record missing policy')
    } else {
      const policy = policyMatch[1].toLowerCase()
      if (!['none', 'quarantine', 'reject'].includes(policy)) {
        issues.push(`Invalid DMARC policy: ${policy}`)
      } else if (policy === 'none') {
        issues.push('DMARC policy is set to none (monitoring only)')
      }
    }

    // Check for reporting addresses
    if (!record.includes('rua=') && !record.includes('ruf=')) {
      issues.push('DMARC record missing reporting addresses')
    }

    // Check for valid syntax
    if (!record.startsWith('v=DMARC1')) {
      issues.push('DMARC record has invalid syntax')
    }

    return issues
  }

  /**
   * Create unknown record for error cases
   */
  private static createUnknownRecord(type: 'SPF' | 'DKIM' | 'DMARC'): DomainAuthRecord {
    return {
      type,
      status: 'unknown',
      record: null,
      issues: [`Unable to check ${type} record`],
      recommendations: [`Verify DNS configuration and try again`]
    }
  }

  /**
   * Calculate overall authentication score
   */
  private static calculateOverallScore(
    spf: DomainAuthRecord,
    dkim: DomainAuthRecord,
    dmarc: DomainAuthRecord
  ): number {
    let score = 0

    // SPF scoring (30 points max)
    if (spf.status === 'valid') score += 30
    else if (spf.status === 'warning') score += 15
    else if (spf.status === 'missing') score += 0
    else score += 5 // unknown

    // DKIM scoring (35 points max)
    if (dkim.status === 'valid') score += 35
    else if (dkim.status === 'warning') score += 20
    else if (dkim.status === 'missing') score += 0
    else score += 5 // unknown

    // DMARC scoring (35 points max)
    if (dmarc.status === 'valid') score += 35
    else if (dmarc.status === 'warning') score += 20
    else if (dmarc.status === 'missing') score += 0
    else score += 5 // unknown

    return Math.min(100, score)
  }

  /**
   * Get overall status based on score
   */
  private static getOverallStatus(score: number): 'excellent' | 'good' | 'warning' | 'critical' {
    if (score >= 90) return 'excellent'
    if (score >= 70) return 'good'
    if (score >= 40) return 'warning'
    return 'critical'
  }

  /**
   * Generate recommendations based on results
   */
  private static generateRecommendations(
    spf: DomainAuthRecord,
    dkim: DomainAuthRecord,
    dmarc: DomainAuthRecord,
    overallStatus: string
  ): string[] {
    const recommendations: string[] = []

    if (overallStatus === 'excellent') {
      recommendations.push('✅ Your domain authentication is properly configured!')
      return recommendations
    }

    // Critical recommendations
    if (spf.status === 'missing') {
      recommendations.push('🔴 Critical: Set up SPF record to prevent email spoofing')
    }
    if (dkim.status === 'missing') {
      recommendations.push('🔴 Critical: Configure DKIM signing for email authentication')
    }
    if (dmarc.status === 'missing') {
      recommendations.push('🔴 Critical: Implement DMARC policy for email protection')
    }

    // Warning recommendations
    if (spf.status === 'warning') {
      recommendations.push('🟡 Warning: Fix SPF record issues to improve deliverability')
    }
    if (dkim.status === 'warning') {
      recommendations.push('🟡 Warning: Address DKIM configuration issues')
    }
    if (dmarc.status === 'warning') {
      recommendations.push('🟡 Warning: Optimize DMARC policy for better protection')
    }

    // General recommendations
    if (overallStatus === 'critical') {
      recommendations.push('📚 Consider consulting with your email provider for setup assistance')
    }

    return recommendations
  }

  /**
   * Get domain from email address
   */
  static getDomainFromEmail(email: string): string {
    const domain = email.split('@')[1]
    return domain ? domain.toLowerCase() : ''
  }

  /**
   * Update email account with domain authentication results
   */
  static formatForDatabase(result: DomainAuthResult) {
    return {
      spf: {
        status: result.spf.status,
        record: result.spf.record,
        valid: result.spf.status === 'valid'
      },
      dkim: {
        status: result.dkim.status,
        record: result.dkim.record,
        valid: result.dkim.status === 'valid'
      },
      dmarc: {
        status: result.dmarc.status,
        record: result.dmarc.record,
        valid: result.dmarc.status === 'valid'
      }
    }
  }
}