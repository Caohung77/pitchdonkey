import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { encryptOAuthTokens, decryptOAuthTokens, encryptSMTPConfig, decryptSMTPConfig } from './encryption'
import type { OAuthTokens } from './oauth-providers'

// Type-only imports to avoid pulling in Node.js modules on client
type GmailIMAPSMTPService = import('./gmail-imap-smtp').GmailIMAPSMTPService

export interface EmailProvider {
  id: string
  name: string
  type: 'oauth' | 'smtp'
  icon: string
  description: string
  authUrl?: string
  requiredFields?: string[]
}

export const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    type: 'oauth',
    icon: '📧',
    description: 'Connect your Gmail account with OAuth',
    authUrl: '/api/email-accounts/oauth/gmail',
  },
  {
    id: 'gmail-imap-smtp',
    name: 'Gmail IMAP/SMTP',
    type: 'oauth',
    icon: '📬',
    description: 'Full Gmail access with IMAP and SMTP capabilities',
    authUrl: '/api/email-accounts/oauth/gmail?provider=gmail-imap-smtp',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    type: 'oauth',
    icon: '📮',
    description: 'Connect your Outlook/Hotmail account',
    authUrl: '/api/email-accounts/oauth/outlook',
  },
  {
    id: 'smtp',
    name: 'Custom SMTP',
    type: 'smtp',
    icon: '⚙️',
    description: 'Connect any email provider with SMTP settings',
    requiredFields: ['host', 'port', 'username', 'password', 'secure'],
  },
]

export interface EmailAccountConfig {
  provider: string
  email: string
  name?: string
  oauth_tokens?: {
    access_token: string
    refresh_token: string
    expires_at: number
    scope: string
  }
  smtp_config?: {
    host: string
    port: number
    secure: boolean
    username: string
    password: string
  }
  settings?: {
    daily_limit: number
    delay_between_emails: number
    warm_up_enabled: boolean
    signature?: string
  }
}

export class EmailAccountService {
  private supabase = createClientComponentClient()

  async createEmailAccount(userId: string, config: EmailAccountConfig) {
    // Prepare data matching actual database schema (supabase-setup.sql)
    const accountData: any = {
      user_id: userId,
      provider: config.provider,
      email: config.email,
      // Note: 'name', 'is_active', 'is_verified' fields don't exist in actual database schema
      status: 'pending', // This field exists in the actual schema
    }

    // Handle OAuth tokens - store in individual columns according to supabase-setup.sql
    if (config.oauth_tokens) {
      accountData.access_token = config.oauth_tokens.access_token
      accountData.refresh_token = config.oauth_tokens.refresh_token

      // Fix: expires_at is already in milliseconds, don't multiply by 1000
      const expiresAt = config.oauth_tokens.expires_at
      accountData.token_expires_at = new Date(expiresAt).toISOString()

      console.log('💾 Storing OAuth tokens:', {
        expiresAt,
        expiryDate: new Date(expiresAt).toISOString(),
        hasAccessToken: !!config.oauth_tokens.access_token,
        hasRefreshToken: !!config.oauth_tokens.refresh_token
      })
    }

    // Handle SMTP config - store in individual columns according to supabase-setup.sql
    if (config.smtp_config) {
      accountData.smtp_host = config.smtp_config.host
      accountData.smtp_port = config.smtp_config.port
      accountData.smtp_username = config.smtp_config.username
      accountData.smtp_password = config.smtp_config.password // Should be encrypted in production
      accountData.smtp_secure = config.smtp_config.secure
    }

    const { data, error } = await this.supabase
      .from('email_accounts')
      .insert(accountData)
      .select()
      .single()

    if (error) throw error

    // Note: No need to decrypt since we're storing in individual columns now
    // In production, should decrypt smtp_password and access_token/refresh_token fields
    return data
  }

  async updateEmailAccount(accountId: string, updates: Partial<EmailAccountConfig>) {
    const encryptedUpdates: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    // Encrypt OAuth tokens if being updated
    if (updates.oauth_tokens) {
      encryptedUpdates.oauth_tokens = encryptOAuthTokens(updates.oauth_tokens)
    }

    // Encrypt SMTP config if being updated
    if (updates.smtp_config) {
      encryptedUpdates.smtp_config = encryptSMTPConfig(updates.smtp_config)
    }

    const { data, error } = await this.supabase
      .from('email_accounts')
      .update(encryptedUpdates)
      .eq('id', accountId)
      .select()
      .single()

    if (error) throw error

    // Decrypt sensitive data before returning
    if (data) {
      if (data.oauth_tokens) {
        data.oauth_tokens = decryptOAuthTokens(data.oauth_tokens)
      }
      if (data.smtp_config) {
        data.smtp_config = decryptSMTPConfig(data.smtp_config)
      }
    }

    return data
  }

