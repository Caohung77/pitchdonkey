import Imap from 'node-imap'
import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import { OAuthTokens, OAuthTokenManager } from './oauth-providers'

export interface GmailIMAPConfig {
  user: string
  accessToken: string
  host: 'imap.gmail.com'
  port: 993
  tls: true
  authTimeout: 3000
  connTimeout: 10000
  tlsOptions: {
    rejectUnauthorized: false
  }
}

export interface GmailSMTPConfig {
  service: 'gmail'
  host: 'smtp.gmail.com'
  port: 587
  secure: false
  auth: {
    type: 'OAuth2'
    user: string
    clientId: string
    clientSecret: string
    refreshToken: string
    accessToken: string
  }
  tls: {
    rejectUnauthorized: false
  }
}

export interface EmailMessage {
  uid: number
  messageId: string
  from: string
  to: string
  subject: string
  date: Date
  body: string
  html?: string
  attachments?: Array<{
    filename: string
    contentType: string
    size: number
  }>
}

export interface SendEmailOptions {
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

export class GmailIMAPSMTPService {
  private tokens: OAuthTokens
  private userEmail: string
  private clientId: string
  private clientSecret: string

  constructor(tokens: OAuthTokens, userEmail: string) {
    this.tokens = tokens
    this.userEmail = userEmail
    this.clientId = process.env.GOOGLE_CLIENT_ID || ''
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  }

  /**
   * Ensure tokens are fresh before any operation
   */
  private async ensureFreshTokens(): Promise<OAuthTokens> {
    return await OAuthTokenManager.refreshTokensIfNeeded('gmail', this.tokens)
  }

  /**
   * Create IMAP configuration with OAuth2
   */
  private async createIMAPConfig(): Promise<GmailIMAPConfig> {
    const freshTokens = await this.ensureFreshTokens()

    return {
      user: this.userEmail,
      accessToken: freshTokens.access_token,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 3000,
      connTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false
      }
    }
  }

