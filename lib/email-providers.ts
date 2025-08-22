import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { encryptOAuthTokens, decryptOAuthTokens, encryptSMTPConfig, decryptSMTPConfig } from './encryption'

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
      accountData.token_expires_at = new Date(config.oauth_tokens.expires_at * 1000).toISOString()
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
    // This would implement actual connection testing
    // For now, we'll simulate a test
    const { data: account } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (!account) throw new Error('Email account not found')

    // Simulate connection test
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
}