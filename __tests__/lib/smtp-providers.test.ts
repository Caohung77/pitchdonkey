import {
  SMTPService,
  IMAPService,
  SMTP_PROVIDERS
} from '../../lib/smtp-providers'

// Mock nodemailer
const mockTransporter = {
  verify: jest.fn(),
  sendMail: jest.fn(),
}

jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => mockTransporter),
}))

// Mock net module for connectivity tests
const mockSocket = {
  on: jest.fn(),
  destroy: jest.fn(),
}

jest.mock('net', () => ({
  createConnection: jest.fn(() => mockSocket),
}))

describe('SMTPService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateConfig', () => {
    it('should validate correct SMTP configuration', () => {
      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = SMTPService.validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject configuration with missing host', () => {
      const config = {
        host: '',
        port: 587,
        secure: false,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = SMTPService.validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('SMTP host is required')
    })

    it('should reject configuration with invalid port', () => {
      const config = {
        host: 'smtp.gmail.com',
        port: 70000,
        secure: false,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = SMTPService.validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid SMTP port (1-65535) is required')
    })

    it('should reject configuration with missing username', () => {
      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: '',
        password: 'password123',
      }

      const result = SMTPService.validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Username is required')
    })

    it('should reject configuration with missing password', () => {
      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: 'test@gmail.com',
        password: '',
      }

      const result = SMTPService.validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password is required')
    })

    it('should validate port/security combinations', () => {
      const config465SSL = {
        host: 'smtp.gmail.com',
        port: 465,
        secure: false,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result465 = SMTPService.validateConfig(config465SSL)
      expect(result465.isValid).toBe(false)
      expect(result465.errors).toContain('Port 465 typically requires SSL/TLS to be enabled')

      const config587TLS = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: true,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result587 = SMTPService.validateConfig(config587TLS)
      expect(result587.isValid).toBe(false)
      expect(result587.errors).toContain('Port 587 typically uses STARTTLS (SSL/TLS disabled)')
    })

    it('should validate email format in username', () => {
      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: 'invalid-email',
        password: 'password123',
      }

      const result = SMTPService.validateConfig(config)
      expect(result.isValid).toBe(true) // Username doesn't have to be email format
    })
  })

  describe('testConnection', () => {
    it('should test SMTP connection successfully', async () => {
      // Mock successful connectivity test
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setTimeout(callback, 10)
        }
      })

      // Mock successful SMTP verification
      mockTransporter.verify.mockResolvedValue(true)

      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = await SMTPService.testConnection(config)
      expect(result.success).toBe(true)
      expect(result.message).toBe('SMTP connection successful')
    })

    it('should handle SMTP authentication failure', async () => {
      // Mock successful connectivity test
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setTimeout(callback, 10)
        }
      })

      // Mock authentication failure
      const authError = new Error('Authentication failed')
      authError.code = 'EAUTH'
      mockTransporter.verify.mockRejectedValue(authError)

      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: 'test@gmail.com',
        password: 'wrongpassword',
      }

      const result = await SMTPService.testConnection(config)
      expect(result.success).toBe(false)
      expect(result.message).toBe('Authentication failed. Please check your username and password.')
    })

    it('should handle connection timeout', async () => {
      // Mock timeout
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'timeout') {
          setTimeout(callback, 10)
        }
      })

      const config = {
        host: 'unreachable.host.com',
        port: 587,
        secure: false,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = await SMTPService.testConnection(config)
      expect(result.success).toBe(false)
      expect(result.message).toBe('Connection timed out')
    })
  })

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      const mockInfo = {
        messageId: '<test@example.com>',
        accepted: ['test@example.com'],
        rejected: [],
      }

      mockTransporter.sendMail.mockResolvedValue(mockInfo)

      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: 'sender@gmail.com',
        password: 'password123',
      }

      const result = await SMTPService.sendTestEmail(config, 'test@example.com')
      expect(result.success).toBe(true)
      expect(result.message).toBe('Test email sent successfully')
      expect(result.messageId).toBe('<test@example.com>')
    })

    it('should handle test email send failure', async () => {
      const sendError = new Error('Send failed')
      mockTransporter.sendMail.mockRejectedValue(sendError)

      const config = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        username: 'sender@gmail.com',
        password: 'password123',
      }

      const result = await SMTPService.sendTestEmail(config, 'test@example.com')
      expect(result.success).toBe(false)
      expect(result.message).toBe('Send failed')
    })
  })

  describe('getProviderTemplate', () => {
    it('should return Gmail provider template', () => {
      const provider = SMTPService.getProviderTemplate('gmail')
      expect(provider).toBeDefined()
      expect(provider?.id).toBe('gmail')
      expect(provider?.name).toBe('Gmail')
      expect(provider?.smtp.host).toBe('smtp.gmail.com')
    })

    it('should return null for unknown provider', () => {
      const provider = SMTPService.getProviderTemplate('unknown')
      expect(provider).toBeNull()
    })
  })

  describe('detectProvider', () => {
    it('should detect Gmail from host', () => {
      const provider = SMTPService.detectProvider('smtp.gmail.com')
      expect(provider?.id).toBe('gmail')
    })

    it('should detect Outlook from host', () => {
      const provider = SMTPService.detectProvider('smtp-mail.outlook.com')
      expect(provider?.id).toBe('outlook')
    })

    it('should detect provider from partial host match', () => {
      const provider = SMTPService.detectProvider('mail.gmail.com')
      expect(provider?.id).toBe('gmail')
    })

    it('should return null for unknown host', () => {
      const provider = SMTPService.detectProvider('unknown.smtp.com')
      expect(provider).toBeNull()
    })
  })
})

