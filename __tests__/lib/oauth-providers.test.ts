import {
  GoogleOAuthService,
  MicrosoftOAuthService,
  OAuthTokenManager,
  generateOAuthState,
  parseOAuthState,
  validateOAuthState,
  OAUTH_PROVIDERS
} from '../../lib/oauth-providers'

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?mock=true'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            expiry_date: Date.now() + 3600000,
            scope: 'https://www.googleapis.com/auth/gmail.send',
            token_type: 'Bearer'
          }
        }),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new_access_token',
            refresh_token: 'mock_refresh_token',
            expiry_date: Date.now() + 3600000,
            scope: 'https://www.googleapis.com/auth/gmail.send',
            token_type: 'Bearer'
          }
        })
      }))
    },
    oauth2: jest.fn().mockReturnValue({
      userinfo: {
        get: jest.fn().mockResolvedValue({
          data: {
            email: 'test@gmail.com',
            name: 'Test User'
          }
        })
      }
    }),
    gmail: jest.fn().mockReturnValue({
      users: {
        getProfile: jest.fn().mockResolvedValue({
          data: { emailAddress: 'test@gmail.com' }
        })
      }
    })
  }
}))

// Mock Microsoft Graph Client
jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn().mockReturnValue({
      api: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          mail: 'test@outlook.com',
          displayName: 'Test User'
        })
      })
    })
  }
}))

// Mock fetch for Microsoft OAuth
global.fetch = jest.fn()

describe('GoogleOAuthService', () => {
  let googleService: GoogleOAuthService

  beforeEach(() => {
    googleService = new GoogleOAuthService()
    jest.clearAllMocks()
  })

  describe('generateAuthUrl', () => {
    it('should generate OAuth authorization URL', () => {
      const state = 'test-state'
      const authUrl = googleService.generateAuthUrl(state)
      
      expect(authUrl).toBe('https://accounts.google.com/oauth/authorize?mock=true')
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'auth_code_123'
      const tokens = await googleService.exchangeCodeForTokens(code)

      expect(tokens).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: expect.any(Number),
        scope: 'https://www.googleapis.com/auth/gmail.send',
        token_type: 'Bearer'
      })
    })

    it('should throw error on token exchange failure', async () => {
      const mockOAuth2 = require('googleapis').google.auth.OAuth2
      const mockInstance = new mockOAuth2()
      mockInstance.getToken.mockRejectedValue(new Error('Token exchange failed'))

      await expect(googleService.exchangeCodeForTokens('invalid_code'))
        .rejects.toThrow('Failed to exchange authorization code for tokens')
    })
  })

  describe('refreshTokens', () => {
    it('should refresh access tokens', async () => {
      const refreshToken = 'refresh_token_123'
      const tokens = await googleService.refreshTokens(refreshToken)

      expect(tokens).toEqual({
        access_token: 'new_access_token',
        refresh_token: 'refresh_token_123',
        expires_at: expect.any(Number),
        scope: 'https://www.googleapis.com/auth/gmail.send',
        token_type: 'Bearer'
      })
    })
  })

  describe('getUserInfo', () => {
    it('should get user information', async () => {
      const accessToken = 'access_token_123'
      const userInfo = await googleService.getUserInfo(accessToken)

      expect(userInfo).toEqual({
        email: 'test@gmail.com',
        name: 'Test User'
      })
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const tokens = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: Date.now() + 3600000,
        scope: 'gmail.send'
      }

      const result = await googleService.testConnection(tokens)
      expect(result).toBe(true)
    })

    it('should return false on connection failure', async () => {
      const mockGmail = require('googleapis').google.gmail
      const mockInstance = mockGmail()
      mockInstance.users.getProfile.mockRejectedValue(new Error('Connection failed'))

      const tokens = {
        access_token: 'invalid_token',
        refresh_token: 'refresh_token',
        expires_at: Date.now() + 3600000,
        scope: 'gmail.send'
      }

      const result = await googleService.testConnection(tokens)
      expect(result).toBe(false)
    })
  })
})

describe('MicrosoftOAuthService', () => {
  let microsoftService: MicrosoftOAuthService

  beforeEach(() => {
    microsoftService = new MicrosoftOAuthService()
    jest.clearAllMocks()
    
    // Mock successful token exchange
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        scope: 'https://graph.microsoft.com/Mail.Send',
        token_type: 'Bearer'
      })
    })
  })

  describe('generateAuthUrl', () => {
    it('should generate OAuth authorization URL', () => {
      const state = 'test-state'
      const authUrl = microsoftService.generateAuthUrl(state)
      
      expect(authUrl).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
      expect(authUrl).toContain(`state=${state}`)
      expect(authUrl).toContain('client_id=')
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'auth_code_123'
      const tokens = await microsoftService.exchangeCodeForTokens(code)

      expect(tokens).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: expect.any(Number),
        scope: 'https://graph.microsoft.com/Mail.Send',
        token_type: 'Bearer'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      )
    })

    it('should throw error on token exchange failure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Token exchange failed')
      })

      await expect(microsoftService.exchangeCodeForTokens('invalid_code'))
        .rejects.toThrow('Failed to exchange authorization code for tokens')
    })
  })

  describe('refreshTokens', () => {
    it('should refresh access tokens', async () => {
      const refreshToken = 'refresh_token_123'
      const tokens = await microsoftService.refreshTokens(refreshToken)

      expect(tokens).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'refresh_token_123',
        expires_at: expect.any(Number),
        scope: 'https://graph.microsoft.com/Mail.Send',
        token_type: 'Bearer'
      })
    })
  })

  describe('getUserInfo', () => {
    it('should get user information', async () => {
      const accessToken = 'access_token_123'
      const userInfo = await microsoftService.getUserInfo(accessToken)

      expect(userInfo).toEqual({
        email: 'test@outlook.com',
        name: 'Test User'
      })
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const tokens = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: Date.now() + 3600000,
        scope: 'mail.send'
      }

      const result = await microsoftService.testConnection(tokens)
      expect(result).toBe(true)
    })
  })
})

