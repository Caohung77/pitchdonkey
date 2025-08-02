// Simple test for DNS verification system

const { DNSLookupService } = require('../../lib/dns-lookup-service')
const { DomainVerificationEngine } = require('../../lib/domain-verification-engine')

// Mock DNS module to avoid real DNS calls in tests
jest.mock('dns', () => ({
  promises: {
    resolveTxt: jest.fn(),
    resolve4: jest.fn(),
    resolve6: jest.fn(),
    resolveMx: jest.fn(),
    resolveNs: jest.fn()
  }
}))

describe('DNS Verification System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('DNSLookupService', () => {
    test('should validate domain format correctly', () => {
      expect(DNSLookupService.validateDomainFormat('example.com')).toEqual({
        isValid: true
      })
      
      expect(DNSLookupService.validateDomainFormat('invalid')).toEqual({
        isValid: false,
        error: 'Domain must have a valid top-level domain'
      })
      
      expect(DNSLookupService.validateDomainFormat('')).toEqual({
        isValid: false,
        error: 'Domain is required and must be a string'
      })
    })

    test('should provide user-friendly DNS error messages', () => {
      expect(DNSLookupService.getDNSErrorMessage({ code: 'ENOTFOUND' }))
        .toBe('Domain not found. Please check the domain name is correct.')
      
      expect(DNSLookupService.getDNSErrorMessage({ code: 'ETIMEOUT' }))
        .toBe('DNS lookup timed out. Please try again later.')
      
      expect(DNSLookupService.getDNSErrorMessage({ message: 'timeout occurred' }))
        .toBe('DNS lookup timed out. Please try again later.')
    })
  })

  describe('DomainVerificationEngine', () => {
    test('should handle missing SPF record gracefully', async () => {
      const dns = require('dns')
      dns.promises.resolveTxt.mockRejectedValue(new Error('ENOTFOUND'))

      const result = await DomainVerificationEngine.verifySPF('nonexistent.com')
      
      expect(result.type).toBe('spf')
      expect(result.success).toBe(false)
      expect(result.validation.errors).toContain('Failed to lookup SPF record for nonexistent.com: ENOTFOUND')
    })

    test('should handle missing DKIM record gracefully', async () => {
      const dns = require('dns')
      dns.promises.resolveTxt.mockRejectedValue(new Error('ENOTFOUND'))

      const result = await DomainVerificationEngine.verifyDKIM('nonexistent.com', 'selector')
      
      expect(result.type).toBe('dkim')
      expect(result.success).toBe(false)
      expect(result.validation.errors).toContain('Failed to lookup DKIM record for selector._domainkey.nonexistent.com: ENOTFOUND')
    })

    test('should handle missing DMARC record gracefully', async () => {
      const dns = require('dns')
      dns.promises.resolveTxt.mockRejectedValue(new Error('ENOTFOUND'))

      const result = await DomainVerificationEngine.verifyDMARC('nonexistent.com')
      
      expect(result.type).toBe('dmarc')
      expect(result.success).toBe(false)
      expect(result.validation.errors).toContain('Failed to lookup DMARC record for _dmarc.nonexistent.com: ENOTFOUND')
    })

    test('should provide verification summary', () => {
      const mockStatus = {
        domain: 'example.com',
        spf: {
          type: 'spf',
          success: true,
          validation: { isValid: true, errors: [], warnings: ['Test warning'], suggestions: ['Test suggestion'], score: 85 },
          responseTime: 100,
          checkedAt: '2024-01-01T00:00:00Z'
        },
        dkim: null,
        dmarc: {
          type: 'dmarc',
          success: false,
          validation: { isValid: false, errors: ['No DMARC record'], warnings: [], suggestions: ['Add DMARC'], score: 0 },
          responseTime: 150,
          checkedAt: '2024-01-01T00:00:00Z'
        },
        overallStatus: 'partial',
        lastChecked: '2024-01-01T00:00:00Z'
      }

      const summary = DomainVerificationEngine.getVerificationSummary(mockStatus)
      
      expect(summary).toHaveProperty('overallScore')
      expect(summary).toHaveProperty('criticalIssues')
      expect(summary).toHaveProperty('recommendations')
      expect(summary).toHaveProperty('nextSteps')
      
      expect(summary.criticalIssues).toContain('DMARC: No DMARC record')
      expect(summary.recommendations).toContain('SPF: Test warning')
    })
  })
})