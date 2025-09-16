import { google } from 'googleapis'
import { Client } from '@microsoft/microsoft-graph-client'
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client'
import { encryptOAuthTokens, decryptOAuthTokens } from './encryption'

export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  scope: string
  token_type?: string
}

export interface OAuthProvider {
  id: string
  name: string
  authUrl: string
  scopes: string[]
  clientId: string
  clientSecret: string
}

// OAuth configuration
export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: [
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/User.Read'
    ],
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || ''
  }
}

export class GoogleOAuthService {
  private oauth2Client: any

  constructor(redirectBase?: string) {
    const defaultBase = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const redirectUri = `${redirectBase || defaultBase}/api/email-accounts/oauth/gmail/callback`
    this.oauth2Client = new google.auth.OAuth2(
      OAUTH_PROVIDERS.gmail.clientId,
      OAUTH_PROVIDERS.gmail.clientSecret,
      redirectUri
    )
  }

  generateAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: OAUTH_PROVIDERS.gmail.scopes,
      state,
      prompt: 'consent', // Force consent to get refresh token
      include_granted_scopes: true
    })
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code)
      
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date || Date.now() + 3600000,
        scope: tokens.scope || OAUTH_PROVIDERS.gmail.scopes.join(' '),
        token_type: tokens.token_type || 'Bearer'
      }
    } catch (error) {
      console.error('Google OAuth token exchange error:', error)
      throw new Error('Failed to exchange authorization code for tokens')
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      })

      const { credentials } = await this.oauth2Client.refreshAccessToken()
      
      return {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken,
        expires_at: credentials.expiry_date || Date.now() + 3600000,
        scope: credentials.scope || OAUTH_PROVIDERS.gmail.scopes.join(' '),
        token_type: credentials.token_type || 'Bearer'
      }
    } catch (error) {
      console.error('Google OAuth token refresh error:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  async getUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      })

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
      const { data } = await oauth2.userinfo.get()

      return {
        email: data.email || '',
        name: data.name || ''
      }
    } catch (error) {
      console.error('Google user info error:', error)
      throw new Error('Failed to get user information')
    }
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      })

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
      await gmail.users.getProfile({ userId: 'me' })
      
      return true
    } catch (error) {
      console.error('Gmail connection test error:', error)
      return false
    }
  }
}

export class MicrosoftOAuthService {
  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientId = OAUTH_PROVIDERS.outlook.clientId
    this.clientSecret = OAUTH_PROVIDERS.outlook.clientSecret
    this.redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'}/api/email-accounts/oauth/outlook/callback`
  }

  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: OAUTH_PROVIDERS.outlook.scopes.join(' '),
      state,
      response_mode: 'query',
      prompt: 'consent'
    })

    return `${OAUTH_PROVIDERS.outlook.authUrl}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    try {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        scope: OAUTH_PROVIDERS.outlook.scopes.join(' ')
      })

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Token exchange failed: ${error}`)
      }

      const data = await response.json()
      
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
        token_type: data.token_type || 'Bearer'
      }
    } catch (error) {
      console.error('Microsoft OAuth token exchange error:', error)
      throw new Error('Failed to exchange authorization code for tokens')
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    try {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: OAUTH_PROVIDERS.outlook.scopes.join(' ')
      })

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Token refresh failed: ${error}`)
      }

      const data = await response.json()
      
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_at: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
        token_type: data.token_type || 'Bearer'
      }
    } catch (error) {
      console.error('Microsoft OAuth token refresh error:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  async getUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
    try {
      const graphClient = Client.init({
        authProvider: {
          getAccessToken: async () => accessToken
        } as any
      })

      const user = await graphClient.api('/me').get()
      
      return {
        email: user.mail || user.userPrincipalName || '',
        name: user.displayName || ''
      }
    } catch (error) {
      console.error('Microsoft user info error:', error)
      throw new Error('Failed to get user information')
    }
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      const graphClient = Client.init({
        authProvider: {
          getAccessToken: async () => tokens.access_token
        } as any
      })

      await graphClient.api('/me').get()
      return true
    } catch (error) {
      console.error('Microsoft connection test error:', error)
      return false
    }
  }
}

export class OAuthTokenManager {
  static async isTokenExpired(tokens: OAuthTokens): Promise<boolean> {
    const now = Date.now()
    const buffer = 5 * 60 * 1000 // 5 minutes buffer
    return tokens.expires_at <= (now + buffer)
  }

  static async refreshTokensIfNeeded(
    provider: 'gmail' | 'outlook',
    tokens: OAuthTokens
  ): Promise<OAuthTokens> {
    if (!(await this.isTokenExpired(tokens))) {
      return tokens
    }

    if (provider === 'gmail') {
      const googleService = new GoogleOAuthService()
      return await googleService.refreshTokens(tokens.refresh_token)
    } else if (provider === 'outlook') {
      const microsoftService = new MicrosoftOAuthService()
      return await microsoftService.refreshTokens(tokens.refresh_token)
    }

    throw new Error(`Unsupported provider: ${provider}`)
  }

  static async validateTokens(
    provider: 'gmail' | 'outlook',
    tokens: OAuthTokens
  ): Promise<boolean> {
    try {
      // Refresh tokens if needed
      const validTokens = await this.refreshTokensIfNeeded(provider, tokens)
      
      if (provider === 'gmail') {
        const googleService = new GoogleOAuthService()
        return await googleService.testConnection(validTokens)
      } else if (provider === 'outlook') {
        const microsoftService = new MicrosoftOAuthService()
        return await microsoftService.testConnection(validTokens)
      }

      return false
    } catch (error) {
      console.error('Token validation error:', error)
      return false
    }
  }

  static encryptTokens(tokens: OAuthTokens): string {
    return encryptOAuthTokens(tokens)
  }

  static decryptTokens(encryptedTokens: string): OAuthTokens {
    return decryptOAuthTokens(encryptedTokens)
  }
}

// Utility functions for OAuth flows
export const generateOAuthState = (userId: string, provider: string): string => {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substring(2)
  return Buffer.from(`${userId}:${provider}:${timestamp}:${random}`).toString('base64')
}

export const parseOAuthState = (state: string): { userId: string; provider: string; timestamp: number } => {
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8')
    const [userId, provider, timestamp] = decoded.split(':')
    
    return {
      userId,
      provider,
      timestamp: parseInt(timestamp)
    }
  } catch (error) {
    throw new Error('Invalid OAuth state parameter')
  }
}

export const validateOAuthState = (state: string, maxAge: number = 10 * 60 * 1000): boolean => {
  try {
    const { timestamp } = parseOAuthState(state)
    const now = Date.now()
    
    return (now - timestamp) <= maxAge
  } catch (error) {
    return false
  }
}
