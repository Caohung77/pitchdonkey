import { DomainAuthService } from '@/lib/domain-auth'
import dns from 'dns/promises'

// Mock dns module
jest.mock('dns/promises')
const mockDns = dns as jest.Mocked<typeof dns>

describe('DomainAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkDomainAuthentication', () => {
    it('should return complete domain authentication results', async () => {
      // Mock DNS responses
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 include:_spf.google.com ~all']]) // SPF
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC']]) // DKIM
        .mockResolvedValueOnce([['v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com']]) // DMARC

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result).toMatchObject({
        domain: 'example.com',
        spf: {
          type: 'SPF',
          status: 'valid',
          record: 'v=spf1 include:_spf.google.com ~all',
        },
        dkim: {
          type: 'DKIM',
          status: 'valid',
        },
        dmarc: {
          type: 'DMARC',
          status: 'valid',
          record: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com',
        },
        overall_score: expect.any(Number),
        overall_status: expect.stringMatching(/excellent|good|warning|critical/),
        recommendations: expect.any(Array),
        last_checked: expect.any(String),
      })
    })

    it('should handle missing SPF record', async () => {
      mockDns.resolveTxt
        .mockResolvedValueOnce([]) // No SPF record
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC']]) // DKIM
        .mockResolvedValueOnce([['v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com']]) // DMARC

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.spf).toMatchObject({
        type: 'SPF',
        status: 'missing',
        record: null,
        issues: ['No SPF record found'],
        recommendations: expect.arrayContaining([
          expect.stringContaining('Add an SPF record'),
        ]),
      })
    })

    it('should handle missing DKIM record', async () => {
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 include:_spf.google.com ~all']]) // SPF
        .mockRejectedValue(new Error('NXDOMAIN')) // No DKIM records for any selector
        .mockResolvedValueOnce([['v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com']]) // DMARC

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.dkim).toMatchObject({
        type: 'DKIM',
        status: 'missing',
        record: null,
        issues: ['No DKIM records found for common selectors'],
        recommendations: expect.arrayContaining([
          expect.stringContaining('Set up DKIM signing'),
        ]),
      })
    })

    it('should handle missing DMARC record', async () => {
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 include:_spf.google.com ~all']]) // SPF
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC']]) // DKIM
        .mockResolvedValueOnce([]) // No DMARC record

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.dmarc).toMatchObject({
        type: 'DMARC',
        status: 'missing',
        record: null,
        issues: ['No DMARC record found'],
        recommendations: expect.arrayContaining([
          expect.stringContaining('Add a DMARC record'),
        ]),
      })
    })

    it('should clean domain input correctly', async () => {
      mockDns.resolveTxt
        .mockResolvedValue([['v=spf1 include:_spf.google.com ~all']])

      await DomainAuthService.checkDomainAuthentication('https://www.example.com/path')

      // Should call DNS with cleaned domain
      expect(mockDns.resolveTxt).toHaveBeenCalledWith('example.com')
    })

    it('should handle DNS lookup failures gracefully', async () => {
      mockDns.resolveTxt.mockRejectedValue(new Error('DNS timeout'))

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.spf.status).toBe('unknown')
      expect(result.dkim.status).toBe('unknown')
      expect(result.dmarc.status).toBe('unknown')
      expect(result.overall_status).toBe('critical')
    })
  })

  describe('SPF Analysis', () => {
    it('should detect SPF record with too many DNS lookups', async () => {
      const spfRecord = 'v=spf1 include:spf1.example.com include:spf2.example.com include:spf3.example.com include:spf4.example.com include:spf5.example.com include:spf6.example.com include:spf7.example.com include:spf8.example.com include:spf9.example.com include:spf10.example.com include:spf11.example.com ~all'
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([[spfRecord]])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=test']])
        .mockResolvedValueOnce([['v=DMARC1; p=none']])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.spf.status).toBe('warning')
      expect(result.spf.issues).toContain(expect.stringContaining('Too many DNS lookups'))
    })

    it('should detect SPF record without proper termination', async () => {
      const spfRecord = 'v=spf1 include:_spf.google.com'
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([[spfRecord]])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=test']])
        .mockResolvedValueOnce([['v=DMARC1; p=none']])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.spf.status).toBe('warning')
      expect(result.spf.issues).toContain('SPF record missing proper termination mechanism')
    })

    it('should detect dangerous +all mechanism', async () => {
      const spfRecord = 'v=spf1 include:_spf.google.com +all'
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([[spfRecord]])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=test']])
        .mockResolvedValueOnce([['v=DMARC1; p=none']])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.spf.status).toBe('warning')
      expect(result.spf.issues).toContain('SPF record uses +all which allows all senders')
    })
  })

  describe('DKIM Analysis', () => {
    it('should detect DKIM record with empty public key', async () => {
      const dkimRecord = 'v=DKIM1; k=rsa; p='
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 ~all']])
        .mockResolvedValueOnce([[dkimRecord]])
        .mockResolvedValueOnce([['v=DMARC1; p=none']])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.dkim.status).toBe('warning')
      expect(result.dkim.issues).toContain('DKIM public key is empty')
    })

    it('should detect deprecated SHA-1 hash algorithm', async () => {
      const dkimRecord = 'v=DKIM1; k=rsa; h=sha1; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC'
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 ~all']])
        .mockResolvedValueOnce([[dkimRecord]])
        .mockResolvedValueOnce([['v=DMARC1; p=none']])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.dkim.status).toBe('warning')
      expect(result.dkim.issues).toContain('DKIM uses SHA-1 which is deprecated')
    })
  })

  describe('DMARC Analysis', () => {
    it('should detect DMARC policy set to none', async () => {
      const dmarcRecord = 'v=DMARC1; p=none; rua=mailto:dmarc@example.com'
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 ~all']])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=test']])
        .mockResolvedValueOnce([[dmarcRecord]])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.dmarc.status).toBe('warning')
      expect(result.dmarc.issues).toContain('DMARC policy is set to none (monitoring only)')
    })

    it('should detect missing DMARC reporting addresses', async () => {
      const dmarcRecord = 'v=DMARC1; p=quarantine'
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 ~all']])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=test']])
        .mockResolvedValueOnce([[dmarcRecord]])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.dmarc.status).toBe('warning')
      expect(result.dmarc.issues).toContain('DMARC record missing reporting addresses')
    })

    it('should detect invalid DMARC policy', async () => {
      const dmarcRecord = 'v=DMARC1; p=invalid'
      
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 ~all']])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=test']])
        .mockResolvedValueOnce([[dmarcRecord]])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.dmarc.status).toBe('warning')
      expect(result.dmarc.issues).toContain('Invalid DMARC policy: invalid')
    })
  })

  describe('Overall Scoring', () => {
    it('should calculate excellent score for perfect configuration', async () => {
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 include:_spf.google.com -all']])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC']])
        .mockResolvedValueOnce([['v=DMARC1; p=reject; rua=mailto:dmarc@example.com']])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.overall_score).toBeGreaterThanOrEqual(90)
      expect(result.overall_status).toBe('excellent')
    })

    it('should calculate critical score for missing records', async () => {
      mockDns.resolveTxt
        .mockResolvedValueOnce([]) // No SPF
        .mockRejectedValue(new Error('NXDOMAIN')) // No DKIM
        .mockResolvedValueOnce([]) // No DMARC

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.overall_score).toBeLessThan(40)
      expect(result.overall_status).toBe('critical')
    })
  })

  describe('Recommendations', () => {
    it('should provide critical recommendations for missing records', async () => {
      mockDns.resolveTxt
        .mockResolvedValueOnce([]) // No SPF
        .mockRejectedValue(new Error('NXDOMAIN')) // No DKIM
        .mockResolvedValueOnce([]) // No DMARC

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.recommendations).toContain('🔴 Critical: Set up SPF record to prevent email spoofing')
      expect(result.recommendations).toContain('🔴 Critical: Configure DKIM signing for email authentication')
      expect(result.recommendations).toContain('🔴 Critical: Implement DMARC policy for email protection')
    })

    it('should provide positive feedback for good configuration', async () => {
      mockDns.resolveTxt
        .mockResolvedValueOnce([['v=spf1 include:_spf.google.com -all']])
        .mockResolvedValueOnce([['v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC']])
        .mockResolvedValueOnce([['v=DMARC1; p=reject; rua=mailto:dmarc@example.com']])

      const result = await DomainAuthService.checkDomainAuthentication('example.com')

      expect(result.recommendations).toContain('✅ Your domain authentication is properly configured!')
    })
  })
})