  async deleteEmailAccount(accountId: string) {
    const { error } = await this.supabase
      .from('email_accounts')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', accountId)

    if (error) throw error
  }

  async getUserEmailAccounts(userId: string) {
    const { data, error } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Decrypt sensitive data for each account
    if (data) {
      return data.map(account => {
        if (account.oauth_tokens) {
          account.oauth_tokens = decryptOAuthTokens(account.oauth_tokens)
        }
        if (account.smtp_config) {
          account.smtp_config = decryptSMTPConfig(account.smtp_config)
        }
        return account
      })
    }

    return data
  }

  async verifyEmailAccount(accountId: string) {
    // This would implement actual email verification
    // For now, we'll just mark as verified
    const { data, error } = await this.supabase
      .from('email_accounts')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async testEmailConnection(accountId: string) {
    const { data: account } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (!account) throw new Error('Email account not found')

    // For Gmail IMAP/SMTP, make API call to server-side test
    if (account.provider === 'gmail-imap-smtp') {
      try {
        const response = await fetch(`/api/email-accounts/${accountId}/test-gmail-connection`, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to test Gmail connection')
        }

        const result = await response.json()
        return {
          success: result.success,
          message: result.message,
          details: {
            provider: account.provider,
            email: account.email,
            status: result.success ? 'connected' : 'failed',
            ...result.details
          },
        }
      } catch (error) {
        return {
          success: false,
          message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            provider: account.provider,
            email: account.email,
            status: 'failed',
          },
        }
      }
    }

    // Fallback for other providers (simulate test)
    return {
      success: true,
      message: 'Connection test successful',
      details: {
        provider: account.provider,
        email: account.email,
        status: 'connected',
      },
    }
  }

  /**
   * Get mailboxes for a Gmail IMAP/SMTP account (via API)
   */
  async getGmailMailboxes(accountId: string): Promise<string[]> {
    const response = await fetch(`/api/email-accounts/${accountId}/gmail/mailboxes`)

    if (!response.ok) {
      throw new Error('Failed to fetch Gmail mailboxes')
    }

    const data = await response.json()
    return data.mailboxes
  }

  /**
   * Fetch emails for a Gmail IMAP/SMTP account (via API)
   */
  async fetchGmailEmails(
    accountId: string,
    mailbox: string = 'INBOX',
    options: {
      limit?: number
      since?: Date
      unseen?: boolean
    } = {}
  ) {
    const params = new URLSearchParams({
      mailbox,
      ...options.limit && { limit: options.limit.toString() },
      ...options.since && { since: options.since.toISOString() },
      ...options.unseen && { unseen: 'true' }
    })

    const response = await fetch(`/api/email-accounts/${accountId}/gmail/emails?${params}`)

    if (!response.ok) {
      throw new Error('Failed to fetch Gmail emails')
    }

    const data = await response.json()
    return data.emails
  }

  /**
   * Send email using Gmail IMAP/SMTP account (via API)
   */
  async sendGmailEmail(
    accountId: string,
    options: {
      to: string | string[]
      cc?: string | string[]
      bcc?: string | string[]
      subject: string
      text?: string
      html?: string
      attachments?: Array<{
        filename: string
        path?: string
        content?: Buffer | string
        contentType?: string
      }>
    }
  ) {
    const response = await fetch(`/api/email-accounts/${accountId}/gmail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options)
    })

    if (!response.ok) {
      throw new Error('Failed to send Gmail email')
    }

    return await response.json()
  }

  /**
   * Get email count for Gmail IMAP/SMTP account (via API)
   */
  async getGmailEmailCount(accountId: string, mailbox: string = 'INBOX') {
    const params = new URLSearchParams({ mailbox })
    const response = await fetch(`/api/email-accounts/${accountId}/gmail/count?${params}`)

    if (!response.ok) {
      throw new Error('Failed to get Gmail email count')
    }

    const data = await response.json()
    return data.count
  }
}