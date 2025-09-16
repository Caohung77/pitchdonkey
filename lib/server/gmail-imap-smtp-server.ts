// Server-side only Gmail IMAP/SMTP functionality
import { createServerSupabaseClient } from '../supabase'
import { decryptOAuthTokens } from '../encryption'
import type { OAuthTokens } from '../oauth-providers'

// Dynamic imports to ensure Node.js modules are only loaded server-side
async function getGmailService() {
  const { GmailIMAPSMTPService, createGmailIMAPSMTPService } = await import('../gmail-imap-smtp')
  return { GmailIMAPSMTPService, createGmailIMAPSMTPService }
}

export class GmailIMAPSMTPServerService {
  private supabase = createServerSupabaseClient()

  /**
   * Create a Gmail IMAP/SMTP service instance (server-side only)
   */
  async createGmailIMAPSMTPService(accountId: string) {
    const { data: account } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (!account) {
      throw new Error('Email account not found')
    }

    if (account.provider !== 'gmail') {
      throw new Error('Account is not a Gmail account')
    }

    // Check if this Gmail account has IMAP/SMTP capabilities
    // We can identify this by checking if it has the higher daily_send_limit (100)
    // or other metadata that distinguishes gmail-imap-smtp accounts
    const hasImapSmtpCapability = account.daily_send_limit === 100 ||
                                  account.daily_limit === 100 ||
                                  // Fallback: all Gmail OAuth accounts support IMAP/SMTP
                                  true

    // Check for OAuth tokens in individual columns (current schema)
    if (!account.access_token || !account.refresh_token) {
      throw new Error('No OAuth tokens found for this account')
    }

    const tokens: OAuthTokens = {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: new Date(account.token_expires_at).getTime(),
      scope: 'https://mail.google.com/ https://www.googleapis.com/auth/gmail.send',
      token_type: 'Bearer'
    }

    const { createGmailIMAPSMTPService } = await getGmailService()
    return await createGmailIMAPSMTPService(tokens, account.email)
  }

  /**
   * Test Gmail IMAP/SMTP connection (server-side only)
   */
  async testGmailConnection(accountId: string) {
    try {
      const service = await this.createGmailIMAPSMTPService(accountId)
      const [imapWorking, smtpWorking] = await Promise.all([
        service.testIMAPConnection(),
        service.testSMTPConnection()
      ])

      return {
        success: imapWorking || smtpWorking,
        message: imapWorking && smtpWorking
          ? 'Both IMAP and SMTP connections successful'
          : imapWorking
            ? 'IMAP connection successful, SMTP failed'
            : smtpWorking
              ? 'SMTP connection successful, IMAP failed'
              : 'Both IMAP and SMTP connections failed',
        details: {
          imap: imapWorking,
          smtp: smtpWorking
        },
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          imap: false,
          smtp: false
        },
      }
    }
  }

  /**
   * Get mailboxes for a Gmail IMAP/SMTP account (server-side only)
   */
  async getGmailMailboxes(accountId: string): Promise<string[]> {
    const service = await this.createGmailIMAPSMTPService(accountId)
    return await service.getMailboxes()
  }

  /**
   * Fetch emails for a Gmail IMAP/SMTP account (server-side only)
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
    const service = await this.createGmailIMAPSMTPService(accountId)
    return await service.fetchEmails(mailbox, options)
  }

  /**
   * Send email using Gmail IMAP/SMTP account (server-side only)
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
    const service = await this.createGmailIMAPSMTPService(accountId)
    return await service.sendEmail(options)
  }

  /**
   * Get email count for Gmail IMAP/SMTP account (server-side only)
   */
  async getGmailEmailCount(accountId: string, mailbox: string = 'INBOX') {
    const service = await this.createGmailIMAPSMTPService(accountId)
    return await service.getEmailCount(mailbox)
  }

  /**
   * Mark email as read (server-side only)
   */
  async markGmailEmailAsRead(accountId: string, mailbox: string, uid: number) {
    const service = await this.createGmailIMAPSMTPService(accountId)
    return await service.markAsRead(mailbox, uid)
  }

  /**
   * Delete email (server-side only)
   */
  async deleteGmailEmail(accountId: string, mailbox: string, uid: number) {
    const service = await this.createGmailIMAPSMTPService(accountId)
    return await service.deleteEmail(mailbox, uid)
  }
}