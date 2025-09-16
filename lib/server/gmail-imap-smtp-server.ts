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

    if (account.provider !== 'gmail-imap-smtp') {
      throw new Error('Account is not a Gmail IMAP/SMTP account')
    }

    if (!account.oauth_tokens) {
      throw new Error('No OAuth tokens found for this account')
    }

    const tokens = typeof account.oauth_tokens === 'string'
      ? decryptOAuthTokens(account.oauth_tokens)
      : account.oauth_tokens

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