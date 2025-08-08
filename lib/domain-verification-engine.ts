import { 
  VerificationResult, 
  ValidationResult, 
  DomainVerificationStatus,
  SPFRecord,
  DKIMRecord,
  DMARCRecord
} from '@/lib/types/domain-auth'
import { DNSLookupService } from '@/lib/dns-lookup-service'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'

/**
 * Domain Verification Engine
 * Handles verification and validation of SPF, DKIM, and DMARC records
 */
export class DomainVerificationEngine {
  
  /**
   * Verify SPF record for a domain
   */
  static async verifySPF(domain: string): Promise<VerificationResult> {
    const startTime = Date.now()
    
    try {
      const { record, responseTime, rawResponse } = await DNSLookupService.lookupSPF(domain)
      
      if (!record) {
        return {
          type: 'spf',
          success: false,
          validation: {
            isValid: false,
            errors: ['No SPF record found'],
            warnings: [],
            suggestions: [
              'Add an SPF record to authorize email servers for your domain',
              'Example: v=spf1 include:_spf.google.com ~all'
            ],
            score: 0
          },
          responseTime,
          checkedAt: new Date().toISOString()
        }
      }
      
      const validation = this.validateSPFRecord(record, domain)
      
      return {
        type: 'spf',
        success: validation.isValid,
        record,
        validation,
        responseTime,
        checkedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        type: 'spf',
        success: false,
        validation: {
          isValid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          suggestions: ['Check domain name and try again'],
          score: 0
        },
        responseTime: Date.now() - startTime,
        checkedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Verify DKIM record for a domain and selector
   */
  static async verifyDKIM(domain: string, selector: string): Promise<VerificationResult> {
    const startTime = Date.now()
    
    try {
      const { record, responseTime, rawResponse } = await DNSLookupService.lookupDKIM(domain, selector)
      
      if (!record) {
        return {
          type: 'dkim',
          success: false,
          validation: {
            isValid: false,
            errors: [`No DKIM record found for selector '${selector}'`],
            warnings: [],
            suggestions: [
              `Add a DKIM record at ${selector}._domainkey.${domain}`,
              'Generate DKIM keys and add the public key to DNS'
            ],
            score: 0
          },
          responseTime,
          checkedAt: new Date().toISOString()
        }
      }
      
      const validation = this.validateDKIMRecord(record, domain, selector)
      
      return {
        type: 'dkim',
        success: validation.isValid,
        record,
        validation,
        responseTime,
        checkedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        type: 'dkim',
        success: false,
        validation: {
          isValid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          suggestions: ['Check domain name and DKIM selector'],
          score: 0
        },
        responseTime: Date.now() - startTime,
        checkedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Verify DMARC record for a domain
   */
  static async verifyDMARC(domain: string): Promise<VerificationResult> {
    const startTime = Date.now()
    
    try {
      const { record, responseTime, rawResponse } = await DNSLookupService.lookupDMARC(domain)
      
      if (!record) {
        return {
          type: 'dmarc',
          success: false,
          validation: {
            isValid: false,
            errors: ['No DMARC record found'],
            warnings: [],
            suggestions: [
              'Add a DMARC record to specify email authentication policy',
              'Start with: v=DMARC1; p=none; rua=mailto:reports@' + domain
            ],
            score: 0
          },
          responseTime,
          checkedAt: new Date().toISOString()
        }
      }
      
      const validation = this.validateDMARCRecord(record, domain)
      
      return {
        type: 'dmarc',
        success: validation.isValid,
        record,
        validation,
        responseTime,
        checkedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        type: 'dmarc',
        success: false,
        validation: {
          isValid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          suggestions: ['Check domain name and try again'],
          score: 0
        },
        responseTime: Date.now() - startTime,
        checkedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Verify all authentication records for a domain
   */
  static async verifyAll(domain: string, dkimSelector?: string): Promise<DomainVerificationStatus> {
    const startTime = Date.now()
    
    // Run all verifications in parallel
    const [spfResult, dkimResult, dmarcResult] = await Promise.allSettled([
      this.verifySPF(domain),
      dkimSelector ? this.verifyDKIM(domain, dkimSelector) : null,
      this.verifyDMARC(domain)
    ])

    const results: VerificationResult[] = []
    
    if (spfResult.status === 'fulfilled') {
      results.push(spfResult.value)
    }
    
    if (dkimResult && dkimResult.status === 'fulfilled' && dkimResult.value) {
      results.push(dkimResult.value)
    }
    
    if (dmarcResult.status === 'fulfilled') {
      results.push(dmarcResult.value)
    }

    // Determine overall status
    const successfulResults = results.filter(r => r.success)
    let overallStatus: 'verified' | 'partial' | 'unverified' | 'error'
    
    if (results.length === 0) {
      overallStatus = 'error'
    } else if (successfulResults.length === results.length) {
      overallStatus = 'verified'
    } else if (successfulResults.length > 0) {
      overallStatus = 'partial'
    } else {
      overallStatus = 'unverified'
    }

    return {
      domain,
      spf: results.find(r => r.type === 'spf') || null,
      dkim: results.find(r => r.type === 'dkim') || null,
      dmarc: results.find(r => r.type === 'dmarc') || null,
      overallStatus,
      lastChecked: new Date().toISOString()
    }
  }

  /**
   * Validate SPF record with comprehensive checks
   */
  private static validateSPFRecord(record: SPFRecord, domain: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []
    
    // Use the existing SPF validation from the generator
    const basicValidation = SPFGenerator.validateRecord(record.raw)
    errors.push(...basicValidation.errors)
    warnings.push(...basicValidation.warnings)
    
    // Additional domain-specific validation
    if (record.mechanisms.length === 0) {
      warnings.push('SPF record has no mechanisms - it may not authorize any servers')
    }
    
    // Check for common issues
    const includeCount = record.mechanisms.filter(m => m.startsWith('include:')).length
    if (includeCount > 10) {
      warnings.push('Too many include mechanisms may cause DNS lookup limits')
    }
    
    // Check for overly permissive records
    if (record.qualifier === 'pass') {
      warnings.push('Using "+all" allows any server to send emails - not recommended')
    }
    
    // Provide suggestions based on findings
    if (record.qualifier === 'neutral') {
      suggestions.push('Consider using "~all" (softfail) or "-all" (hardfail) instead of "?all"')
    }
    
    if (!record.mechanisms.some(m => m.startsWith('include:') || m.startsWith('ip4:') || m.startsWith('ip6:'))) {
      suggestions.push('Add include mechanisms for your email providers or IP addresses for your mail servers')
    }
    
    // Calculate score (0-100)
    let score = 100
    score -= errors.length * 20
    score -= warnings.length * 5
    score = Math.max(0, score)
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score
    }
  }

  /**
   * Validate DKIM record with comprehensive checks
   */
  private static validateDKIMRecord(record: DKIMRecord, domain: string, selector: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []
    
    // Use the existing DKIM validation from the generator
    const basicValidation = DKIMGenerator.validateRecord(record.raw)
    errors.push(...basicValidation.errors)
    warnings.push(...basicValidation.warnings)
    
    // Additional validation
    if (record.keyType !== 'rsa') {
      warnings.push(`Key type '${record.keyType}' is not commonly supported - RSA is recommended`)
    }
    
    // Check public key length (rough estimate)
    const keyLength = record.publicKey.length
    if (keyLength < 200) {
      warnings.push('Public key appears to be short - consider using 2048-bit keys for better security')
    }
    
    // Check selector format
    if (selector.length > 63) {
      errors.push('DKIM selector is too long (max 63 characters)')
    }
    
    if (!/^[a-zA-Z0-9._-]+$/.test(selector)) {
      errors.push('DKIM selector contains invalid characters')
    }
    
    // Suggestions
    if (keyLength < 300) {
      suggestions.push('Consider regenerating with 2048-bit keys for better security')
    }
    
    suggestions.push('Test DKIM signing by sending an email and checking headers')
    
    // Calculate score
    let score = 100
    score -= errors.length * 25
    score -= warnings.length * 10
    score = Math.max(0, score)
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score
    }
  }

  /**
   * Validate DMARC record with comprehensive checks
   */
  private static validateDMARCRecord(record: DMARCRecord, domain: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []
    
    // Use the existing DMARC validation from the generator
    const basicValidation = DMARCGenerator.validateRecord(record.raw)
    errors.push(...basicValidation.errors)
    warnings.push(...basicValidation.warnings)
    
    // Policy-specific validation
    if (record.policy === 'reject' && !record.reportURI) {
      warnings.push('Using reject policy without aggregate reports - you won\'t know if legitimate emails are being rejected')
    }
    
    if (record.policy === 'none' && !record.reportURI) {
      suggestions.push('Add aggregate reporting to monitor authentication results')
    }
    
    // Percentage validation
    if (record.percentage && record.percentage < 100 && record.policy === 'none') {
      warnings.push('Percentage setting has no effect with policy "none"')
    }
    
    // Alignment validation
    if (record.alignment?.spf === 'strict' || record.alignment?.dkim === 'strict') {
      suggestions.push('Strict alignment requires exact domain matches - ensure your email setup supports this')
    }
    
    // Progressive implementation suggestions
    const nextSteps = DMARCGenerator.getNextSteps(record.raw)
    suggestions.push(...nextSteps)
    
    // Calculate score based on policy strength and configuration
    let score = 50 // Base score
    
    switch (record.policy) {
      case 'reject':
        score += 40
        break
      case 'quarantine':
        score += 30
        break
      case 'none':
        score += 10
        break
    }
    
    if (record.reportURI && record.reportURI.length > 0) {
      score += 10
    }
    
    score -= errors.length * 20
    score -= warnings.length * 5
    score = Math.max(0, Math.min(100, score))
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score
    }
  }

  /**
   * Get verification summary with actionable insights
   */
  static getVerificationSummary(status: DomainVerificationStatus): {
    overallScore: number
    criticalIssues: string[]
    recommendations: string[]
    nextSteps: string[]
  } {
    const results = [status.spf, status.dkim, status.dmarc].filter(Boolean) as VerificationResult[]
    
    // Calculate overall score
    const totalScore = results.reduce((sum, result) => sum + (result.validation.score || 0), 0)
    const overallScore = results.length > 0 ? Math.round(totalScore / results.length) : 0
    
    // Collect critical issues (errors)
    const criticalIssues: string[] = []
    results.forEach(result => {
      result.validation.errors.forEach(error => {
        criticalIssues.push(`${result.type.toUpperCase()}: ${error}`)
      })
    })
    
    // Collect recommendations (warnings + suggestions)
    const recommendations: string[] = []
    results.forEach(result => {
      result.validation.warnings.forEach(warning => {
        recommendations.push(`${result.type.toUpperCase()}: ${warning}`)
      })
    })
    
    // Collect next steps
    const nextSteps: string[] = []
    results.forEach(result => {
      result.validation.suggestions.forEach(suggestion => {
        nextSteps.push(suggestion)
      })
    })
    
    // Add overall next steps based on verification status
    if (status.overallStatus === 'unverified') {
      nextSteps.unshift('Set up basic email authentication records (SPF, DKIM, DMARC)')
    } else if (status.overallStatus === 'partial') {
      nextSteps.unshift('Complete missing authentication records for full protection')
    } else if (status.overallStatus === 'verified') {
      nextSteps.unshift('Monitor authentication reports and consider strengthening policies')
    }
    
    return {
      overallScore,
      criticalIssues: Array.from(new Set(criticalIssues)), // Remove duplicates
      recommendations: Array.from(new Set(recommendations)),
      nextSteps: Array.from(new Set(nextSteps))
    }
  }
}