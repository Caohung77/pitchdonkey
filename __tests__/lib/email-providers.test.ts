import { EmailAccountService, EmailProvider, EMAIL_PROVIDERS } from '../../lib/email-providers'
import { EncryptionService } from '../../lib/encryption'

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn()
        }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
}

// Mock the createRouteHandlerClient
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => mockSupabase
}))

// Mock cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

describe('EmailAccountService', () => {
  let emailService: EmailAccountService
  const mockUserId = 'user-123'

  beforeEach(() => {
    emailService = new EmailAccountService()
    jest.clearAllMocks()
  })

  describe('createEmailAccount', () => {
    it('should create an email account with OAuth tokens', async () => {
      const mockConfig = {
        provider: 'gmail' as const,
        email: 'test@gmail.com',
        name: 'Test Account',
        oauth_tokens: {
          access_token: 'access_token_123',
          refresh_token: 'refresh_token_123',
          expires_at: Date.now() + 3600000,
          scope: 'https://www.googleapis.com/auth/gmail.send'
        }
      }

      const mockResponse = {
        id: 'account-123',
        ...mockConfig,
        user_id: mockUserId,
        is_active: true,
        is_verified: false
      }

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockResponse,
        error: null
      })

      const result = await emailService.createEmailAccount(mockUserId, mockConfig)

      expect(mockSupabase.from).toHaveBeenCalledWith('email_accounts')
      expect(result).toEqual(mockResponse)
    })

    it('should create an email account with SMTP config', async () => {
      const mockConfig = {
        provider: 'smtp' as const,
        email: 'test@example.com',
        name: 'SMTP Account',
        smtp_config: {
          host: 'smtp.example.com',
          port: 587,
          secure: true,
          username: 'test@example.com',
          password: 'password123'
        }
      }

      const mockResponse = {
        id: 'account-456',
        ...mockConfig,
        user_id: mockUserId,
        is_active: true,
        is_verified: false
      }

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockResponse,
        error: null
      })

      const result = await emailService.createEmailAccount(mockUserId, mockConfig)

      expect(result).toEqual(mockResponse)
    })

    it('should throw error when database operation fails', async () => {
      const mockConfig = {
        provider: 'gmail' as const,
        email: 'test@gmail.com',
        name: 'Test Account'
      }

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      })

      await expect(emailService.createEmailAccount(mockUserId, mockConfig))
        .rejects.toThrow('Database error')
    })
  })

  describe('updateEmailAccount', () => {
    it('should update email account settings', async () => {
      const accountId = 'account-123'
      const updates = {
        name: 'Updated Account Name',
        settings: {
          daily_limit: 100,
          delay_between_emails: 30,
          warm_up_enabled: false
        }
      }

      const mockResponse = {
        id: accountId,
        ...updates,
        updated_at: new Date().toISOString()
      }

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: mockResponse,
        error: null
      })

      const result = await emailService.updateEmailAccount(accountId, updates)

      expect(mockSupabase.from).toHaveBeenCalledWith('email_accounts')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deleteEmailAccount', () => {
    it('should soft delete email account', async () => {
      const accountId = 'account-123'

      mockSupabase.from().update().eq.mockResolvedValue({
        error: null
      })

      await emailService.deleteEmailAccount(accountId)

      expect(mockSupabase.from).toHaveBeenCalledWith('email_accounts')
    })
  })

  describe('getUserEmailAccounts', () => {
    it('should retrieve user email accounts', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          provider: 'gmail',
          email: 'test1@gmail.com',
          name: 'Account 1',
          is_active: true
        },
        {
          id: 'account-2',
          provider: 'outlook',
          email: 'test2@outlook.com',
          name: 'Account 2',
          is_active: true
        }
      ]

      mockSupabase.from().select().eq().eq().order.mockResolvedValue({
        data: mockAccounts,
        error: null
      })

      const result = await emailService.getUserEmailAccounts(mockUserId)

      expect(result).toEqual(mockAccounts)
    })
  })

  describe('verifyEmailAccount', () => {
    it('should mark email account as verified', async () => {
      const accountId = 'account-123'
      const mockResponse = {
        id: accountId,
        is_verified: true,
        verified_at: new Date().toISOString()
      }

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: mockResponse,
        error: null
      })

      const result = await emailService.verifyEmailAccount(accountId)

      expect(result.is_verified).toBe(true)
      expect(result.verified_at).toBeDefined()
    })
  })

  describe('testEmailConnection', () => {
    it('should test email connection successfully', async () => {
      const accountId = 'account-123'
      const mockAccount = {
        id: accountId,
        provider: 'gmail',
        email: 'test@gmail.com'
      }

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockAccount,
        error: null
      })

      const result = await emailService.testEmailConnection(accountId)

      expect(result.success).toBe(true)
      expect(result.details.provider).toBe('gmail')
    })

    it('should throw error when account not found', async () => {
      const accountId = 'nonexistent-account'

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      })

      await expect(emailService.testEmailConnection(accountId))
        .rejects.toThrow('Email account not found')
    })
  })
})

