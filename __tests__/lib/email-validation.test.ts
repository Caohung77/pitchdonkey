import { EmailValidationService } from '@/lib/email-validation'
import dns from 'dns/promises'

// Mock DNS module
jest.mock('dns/promises')
const mockDns = dns as jest.Mocked<typeof dns>

describe('EmailValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateEmail', () => {
    it('should validate a correct email format', async () => {
      mockDns.resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }])

      const result = await EmailValidationService.validateEmail('test@example.com')

      expect(result.isValid).toBe(true)
      expect(result.status).toBe('valid')
      expect(result.email).toBe('test@example.com')
      expect(result.mx_found).toBe(true)
    })

    it('should reject invalid email format', async () => {
      const result = await EmailValidationService.validateEmail('invalid-email')

      expect(result.isValid).toBe(false)
      expect(result.status).toBe('invalid')
      expect(result.reason).toBe('Invalid email format')
      expect(result.deliverable).toBe(false)
    })

    it('should detect disposable email addresses', async () => {
      const result = await EmailValidationService.validateEmail('test@10minutemail.com')

      expect(result.isValid).toBe(false)
      expect(result.status).toBe('invalid')
      expect(result.reason).toBe('Disposable email address')
      expect(result.disposable).toBe(true)
    })

    it('should detect role-based email addresses', async () => {
      mockDns.resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }])

      const result = await EmailValidationService.validateEmail('admin@example.com')

      expect(result.isValid).toBe(true)
      expect(result.status).toBe('risky')
      expect(result.reason).toBe('Role-based email address')
      expect(result.role).toBe(true)
    })

    it('should detect free email providers', async () => {
      mockDns.resolveMx.mockResolvedValue([{ exchange: 'mx.gmail.com', priority: 10 }])

      const result = await EmailValidationService.validateEmail('test@gmail.com')

      expect(result.isValid).toBe(true)
      expect(result.status).toBe('valid')
      expect(result.free).toBe(true)
    })

    it('should handle domains without MX records', async () => {
      mockDns.resolveMx.mockRejectedValue(new Error('NXDOMAIN'))

      const result = await EmailValidationService.validateEmail('test@nonexistent.com')

      expect(result.isValid).toBe(false)
      expect(result.status).toBe('invalid')
      expect(result.reason).toBe('Domain has no MX record')
      expect(result.mx_found).toBe(false)
    })

    it('should flag short usernames on free providers as risky', async () => {
      mockDns.resolveMx.mockResolvedValue([{ exchange: 'mx.gmail.com', priority: 10 }])

      const result = await EmailValidationService.validateEmail('ab@gmail.com')

      expect(result.isValid).toBe(true)
      expect(result.status).toBe('risky')
      expect(result.reason).toBe('Short username on free provider')
    })
  })

  describe('validateEmails', () => {
    it('should validate multiple emails and return summary', async () => {
      mockDns.resolveMx
        .mockResolvedValueOnce([{ exchange: 'mx.example.com', priority: 10 }])
        .mockRejectedValueOnce(new Error('NXDOMAIN'))
        .mockResolvedValueOnce([{ exchange: 'mx.gmail.com', priority: 10 }])

      const emails = ['valid@example.com', 'invalid@nonexistent.com', 'admin@gmail.com']
      const result = await EmailValidationService.validateEmails(emails)

      expect(result.results).toHaveLength(3)
      expect(result.summary.total).toBe(3)
      expect(result.summary.valid).toBe(1)
      expect(result.summary.invalid).toBe(1)
      expect(result.summary.risky).toBe(1)
    })

    it('should process emails in batches', async () => {
      mockDns.resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }])

      const emails = Array.from({ length: 25 }, (_, i) => `test${i}@example.com`)
      const result = await EmailValidationService.validateEmails(emails)

      expect(result.results).toHaveLength(25)
      expect(result.summary.total).toBe(25)
    })
  })

  describe('normalizeEmail', () => {
    it('should normalize email to lowercase', () => {
      const result = EmailValidationService.normalizeEmail('TEST@EXAMPLE.COM')
      expect(result).toBe('test@example.com')
    })

    it('should trim whitespace', () => {
      const result = EmailValidationService.normalizeEmail('  test@example.com  ')
      expect(result).toBe('test@example.com')
    })

    it('should remove dots from Gmail addresses', () => {
      const result = EmailValidationService.normalizeEmail('test.user@gmail.com')
      expect(result).toBe('testuser@gmail.com')
    })

    it('should remove plus aliases from Gmail addresses', () => {
      const result = EmailValidationService.normalizeEmail('test+alias@gmail.com')
      expect(result).toBe('test@gmail.com')
    })

    it('should handle Gmail normalization with both dots and plus', () => {
      const result = EmailValidationService.normalizeEmail('test.user+alias@gmail.com')
      expect(result).toBe('testuser@gmail.com')
    })

    it('should not modify non-Gmail addresses', () => {
      const result = EmailValidationService.normalizeEmail('test.user@example.com')
      expect(result).toBe('test.user@example.com')
    })
  })

  describe('suggestCorrections', () => {
    it('should suggest corrections for common typos', () => {
      const suggestions = EmailValidationService.suggestCorrections('test@gmai.com')
      expect(suggestions).toContain('test@gmail.com')
    })

    it('should suggest adding .com for missing TLD', () => {
      const suggestions = EmailValidationService.suggestCorrections('test@example')
      expect(suggestions).toContain('test@example.com')
    })

    it('should return empty array for correct emails', () => {
      const suggestions = EmailValidationService.suggestCorrections('test@gmail.com')
      expect(suggestions).toHaveLength(0)
    })

    it('should handle multiple correction types', () => {
      const suggestions = EmailValidationService.suggestCorrections('test@gmial.co')
      expect(suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('getEmailProvider', () => {
    it('should identify free providers', () => {
      const result = EmailValidationService.getEmailProvider('test@gmail.com')
      expect(result.type).toBe('free')
      expect(result.provider).toBe('gmail.com')
    })

    it('should identify business providers', () => {
      const result = EmailValidationService.getEmailProvider('test@company.com')
      expect(result.type).toBe('business')
      expect(result.provider).toBe('company.com')
    })

    it('should identify education providers', () => {
      const result = EmailValidationService.getEmailProvider('test@university.edu')
      expect(result.type).toBe('education')
      expect(result.provider).toBe('university.edu')
    })

    it('should identify government providers', () => {
      const result = EmailValidationService.getEmailProvider('test@agency.gov')
      expect(result.type).toBe('government')
      expect(result.provider).toBe('agency.gov')
    })

    it('should handle invalid email format', () => {
      const result = EmailValidationService.getEmailProvider('invalid-email')
      expect(result.type).toBe('unknown')
      expect(result.provider).toBe('unknown')
    })
  })
})