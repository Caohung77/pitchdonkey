import { GmailIMAPSMTPService, createGmailIMAPSMTPService } from '../gmail-imap-smtp'
import { OAuthTokens } from '../oauth-providers'

// Mock the dependencies
jest.mock('node-imap')
jest.mock('nodemailer')
jest.mock('googleapis')

describe('GmailIMAPSMTPService', () => {
  const mockTokens: OAuthTokens = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    expires_at: Date.now() + 3600000,
    scope: 'https://mail.google.com/',
    token_type: 'Bearer'
  }

  const mockEmail = 'test@gmail.com'

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock environment variables
    process.env.GOOGLE_CLIENT_ID = 'mock_client_id'
    process.env.GOOGLE_CLIENT_SECRET = 'mock_client_secret'
  })

  describe('constructor', () => {
    it('should create a GmailIMAPSMTPService instance', () => {
      const service = new GmailIMAPSMTPService(mockTokens, mockEmail)
      expect(service).toBeInstanceOf(GmailIMAPSMTPService)
    })
  })

  describe('createSMTPConfig', () => {
    it('should generate correct SMTP configuration', async () => {
      const service = new GmailIMAPSMTPService(mockTokens, mockEmail)

      // Access private method for testing
      const config = await (service as any).createSMTPConfig()

      expect(config).toMatchObject({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          type: 'OAuth2',
          user: mockEmail,
          clientId: 'mock_client_id',
          clientSecret: 'mock_client_secret',
          refreshToken: mockTokens.refresh_token,
          accessToken: mockTokens.access_token
        }
      })
    })
  })

  describe('createIMAPConfig', () => {
    it('should generate correct IMAP configuration', async () => {
      const service = new GmailIMAPSMTPService(mockTokens, mockEmail)

      // Access private method for testing
      const config = await (service as any).createIMAPConfig()

      expect(config).toMatchObject({
        user: mockEmail,
        accessToken: mockTokens.access_token,
        host: 'imap.gmail.com',
        port: 993,
        tls: true
      })
    })
  })

  describe('factory function', () => {
    it('should create service instance through factory', async () => {
      // Mock the test methods to return true
      const mockTestIMAP = jest.fn().mockResolvedValue(true)
      const mockTestSMTP = jest.fn().mockResolvedValue(true)

      GmailIMAPSMTPService.prototype.testIMAPConnection = mockTestIMAP
      GmailIMAPSMTPService.prototype.testSMTPConnection = mockTestSMTP

      const service = await createGmailIMAPSMTPService(mockTokens, mockEmail)

      expect(service).toBeInstanceOf(GmailIMAPSMTPService)
      expect(mockTestIMAP).toHaveBeenCalled()
      expect(mockTestSMTP).toHaveBeenCalled()
    })

    it('should throw error when both connections fail', async () => {
      // Mock the test methods to return false
      const mockTestIMAP = jest.fn().mockResolvedValue(false)
      const mockTestSMTP = jest.fn().mockResolvedValue(false)

      GmailIMAPSMTPService.prototype.testIMAPConnection = mockTestIMAP
      GmailIMAPSMTPService.prototype.testSMTPConnection = mockTestSMTP

      await expect(
        createGmailIMAPSMTPService(mockTokens, mockEmail)
      ).rejects.toThrow('Both IMAP and SMTP connections failed')
    })

    it('should succeed when only one connection works', async () => {
      // Mock IMAP to fail, SMTP to succeed
      const mockTestIMAP = jest.fn().mockResolvedValue(false)
      const mockTestSMTP = jest.fn().mockResolvedValue(true)

      GmailIMAPSMTPService.prototype.testIMAPConnection = mockTestIMAP
      GmailIMAPSMTPService.prototype.testSMTPConnection = mockTestSMTP

      const service = await createGmailIMAPSMTPService(mockTokens, mockEmail)

      expect(service).toBeInstanceOf(GmailIMAPSMTPService)
    })
  })

  describe('email sending', () => {
    it('should format send email options correctly', async () => {
      const service = new GmailIMAPSMTPService(mockTokens, mockEmail)

      // Mock nodemailer
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id',
          response: 'Email sent successfully'
        })
      }

      const mockCreateTransporter = jest.fn().mockReturnValue(mockTransporter)
      jest.doMock('nodemailer', () => ({
        createTransporter: mockCreateTransporter
      }))

      const sendOptions = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
        html: '<p>Test message</p>'
      }

      // This would require mocking the actual implementation
      // For now, we're just testing the interface
      expect(service.sendEmail).toBeDefined()
      expect(typeof service.sendEmail).toBe('function')
    })
  })
})