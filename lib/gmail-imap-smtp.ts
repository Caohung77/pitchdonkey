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
  gmailMessageId?: string // Gmail API message ID (needed for trash/delete)
  from: string
  to: string
  subject: string
  date: Date
  body: string
  textBody?: string
  htmlBody?: string
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
  senderName?: string // Add sender name option
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
    try {
      const refreshedTokens = await OAuthTokenManager.refreshTokensIfNeeded('gmail', this.tokens)
      // Update our instance tokens if they were refreshed
      this.tokens = refreshedTokens
      return refreshedTokens
    } catch (error) {
      console.error('❌ Failed to refresh OAuth tokens:', error)
      // Try using existing tokens as fallback
      console.warn('⚠️ Using potentially expired tokens as fallback')
      return this.tokens
    }
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
      // CRITICAL: Use labelIds parameter correctly per Gmail API documentation
      // Gmail's INBOX label already filters correctly - don't overcomplicate with search queries
      let query = ''
      let labelIds: string[] | undefined = undefined

      if (mailbox === 'SENT' || mailbox === 'Sent' || mailbox === '[Gmail]/Sent Mail') {
        // For SENT folder, use labelIds
        labelIds = ['SENT']
      } else if (mailbox === 'INBOX' || !mailbox) {
        // For INBOX, use labelIds parameter ONLY
        // Gmail's INBOX label naturally excludes SENT-only emails
        // We'll filter out self-sent emails in the sync logic instead
        labelIds = ['INBOX']
      } else {
        // Custom label
        labelIds = [mailbox]
      }

      if (options.unseen) {
        query += 'is:unread '
      }
      if (options.since) {
        const sinceDate = options.since.toISOString().split('T')[0]
        query += `after:${sinceDate} `
      }

      // Get message list using Gmail API
      console.log('📧 Gmail API Request:', {
        mailbox,
        labelIds,
        query: query.trim() || undefined,
        maxResults: options.limit || 50,
        unseen: options.unseen,
        since: options.since
      })

      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        labelIds: labelIds, // Use labelIds for SENT and custom labels, undefined for INBOX
        q: query.trim() || undefined, // Use q for INBOX search and additional filters
        maxResults: options.limit || 50
      })

      console.log('📧 Gmail API Response:', {
        messageCount: listResponse.data.messages?.length || 0,
        resultSizeEstimate: listResponse.data.resultSizeEstimate,
        nextPageToken: listResponse.data.nextPageToken ? 'exists' : 'none'
      })

      const messages: EmailMessage[] = []

      if (listResponse.data.messages) {
        // Fetch details for each message with full content
        const messagePromises = listResponse.data.messages.map(async (message) => {
          try {
            const messageResponse = await gmail.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'full' // Changed from 'metadata' to 'full' to get email body
            })

            const headers = messageResponse.data.payload?.headers || []
            const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

            // Extract email body (text and HTML)
            const { textBody, htmlBody } = this.extractEmailBody(messageResponse.data.payload)

            // Generate a numeric UID from Gmail API message ID for database storage
            // Gmail API IDs are base64url strings (e.g., "18d4c8f123ab45cd")
            // We'll use a hash function that produces a value within JavaScript safe integer range
            // but can be stored as BIGINT in PostgreSQL
            const gmailId = message.id!
            let numericUid: number

            // Create a stable hash from the Gmail message ID
            // Using djb2 hash algorithm which produces consistent results
            let hash = 5381
            for (let i = 0; i < gmailId.length; i++) {
              const char = gmailId.charCodeAt(i)
              // hash * 33 + char
              hash = ((hash << 5) + hash) + char
            }

            // Take absolute value and ensure it's a positive integer
            numericUid = Math.abs(hash)

            const emailData = {
              uid: numericUid,
              messageId: getHeader('Message-ID'),
              gmailMessageId: gmailId, // Store Gmail API message ID for trash/delete
              from: getHeader('From'),
              to: getHeader('To'),
              subject: getHeader('Subject'),
              date: new Date(getHeader('Date') || new Date()),
              body: textBody,
              textBody: textBody,
              htmlBody: htmlBody,
              html: htmlBody
            }

            console.log('📧 Email fetched:', {
              messageId: emailData.messageId,
              from: emailData.from,
              to: emailData.to,
              subject: emailData.subject,
              date: emailData.date,
              labels: messageResponse.data.labelIds
            })

            return emailData
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
   * Send email via Gmail API (not SMTP)
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; response: string }> {
    try {
      console.log(`📧 Sending Gmail API email to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`)

      // Ensure fresh tokens
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

      // Prepare email addresses
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to
      const cc = options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined
      const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined

      // Get content
      const htmlContent = options.html || ''
      const textContent = options.text || (options.html ? options.html.replace(/<[^>]*>/g, '') : '')

      console.log(`📧 Gmail API HTML content length: ${htmlContent.length} chars`)
      console.log(`📧 Gmail API text content length: ${textContent.length} chars`)
      console.log(`📧 Gmail API content preview: ${htmlContent.substring(0, 200)}...`)

      // Generate unique Message-ID
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 15)
      const messageId = `<${timestamp}.${random}@gmail.com>`

      // Create proper RFC 2822 multipart message
      const boundary = `----=_Part_${timestamp}_${random}`

      // Build email headers with proper sender name encoding
      const fromHeader = options.senderName
        ? `"${options.senderName}" <${this.userEmail}>`
        : this.userEmail

      const headers = [
        `From: ${fromHeader}`,
        `To: ${to}`,
        cc ? `Cc: ${cc}` : null,
        bcc ? `Bcc: ${bcc}` : null,
        `Subject: =?UTF-8?B?${Buffer.from(options.subject, 'utf8').toString('base64')}?=`,
        `Message-ID: ${messageId}`,
        `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0'
      ].filter(Boolean)

      // If we have both HTML and text, create multipart message
      let emailContent: string
      if (htmlContent && textContent) {
        emailContent = [
          ...headers,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          textContent,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          htmlContent,
          '',
          `--${boundary}--`
        ].join('\r\n')
      } else if (htmlContent) {
        // HTML only
        emailContent = [
          ...headers,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          htmlContent
        ].join('\r\n')
      } else {
        // Text only
        emailContent = [
          ...headers,
          'Content-Type: text/plain; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          textContent
        ].join('\r\n')
      }

      console.log(`📧 Final email structure length: ${emailContent.length} chars`)
      console.log(`📧 Email headers preview:`)
      console.log(emailContent.split('\r\n\r\n')[0])

      // Encode message in base64url format for Gmail API
      const encodedMessage = Buffer.from(emailContent, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      // Send via Gmail API
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      })

      console.log(`✅ Gmail API email sent successfully: ${result.data.id}`)

      return {
        messageId: result.data.id || `gmail_api_${Date.now()}`,
        response: `Gmail API success: ${result.data.id}`
      }
    } catch (error) {
      console.error('Gmail API sending error:', error)
      throw new Error(`Failed to send email via Gmail API: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Trash email using Gmail API (soft delete - can be restored)
   */
  async trashEmail(gmailMessageId: string): Promise<boolean> {
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

      // Use Gmail API to trash the message
      await gmail.users.messages.trash({
        userId: 'me',
        id: gmailMessageId
      })

      console.log(`✅ Gmail API: Trashed message ${gmailMessageId}`)
      return true
    } catch (error) {
      console.error('Gmail API trash error:', error)
      return false
    }
  }

  /**
   * Permanently delete email using Gmail API (cannot be undone)
   */
  async deleteEmail(gmailMessageId: string): Promise<boolean> {
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

      // Use Gmail API to permanently delete the message
      await gmail.users.messages.delete({
        userId: 'me',
        id: gmailMessageId
      })

      console.log(`✅ Gmail API: Permanently deleted message ${gmailMessageId}`)
      return true
    } catch (error) {
      console.error('Gmail API delete error:', error)
      return false
    }
  }

  /**
   * Extract email body from Gmail API payload
   */
  private extractEmailBody(payload: any): { textBody: string; htmlBody: string } {
    let textBody = ''
    let htmlBody = ''

    const decodeBase64 = (data: string) => {
      try {
        // Gmail API uses URL-safe base64
        const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
        return Buffer.from(normalized, 'base64').toString('utf-8')
      } catch (error) {
        console.error('Error decoding base64:', error)
        return ''
      }
    }

    const extractFromPart = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody = decodeBase64(part.body.data)
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = decodeBase64(part.body.data)
      } else if (part.parts) {
        // Recursive for multipart messages
        part.parts.forEach(extractFromPart)
      }
    }

    if (payload) {
      if (payload.parts) {
        payload.parts.forEach(extractFromPart)
      } else if (payload.body?.data) {
        // Single part message
        if (payload.mimeType === 'text/plain') {
          textBody = decodeBase64(payload.body.data)
        } else if (payload.mimeType === 'text/html') {
          htmlBody = decodeBase64(payload.body.data)
        }
      }
    }

    return { textBody, htmlBody }
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