describe('OAuthTokenManager', () => {
  describe('isTokenExpired', () => {
    it('should return true for expired tokens', async () => {
      const expiredTokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() - 1000, // Expired 1 second ago
        scope: 'scope'
      }

      const isExpired = await OAuthTokenManager.isTokenExpired(expiredTokens)
      expect(isExpired).toBe(true)
    })

    it('should return false for valid tokens', async () => {
      const validTokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000, // Expires in 1 hour
        scope: 'scope'
      }

      const isExpired = await OAuthTokenManager.isTokenExpired(validTokens)
      expect(isExpired).toBe(false)
    })

    it('should return true for tokens expiring within buffer time', async () => {
      const soonToExpireTokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 60000, // Expires in 1 minute (within 5 minute buffer)
        scope: 'scope'
      }

      const isExpired = await OAuthTokenManager.isTokenExpired(soonToExpireTokens)
      expect(isExpired).toBe(true)
    })
  })

  describe('validateTokens', () => {
    it('should validate Gmail tokens', async () => {
      const tokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
        scope: 'scope'
      }

      const isValid = await OAuthTokenManager.validateTokens('gmail', tokens)
      expect(isValid).toBe(true)
    })

    it('should validate Outlook tokens', async () => {
      const tokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
        scope: 'scope'
      }

      const isValid = await OAuthTokenManager.validateTokens('outlook', tokens)
      expect(isValid).toBe(true)
    })

    it('should return false for invalid provider', async () => {
      const tokens = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600000,
        scope: 'scope'
      }

      const isValid = await OAuthTokenManager.validateTokens('invalid' as any, tokens)
      expect(isValid).toBe(false)
    })
  })
})

describe('OAuth State Management', () => {
  describe('generateOAuthState', () => {
    it('should generate valid state parameter', () => {
      const userId = 'user-123'
      const provider = 'gmail'
      const state = generateOAuthState(userId, provider)

      expect(state).toBeDefined()
      expect(typeof state).toBe('string')
      expect(state.length).toBeGreaterThan(0)
    })

    it('should generate different states for different calls', () => {
      const userId = 'user-123'
      const provider = 'gmail'
      const state1 = generateOAuthState(userId, provider)
      const state2 = generateOAuthState(userId, provider)

      expect(state1).not.toBe(state2)
    })
  })

  describe('parseOAuthState', () => {
    it('should parse valid state parameter', () => {
      const userId = 'user-123'
      const provider = 'gmail'
      const state = generateOAuthState(userId, provider)
      const parsed = parseOAuthState(state)

      expect(parsed.userId).toBe(userId)
      expect(parsed.provider).toBe(provider)
      expect(parsed.timestamp).toBeGreaterThan(0)
    })

    it('should throw error for invalid state', () => {
      expect(() => parseOAuthState('invalid-state'))
        .toThrow('Invalid OAuth state parameter')
    })
  })

  describe('validateOAuthState', () => {
    it('should validate recent state', () => {
      const userId = 'user-123'
      const provider = 'gmail'
      const state = generateOAuthState(userId, provider)
      
      const isValid = validateOAuthState(state)
      expect(isValid).toBe(true)
    })

    it('should reject expired state', () => {
      // Create a state with old timestamp
      const oldTimestamp = Date.now() - (15 * 60 * 1000) // 15 minutes ago
      const oldState = Buffer.from(`user-123:gmail:${oldTimestamp}:random`).toString('base64')
      
      const isValid = validateOAuthState(oldState, 10 * 60 * 1000) // 10 minute max age
      expect(isValid).toBe(false)
    })

    it('should reject invalid state format', () => {
      const isValid = validateOAuthState('invalid-state')
      expect(isValid).toBe(false)
    })
  })
})

describe('OAUTH_PROVIDERS', () => {
  it('should have Gmail configuration', () => {
    expect(OAUTH_PROVIDERS.gmail).toBeDefined()
    expect(OAUTH_PROVIDERS.gmail.id).toBe('gmail')
    expect(OAUTH_PROVIDERS.gmail.name).toBe('Gmail')
    expect(OAUTH_PROVIDERS.gmail.scopes).toContain('https://www.googleapis.com/auth/gmail.send')
  })

  it('should have Outlook configuration', () => {
    expect(OAUTH_PROVIDERS.outlook).toBeDefined()
    expect(OAUTH_PROVIDERS.outlook.id).toBe('outlook')
    expect(OAUTH_PROVIDERS.outlook.name).toBe('Outlook')
    expect(OAUTH_PROVIDERS.outlook.scopes).toContain('https://graph.microsoft.com/Mail.Send')
  })
})