describe('EMAIL_PROVIDERS', () => {
  it('should contain all required providers', () => {
    expect(EMAIL_PROVIDERS).toHaveLength(3)
    
    const providerIds = EMAIL_PROVIDERS.map(p => p.id)
    expect(providerIds).toContain('gmail')
    expect(providerIds).toContain('outlook')
    expect(providerIds).toContain('smtp')
  })

  it('should have correct provider configurations', () => {
    const gmailProvider = EMAIL_PROVIDERS.find(p => p.id === 'gmail')
    expect(gmailProvider).toBeDefined()
    expect(gmailProvider?.type).toBe('oauth')
    expect(gmailProvider?.authUrl).toBe('/api/email-accounts/oauth/gmail')

    const smtpProvider = EMAIL_PROVIDERS.find(p => p.id === 'smtp')
    expect(smtpProvider).toBeDefined()
    expect(smtpProvider?.type).toBe('smtp')
    expect(smtpProvider?.requiredFields).toContain('host')
    expect(smtpProvider?.requiredFields).toContain('port')
  })
})

describe('EncryptionService', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const originalText = 'sensitive data'
      const encrypted = EncryptionService.encrypt(originalText)
      const decrypted = EncryptionService.decrypt(encrypted)

      expect(encrypted).not.toBe(originalText)
      expect(decrypted).toBe(originalText)
    })

    it('should encrypt and decrypt objects correctly', () => {
      const originalObject = {
        access_token: 'token123',
        refresh_token: 'refresh456',
        expires_at: 1234567890
      }

      const encrypted = EncryptionService.encryptObject(originalObject)
      const decrypted = EncryptionService.decryptObject(encrypted)

      expect(decrypted).toEqual(originalObject)
    })

    it('should throw error for invalid encrypted data', () => {
      expect(() => {
        EncryptionService.decrypt('invalid:encrypted:data')
      }).toThrow('Failed to decrypt data')
    })
  })

  describe('password hashing', () => {
    it('should hash password correctly', () => {
      const password = 'mypassword123'
      const hashed = EncryptionService.hashPassword(password)

      expect(hashed).not.toBe(password)
      expect(hashed).toContain(':')
    })

    it('should verify password correctly', () => {
      const password = 'mypassword123'
      const hashed = EncryptionService.hashPassword(password)

      expect(EncryptionService.verifyPassword(password, hashed)).toBe(true)
      expect(EncryptionService.verifyPassword('wrongpassword', hashed)).toBe(false)
    })
  })

  describe('token generation', () => {
    it('should generate secure tokens', () => {
      const token1 = EncryptionService.generateSecureToken()
      const token2 = EncryptionService.generateSecureToken()

      expect(token1).not.toBe(token2)
      expect(token1).toHaveLength(64) // 32 bytes = 64 hex chars
    })

    it('should generate API keys with prefix', () => {
      const apiKey = EncryptionService.generateApiKey()

      expect(apiKey).toMatch(/^crp_[a-f0-9]{64}$/)
    })
  })
})