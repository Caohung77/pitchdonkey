import { DMARCConfig, DMARCRecord, DNSRecord } from '@/lib/types/domain-auth'

/**
 * DMARC (Domain-based Message Authentication, Reporting, and Conformance) Record Generator
 * Generates DMARC records for email authentication policy and reporting
 */
export class DMARCGenerator {
  /**
   * Generate DMARC record based on configuration
   */
  static generateRecord(config: DMARCConfig): { record: DNSRecord; parsed: DMARCRecord } {
    const parts: string[] = ['v=DMARC1']
    
    // Add policy
    parts.push(`p=${config.policy}`)
    
    // Add percentage if not 100%
    if (config.percentage < 100) {
      parts.push(`pct=${config.percentage}`)
    }
    
    // Add aggregate reports email
    if (config.reportEmail && config.aggregateReports) {
      parts.push(`rua=mailto:${config.reportEmail}`)
    }
    
    // Add forensic reports email
    if (config.reportEmail && config.forensicReports) {
      parts.push(`ruf=mailto:${config.reportEmail}`)
    }
    
    // Add alignment policies
    if (config.spfAlignment && config.spfAlignment !== 'relaxed') {
      parts.push(`aspf=${config.spfAlignment}`)
    }
    
    if (config.dkimAlignment && config.dkimAlignment !== 'relaxed') {
      parts.push(`adkim=${config.dkimAlignment}`)
    }
    
    const dmarcValue = parts.join('; ')
    
    const record: DNSRecord = {
      type: 'TXT',
      name: `_dmarc.${config.domain}`,
      value: dmarcValue,
      ttl: 3600
    }
    
    const parsed: DMARCRecord = {
      version: 'DMARC1',
      policy: config.policy,
      percentage: config.percentage,
      reportURI: config.reportEmail && config.aggregateReports ? [`mailto:${config.reportEmail}`] : undefined,
      forensicURI: config.reportEmail && config.forensicReports ? [`mailto:${config.reportEmail}`] : undefined,
      alignment: {
        spf: config.spfAlignment || 'relaxed',
        dkim: config.dkimAlignment || 'relaxed'
      },
      raw: dmarcValue
    }
    
    return { record, parsed }
  }
  
  /**
   * Generate basic DMARC record for getting started
   */
  static generateBasicRecord(domain: string, reportEmail?: string): { record: DNSRecord; parsed: DMARCRecord } {
    const config: DMARCConfig = {
      domain,
      policy: 'none', // Start with monitoring only
      percentage: 100,
      reportEmail,
      aggregateReports: !!reportEmail,
      forensicReports: false, // Start without forensic reports
      spfAlignment: 'relaxed',
      dkimAlignment: 'relaxed'
    }
    
    return this.generateRecord(config)
  }
  
  /**
   * Generate progressive DMARC records for gradual implementation
   */
  static generateProgressiveRecords(domain: string, reportEmail?: string) {
    return {
      // Phase 1: Monitor only
      monitoring: this.generateRecord({
        domain,
        policy: 'none',
        percentage: 100,
        reportEmail,
        aggregateReports: !!reportEmail,
        forensicReports: false
      }),
      
      // Phase 2: Quarantine 25% of failing emails
      quarantine25: this.generateRecord({
        domain,
        policy: 'quarantine',
        percentage: 25,
        reportEmail,
        aggregateReports: !!reportEmail,
        forensicReports: false
      }),
      
      // Phase 3: Quarantine 100% of failing emails
      quarantine100: this.generateRecord({
        domain,
        policy: 'quarantine',
        percentage: 100,
        reportEmail,
        aggregateReports: !!reportEmail,
        forensicReports: false
      }),
      
      // Phase 4: Reject all failing emails (final goal)
      reject: this.generateRecord({
        domain,
        policy: 'reject',
        percentage: 100,
        reportEmail,
        aggregateReports: !!reportEmail,
        forensicReports: false
      })
    }
  }
  