  /**
   * Create SMTP configuration with OAuth2
   */
  private async createSMTPConfig(): Promise<GmailSMTPConfig> {
    const freshTokens = await this.ensureFreshTokens()

    return {
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        type: 'OAuth2',
        user: this.userEmail,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken: freshTokens.refresh_token,
        accessToken: freshTokens.access_token
      },
      tls: {
        rejectUnauthorized: false
      }
    }
  }

  /**
   * Test IMAP connection using Gmail API instead of traditional IMAP
   */
  async testIMAPConnection(): Promise<boolean> {
    try {
      // Use Gmail API to test connection instead of IMAP
      const freshTokens = await this.ensureFreshTokens()

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret
      )

      oauth2Client.setCredentials({
        access_token: freshTokens.access_token,
        refresh_token: freshTokens.refresh_token,
        expiry_date: freshTokens.expires_at,
        scope: freshTokens.scope,
        token_type: 'Bearer'
      })

      // Test Gmail API access for reading emails
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
      await gmail.users.getProfile({ userId: 'me' })

      return true
    } catch (error) {
      console.error('Gmail API connection error:', error)
      return false
    }
  }

  /**
   * Test SMTP connection
   */
  async testSMTPConnection(): Promise<boolean> {
    try {
      const config = await this.createSMTPConfig()
      const transporter = nodemailer.createTransport(config as any)

      await transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP test connection error:', error)
      return false
    }
  }

  /**
   * Get list of mailboxes using Gmail API
   */
  async getMailboxes(): Promise<string[]> {
    try {
      const freshTokens = await this.ensureFreshTokens()

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret
      )

      oauth2Client.setCredentials({
        access_token: freshTokens.access_token,
        refresh_token: freshTokens.refresh_token,
        expiry_date: freshTokens.expires_at,
        scope: freshTokens.scope,
        token_type: 'Bearer'
      })

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
      const response = await gmail.users.labels.list({ userId: 'me' })

      // Convert Gmail labels to mailbox names
      const mailboxes = response.data.labels?.map(label => label.name || '') || []

      // Add standard IMAP mailbox names for compatibility
      const standardMailboxes = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM']

      return [...new Set([...standardMailboxes, ...mailboxes])]
    } catch (error) {
      console.error('Gmail API mailboxes error:', error)
      // Return standard mailboxes as fallback
      return ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM']
    }
  }

  /**
   * Fetch emails from a specific mailbox using Gmail API
   */
  async fetchEmails(
    mailbox: string = 'INBOX',
    options: {
      limit?: number
      since?: Date
      unseen?: boolean
    } = {}
  ): Promise<EmailMessage[]> {
    try {
      const freshTokens = await this.ensureFreshTokens()

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret
      )

      oauth2Client.setCredentials({
        access_token: freshTokens.access_token,
        refresh_token: freshTokens.refresh_token,
        expiry_date: freshTokens.expires_at,
        scope: freshTokens.scope,
        token_type: 'Bearer'
      })

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

      // Build query for Gmail API
      let query = ''
      if (mailbox && mailbox !== 'INBOX') {
        query += `label:${mailbox.toLowerCase()} `
      }
      if (options.unseen) {
        query += 'is:unread '
      }
      if (options.since) {
        const sinceDate = options.since.toISOString().split('T')[0]
        query += `after:${sinceDate} `
      }

      // Get message list
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query.trim() || undefined,
        maxResults: options.limit || 50
      })

      const messages: EmailMessage[] = []

      if (listResponse.data.messages) {
        // Fetch details for each message
        const messagePromises = listResponse.data.messages.map(async (message) => {
          try {
            const messageResponse = await gmail.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Message-ID']
            })

            const headers = messageResponse.data.payload?.headers || []
            const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

            return {
              uid: parseInt(message.id!) || 0,
              messageId: getHeader('Message-ID'),
              from: getHeader('From'),
              to: getHeader('To'),
              subject: getHeader('Subject'),
              date: new Date(getHeader('Date') || new Date()),
              body: '' // Body would need separate fetch
            }
          } catch (error) {
            console.error('Error fetching message details:', error)
            return null
          }
        })

        const messageResults = await Promise.all(messagePromises)
        messages.push(...messageResults.filter(msg => msg !== null) as EmailMessage[])
      }

      return messages
    } catch (error) {
      console.error('Gmail API fetch emails error:', error)
      return []
    }
  }

  /**
   * Send email via SMTP
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; response: string }> {
    try {
      const config = await this.createSMTPConfig()
      const transporter = nodemailer.createTransport(config as any)

      const mailOptions = {
        from: this.userEmail,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments
      }

      const result = await transporter.sendMail(mailOptions)

      return {
        messageId: result.messageId,
        response: result.response
      }
    } catch (error) {
      console.error('Email sending error:', error)
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(mailbox: string, uid: number): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const config = await this.createIMAPConfig()
        // Generate proper XOAUTH2 string for Gmail
        const xoauth2String = `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`

        const imap = new Imap({
          user: config.user,
          host: config.host,
          port: config.port,
          tls: config.tls,
          authTimeout: config.authTimeout,
          connTimeout: config.connTimeout,
          tlsOptions: config.tlsOptions,
          xoauth2: xoauth2String
        })

        imap.once('ready', () => {
          imap.openBox(mailbox, false, (err) => {
            if (err) {
              reject(err)
              return
            }

            imap.addFlags([uid], ['\\Seen'], (err) => {
              if (err) {
                reject(err)
                return
              }
              resolve(true)
              imap.end()
            })
          })
        })

        imap.once('error', reject)
        imap.connect()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Delete email (move to trash)
   */
  async deleteEmail(mailbox: string, uid: number): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const config = await this.createIMAPConfig()
        // Generate proper XOAUTH2 string for Gmail
        const xoauth2String = `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`

        const imap = new Imap({
          user: config.user,
          host: config.host,
          port: config.port,
          tls: config.tls,
          authTimeout: config.authTimeout,
          connTimeout: config.connTimeout,
          tlsOptions: config.tlsOptions,
          xoauth2: xoauth2String
        })

        imap.once('ready', () => {
          imap.openBox(mailbox, false, (err) => {
            if (err) {
              reject(err)
              return
            }

            imap.addFlags([uid], ['\\Deleted'], (err) => {
              if (err) {
                reject(err)
                return
              }

              imap.expunge([uid], (err) => {
                if (err) {
                  reject(err)
                  return
                }
                resolve(true)
                imap.end()
              })
            })
          })
        })

        imap.once('error', reject)
        imap.connect()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Get email count in mailbox
   */
  async getEmailCount(mailbox: string = 'INBOX'): Promise<{ total: number; unseen: number }> {
    return new Promise(async (resolve, reject) => {
      try {
        const config = await this.createIMAPConfig()
        // Generate proper XOAUTH2 string for Gmail
        const xoauth2String = `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`

        const imap = new Imap({
          user: config.user,
          host: config.host,
          port: config.port,
          tls: config.tls,
          authTimeout: config.authTimeout,
          connTimeout: config.connTimeout,
          tlsOptions: config.tlsOptions,
          xoauth2: xoauth2String
        })

        imap.once('ready', () => {
          imap.openBox(mailbox, true, (err, box) => {
            if (err) {
              reject(err)
              return
            }

            resolve({
              total: box.messages.total,
              unseen: box.messages.new
            })
            imap.end()
          })
        })

        imap.once('error', reject)
        imap.connect()
      } catch (error) {
        reject(error)
      }
    })
  }
}

/**
 * Factory function to create Gmail IMAP/SMTP service
 */
export async function createGmailIMAPSMTPService(
  tokens: OAuthTokens,
  userEmail: string
): Promise<GmailIMAPSMTPService> {
  const service = new GmailIMAPSMTPService(tokens, userEmail)

  // Test both connections on creation
  const [imapWorking, smtpWorking] = await Promise.all([
    service.testIMAPConnection(),
    service.testSMTPConnection()
  ])

  if (!imapWorking && !smtpWorking) {
    throw new Error('Both IMAP and SMTP connections failed. Please check your OAuth tokens and configuration.')
  }

  if (!imapWorking) {
    console.warn('IMAP connection failed, but SMTP is working. Email receiving functionality will be limited.')
  }

  if (!smtpWorking) {
    console.warn('SMTP connection failed, but IMAP is working. Email sending functionality will be limited.')
  }

  return service
}