describe('IMAPService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateConfig', () => {
    it('should validate correct IMAP configuration', () => {
      const config = {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = IMAPService.validateConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject configuration with missing host', () => {
      const config = {
        host: '',
        port: 993,
        secure: true,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = IMAPService.validateConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('IMAP host is required')
    })

    it('should validate IMAP port/security combinations', () => {
      const config993NoSSL = {
        host: 'imap.gmail.com',
        port: 993,
        secure: false,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result993 = IMAPService.validateConfig(config993NoSSL)
      expect(result993.isValid).toBe(false)
      expect(result993.errors).toContain('Port 993 typically requires SSL/TLS to be enabled')

      const config143SSL = {
        host: 'imap.gmail.com',
        port: 143,
        secure: true,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result143 = IMAPService.validateConfig(config143SSL)
      expect(result143.isValid).toBe(false)
      expect(result143.errors).toContain('Port 143 typically uses STARTTLS (SSL/TLS disabled)')
    })
  })

  describe('testConnection', () => {
    it('should test IMAP connection (basic connectivity)', async () => {
      // Mock successful connectivity test
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'connect') {
          setTimeout(callback, 10)
        }
      })

      const config = {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = await IMAPService.testConnection(config)
      expect(result.success).toBe(true)
      expect(result.message).toContain('IMAP connection test passed')
    })

    it('should handle IMAP connection failure', async () => {
      // Mock connection failure
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 10)
        }
      })

      const config = {
        host: 'unreachable.imap.com',
        port: 993,
        secure: true,
        username: 'test@gmail.com',
        password: 'password123',
      }

      const result = await IMAPService.testConnection(config)
      expect(result.success).toBe(false)
      expect(result.message).toContain('Connection failed')
    })
  })
})

describe('SMTP_PROVIDERS', () => {
  it('should contain Gmail provider', () => {
    const gmail = SMTP_PROVIDERS.find(p => p.id === 'gmail')
    expect(gmail).toBeDefined()
    expect(gmail?.name).toBe('Gmail')
    expect(gmail?.smtp.host).toBe('smtp.gmail.com')
    expect(gmail?.smtp.port).toBe(587)
    expect(gmail?.smtp.secure).toBe(false)
  })

  it('should contain Outlook provider', () => {
    const outlook = SMTP_PROVIDERS.find(p => p.id === 'outlook')
    expect(outlook).toBeDefined()
    expect(outlook?.name).toBe('Outlook/Hotmail')
    expect(outlook?.smtp.host).toBe('smtp-mail.outlook.com')
  })

  it('should contain Yahoo provider', () => {
    const yahoo = SMTP_PROVIDERS.find(p => p.id === 'yahoo')
    expect(yahoo).toBeDefined()
    expect(yahoo?.name).toBe('Yahoo Mail')
    expect(yahoo?.smtp.host).toBe('smtp.mail.yahoo.com')
  })

  it('should contain SendGrid provider', () => {
    const sendgrid = SMTP_PROVIDERS.find(p => p.id === 'sendgrid')
    expect(sendgrid).toBeDefined()
    expect(sendgrid?.name).toBe('SendGrid')
    expect(sendgrid?.smtp.host).toBe('smtp.sendgrid.net')
  })

  it('should contain Mailgun provider', () => {
    const mailgun = SMTP_PROVIDERS.find(p => p.id === 'mailgun')
    expect(mailgun).toBeDefined()
    expect(mailgun?.name).toBe('Mailgun')
    expect(mailgun?.smtp.host).toBe('smtp.mailgun.org')
  })

  it('should contain custom provider', () => {
    const custom = SMTP_PROVIDERS.find(p => p.id === 'custom')
    expect(custom).toBeDefined()
    expect(custom?.name).toBe('Custom SMTP')
    expect(custom?.smtp.host).toBe('')
  })

  it('should have setup instructions for all providers', () => {
    SMTP_PROVIDERS.forEach(provider => {
      expect(provider.setupInstructions).toBeDefined()
      expect(Array.isArray(provider.setupInstructions)).toBe(true)
      expect(provider.setupInstructions.length).toBeGreaterThan(0)
    })
  })

  it('should have IMAP configuration for email providers', () => {
    const emailProviders = SMTP_PROVIDERS.filter(p => 
      ['gmail', 'outlook', 'yahoo'].includes(p.id)
    )

    emailProviders.forEach(provider => {
      expect(provider.imap).toBeDefined()
      expect(provider.imap?.host).toBeTruthy()
      expect(provider.imap?.port).toBeGreaterThan(0)
      expect(typeof provider.imap?.secure).toBe('boolean')
    })
  })
})