  /**
   * Validate DMARC record syntax
   */
  static validateRecord(dmarcRecord: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check if record starts with v=DMARC1
    if (!dmarcRecord.startsWith('v=DMARC1')) {
      errors.push('DMARC record must start with "v=DMARC1"')
    }
    
    // Parse the record into key-value pairs
    const pairs = dmarcRecord.split(';').map(pair => pair.trim())
    const params: Record<string, string> = {}
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim())
      if (key && value) {
        params[key] = value
      }
    }
    
    // Check required policy
    if (!params.p) {
      errors.push('DMARC record must include policy "p=" parameter')
    } else if (!['none', 'quarantine', 'reject'].includes(params.p)) {
      errors.push('DMARC policy must be "none", "quarantine", or "reject"')
    }
    
    // Validate percentage
    if (params.pct) {
      const pct = parseInt(params.pct, 10)
      if (isNaN(pct) || pct < 0 || pct > 100) {
        errors.push('DMARC percentage must be between 0 and 100')
      }
    }
    
    // Validate alignment
    if (params.aspf && !['r', 's', 'relaxed', 'strict'].includes(params.aspf)) {
      errors.push('SPF alignment must be "r" (relaxed) or "s" (strict)')
    }
    
    if (params.adkim && !['r', 's', 'relaxed', 'strict'].includes(params.adkim)) {
      errors.push('DKIM alignment must be "r" (relaxed) or "s" (strict)')
    }
    
    // Validate report URIs
    if (params.rua) {
      const uris = params.rua.split(',')
      for (const uri of uris) {
        if (!uri.trim().startsWith('mailto:')) {
          warnings.push('Aggregate report URI should be a mailto: address')
        }
      }
    }
    
    if (params.ruf) {
      const uris = params.ruf.split(',')
      for (const uri of uris) {
        if (!uri.trim().startsWith('mailto:')) {
          warnings.push('Forensic report URI should be a mailto: address')
        }
      }
    }
    
    // Warnings for best practices
    if (params.p === 'none' && !params.rua) {
      warnings.push('Consider adding aggregate reports (rua) to monitor DMARC effectiveness')
    }
    
    if (params.p === 'reject' && !params.rua) {
      warnings.push('Highly recommended to have aggregate reports when using reject policy')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Parse existing DMARC record
   */
  static parseRecord(dmarcRecord: string): DMARCRecord | null {
    if (!dmarcRecord.startsWith('v=DMARC1')) {
      return null
    }
    
    const pairs = dmarcRecord.split(';').map(pair => pair.trim())
    const params: Record<string, string> = {}
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim())
      if (key && value) {
        params[key] = value
      }
    }
    
    const policy = params.p as 'none' | 'quarantine' | 'reject'
    if (!policy || !['none', 'quarantine', 'reject'].includes(policy)) {
      return null
    }
    
    return {
      version: 'DMARC1',
      policy,
      percentage: params.pct ? parseInt(params.pct, 10) : 100,
      reportURI: params.rua ? params.rua.split(',').map(uri => uri.trim()) : undefined,
      forensicURI: params.ruf ? params.ruf.split(',').map(uri => uri.trim()) : undefined,
      alignment: {
        spf: params.aspf === 's' || params.aspf === 'strict' ? 'strict' : 'relaxed',
        dkim: params.adkim === 's' || params.adkim === 'strict' ? 'strict' : 'relaxed'
      },
      raw: dmarcRecord
    }
  }
  
  /**
   * Get setup instructions for DMARC
   */
  static getSetupInstructions(domain: string, record: DNSRecord, isProgressive: boolean = true): string {
    const parsed = this.parseRecord(record.value)
    const policyDescription = this.getPolicyDescription(parsed?.policy || 'none')
    
    return `
To set up DMARC for ${domain}:

1. Log in to your DNS provider (GoDaddy, Cloudflare, Namecheap, etc.)
2. Go to DNS management for ${domain}
3. Add a new TXT record:
   - Name/Host: _dmarc
   - Type: TXT
   - Value: ${record.value}
   - TTL: 3600 (or 1 hour)

What this does:
- DMARC tells receiving email servers what to do with emails that fail SPF or DKIM checks
- Current policy: ${policyDescription}
- Provides reports on email authentication results
- Helps prevent email spoofing and phishing using your domain

${isProgressive ? `
IMPORTANT - Progressive Implementation Recommended:

1. START with "p=none" (monitoring only) - This current record
   - Collect reports for 1-2 weeks to understand your email flow
   - Identify any legitimate emails that might be failing authentication

2. UPGRADE to "p=quarantine; pct=25" 
   - Quarantine 25% of failing emails to test impact
   - Monitor for any delivery issues with legitimate emails

3. INCREASE to "p=quarantine; pct=100"
   - Quarantine all failing emails
   - Ensure no legitimate emails are being quarantined

4. FINAL STEP: "p=reject"
   - Reject all failing emails (strongest protection)
   - Only implement after confirming all legitimate emails pass authentication

Never jump straight to "p=reject" without testing - you could block legitimate emails!
` : ''}

${parsed?.reportURI ? `
Reports will be sent to: ${parsed.reportURI.join(', ')}
Check these reports regularly to monitor authentication results and identify issues.
` : `
Consider adding a report email address (rua=mailto:your-email@${domain}) to receive authentication reports.
`}
    `.trim()
  }
  
  /**
   * Get human-readable policy description
   */
  private static getPolicyDescription(policy: string): string {
    switch (policy) {
      case 'none':
        return 'Monitor only - no action taken on failing emails (recommended for testing)'
      case 'quarantine':
        return 'Quarantine failing emails - they go to spam/junk folder'
      case 'reject':
        return 'Reject failing emails - they are not delivered at all'
      default:
        return 'Unknown policy'
    }
  }
  
  /**
   * Get recommended next steps based on current policy
   */
  static getNextSteps(currentRecord: string): string[] {
    const parsed = this.parseRecord(currentRecord)
    if (!parsed) {
      return ['Fix DMARC record syntax errors']
    }
    
    const steps: string[] = []
    
    switch (parsed.policy) {
      case 'none':
        steps.push('Monitor DMARC reports for 1-2 weeks')
        steps.push('Ensure all legitimate emails pass SPF and DKIM')
        steps.push('Upgrade to "p=quarantine; pct=25" for gradual enforcement')
        break
        
      case 'quarantine':
        if ((parsed.percentage || 100) < 100) {
          steps.push('Monitor quarantined emails for false positives')
          steps.push('Increase percentage gradually to 100%')
        } else {
          steps.push('Monitor quarantine folder for legitimate emails')
          steps.push('Consider upgrading to "p=reject" for maximum protection')
        }
        break
        
      case 'reject':
        steps.push('Monitor DMARC reports for any delivery issues')
        steps.push('Ensure backup email authentication is working')
        steps.push('Consider implementing BIMI for enhanced brand visibility')
        break
    }
    
    if (!parsed.reportURI) {
      steps.unshift('Add aggregate reporting email to monitor authentication results')
    }
    
    return steps
  }
}