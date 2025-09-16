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
   * Test IMAP connection
   */
  async testIMAPConnection(): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        const config = await this.createIMAPConfig()
        const imap = new Imap({
          ...config,
          xoauth2: `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`
        })

        let connectionSuccessful = false

        imap.once('ready', () => {
          connectionSuccessful = true
          imap.end()
        })

        imap.once('error', (err) => {
          console.error('IMAP connection error:', err)
          resolve(false)
        })

        imap.once('end', () => {
          resolve(connectionSuccessful)
        })

        imap.connect()
      } catch (error) {
        console.error('IMAP test connection error:', error)
        resolve(false)
      }
    })
  }

  /**
   * Test SMTP connection
   */
  async testSMTPConnection(): Promise<boolean> {
    try {
      const config = await this.createSMTPConfig()
      const transporter = nodemailer.createTransporter(config as any)

      await transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP test connection error:', error)
      return false
    }
  }

  /**
   * Get list of mailboxes
   */
  async getMailboxes(): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const config = await this.createIMAPConfig()
        const imap = new Imap({
          ...config,
          xoauth2: `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`
        })

        imap.once('ready', () => {
          imap.getBoxes((err, boxes) => {
            if (err) {
              reject(err)
              return
            }

            const getBoxNames = (boxes: any, prefix = ''): string[] => {
              const names: string[] = []
              for (const [name, box] of Object.entries(boxes)) {
                const fullName = prefix ? `${prefix}/${name}` : name
                names.push(fullName)

                if (box && typeof box === 'object' && (box as any).children) {
                  names.push(...getBoxNames((box as any).children, fullName))
                }
              }
              return names
            }

            resolve(getBoxNames(boxes))
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

  /**
   * Fetch emails from a specific mailbox
   */
  async fetchEmails(
    mailbox: string = 'INBOX',
    options: {
      limit?: number
      since?: Date
      unseen?: boolean
    } = {}
  ): Promise<EmailMessage[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const config = await this.createIMAPConfig()
        const imap = new Imap({
          ...config,
          xoauth2: `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`
        })

        const messages: EmailMessage[] = []

        imap.once('ready', () => {
          imap.openBox(mailbox, true, (err, box) => {
            if (err) {
              reject(err)
              return
            }

            // Build search criteria
            const searchCriteria: string[] = ['ALL']
            if (options.since) {
              searchCriteria.push(['SINCE', options.since])
            }
            if (options.unseen) {
              searchCriteria.push('UNSEEN')
            }

            imap.search(searchCriteria as any, (err, uids) => {
              if (err) {
                reject(err)
                return
              }

              if (!uids || uids.length === 0) {
                resolve([])
                imap.end()
                return
              }

              // Limit results if specified
              const limitedUids = options.limit ? uids.slice(-options.limit) : uids

              const fetch = imap.fetch(limitedUids, {
                bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)',
                struct: true
              })

              fetch.on('message', (msg, seqno) => {
                let uid = 0
                const headers: any = {}

                msg.on('body', (stream, info) => {
                  let buffer = ''
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('ascii')
                  })
                  stream.once('end', () => {
                    const parsed = Imap.parseHeader(buffer)
                    Object.assign(headers, parsed)
                  })
                })

                msg.once('attributes', (attrs) => {
                  uid = attrs.uid
                })

                msg.once('end', () => {
                  messages.push({
                    uid,
                    messageId: headers['message-id']?.[0] || '',
                    from: headers.from?.[0] || '',
                    to: headers.to?.[0] || '',
                    subject: headers.subject?.[0] || '',
                    date: new Date(headers.date?.[0] || new Date()),
                    body: '' // Would need additional fetch for body content
                  })
                })
              })

              fetch.once('error', reject)
              fetch.once('end', () => {
                resolve(messages)
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
   * Send email via SMTP
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; response: string }> {
    try {
      const config = await this.createSMTPConfig()
      const transporter = nodemailer.createTransporter(config as any)

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
        const imap = new Imap({
          ...config,
          xoauth2: `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`
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
        const imap = new Imap({
          ...config,
          xoauth2: `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`
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
        const imap = new Imap({
          ...config,
          xoauth2: `user=${config.user}\x01auth=Bearer ${config.accessToken}\x01\x01`
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