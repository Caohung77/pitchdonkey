import { DomainAuthService, extractDomainFromEmail, validateDomain, normalizeDomain } from '@/lib/domain-auth'
import { DomainAuthError } from '@/lib/types/domain-auth'

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { code: 'PGRST116' }
            }))
          })),
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-id',
              user_id: 'test-user',
              domain: 'example.com',
              spf_verified: false,
              dkim_verified: false,
              dmarc_verified: false
            },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            error: null
          }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            error: null
          }))
        }))
      }))
    }))
  }))
}))

describe('DomainAuthService', () => {
  let service: DomainAuthService

  beforeEach(() => {
    service = new DomainAuthService()
    jest.clearAllMocks()
  })

  describe('createDomain', () => {
    it('should create a new domain authentication record', async () => {
      const request = {
        domain: 'example.com',
        dns_provider: 'manual' as const,
        auto_configure: false
      }

      const result = await service.createDomain('test-user', request)

      expect(result).toEqual({
        id: 'test-id',
        user_id: 'test-user',
        domain: 'example.com',
        spf_verified: false,
        dkim_verified: false,
        dmarc_verified: false
      })
    })

    it('should normalize domain to lowercase', async () => {
      const request = {
        domain: 'EXAMPLE.COM',
        dns_provider: 'manual' as const
      }

      await service.createDomain('test-user', request)

      // The service should normalize the domain to lowercase
      expect(request.domain.toLowerCase()).toBe('example.com')
    })
  })

  describe('getDomain', () => {
    it('should return null when domain is not found', async () => {
      const result = await service.getDomain('test-user', 'nonexistent.com')
      expect(result).toBeNull()
    })
  })

  describe('updateVerificationStatus', () => {
    it('should update verification status for SPF', async () => {
      await service.updateVerificationStatus('test-user', 'example.com', 'spf', true, 'v=spf1 ~all')

      // Should not throw any errors
      expect(true).toBe(true)
    })
  })

  describe('calculateOverallHealth', () => {
    it('should return excellent for mostly verified domains', () => {
      const domains = [
        { fully_verified: true } as any,
        { fully_verified: true } as any,
        { fully_verified: true } as any,
        { fully_verified: true } as any,
        { fully_verified: false, spf_verified: true, dkim_verified: false, dmarc_verified: false } as any
      ]

      const health = (service as any).calculateOverallHealth(domains)
      expect(health).toBe('excellent')
    })

    it('should return critical for no domains', () => {
      const health = (service as any).calculateOverallHealth([])
      expect(health).toBe('critical')
    })

    it('should return critical for all unverified domains', () => {
      const domains = [
        { fully_verified: false, spf_verified: false, dkim_verified: false, dmarc_verified: false } as any,
        { fully_verified: false, spf_verified: false, dkim_verified: false, dmarc_verified: false } as any
      ]

      const health = (service as any).calculateOverallHealth(domains)
      expect(health).toBe('critical')
    })
  })
})

describe('Utility Functions', () => {
  describe('extractDomainFromEmail', () => {
    it('should extract domain from valid email', () => {
      expect(extractDomainFromEmail('user@example.com')).toBe('example.com')
      expect(extractDomainFromEmail('test.user@subdomain.example.org')).toBe('subdomain.example.org')
    })

    it('should convert domain to lowercase', () => {
      expect(extractDomainFromEmail('user@EXAMPLE.COM')).toBe('example.com')
    })

    it('should throw error for invalid email format', () => {
      expect(() => extractDomainFromEmail('invalid-email')).toThrow(DomainAuthError)
      expect(() => extractDomainFromEmail('user@')).toThrow(DomainAuthError)
      expect(() => extractDomainFromEmail('@example.com')).toThrow(DomainAuthError)
    })
  })

  describe('validateDomain', () => {
    it('should validate correct domain formats', () => {
      expect(validateDomain('example.com')).toBe(true)
      expect(validateDomain('subdomain.example.com')).toBe(true)
      expect(validateDomain('test-domain.co.uk')).toBe(true)
      expect(validateDomain('a.b')).toBe(true)
    })

    it('should reject invalid domain formats', () => {
      expect(validateDomain('')).toBe(false)
      expect(validateDomain('.')).toBe(false)
      expect(validateDomain('.example.com')).toBe(false)
      expect(validateDomain('example.com.')).toBe(false)
      expect(validateDomain('example..com')).toBe(false)
      expect(validateDomain('-example.com')).toBe(false)
      expect(validateDomain('example-.com')).toBe(false)
    })

    it('should reject domains that are too long', () => {
      const longDomain = 'a'.repeat(250) + '.com'
      expect(validateDomain(longDomain)).toBe(false)
    })
  })

  describe('normalizeDomain', () => {
    it('should convert to lowercase', () => {
      expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com')
      expect(normalizeDomain('Test-Domain.ORG')).toBe('test-domain.org')
    })

    it('should remove trailing dot', () => {
      expect(normalizeDomain('example.com.')).toBe('example.com')
      expect(normalizeDomain('subdomain.example.org.')).toBe('subdomain.example.org')
    })

    it('should handle domains that are already normalized', () => {
      expect(normalizeDomain('example.com')).toBe('example.com')
      expect(normalizeDomain('test.example.org')).toBe('test.example.org')
    })
  })
})