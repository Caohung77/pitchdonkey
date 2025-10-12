import Imap from 'node-imap'

export interface IMAPSentSyncConfig {
  host: string
  port: number
  user: string
  password: string
  tls: boolean
}

export interface SentEmailData {
  from: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  messageId?: string
  date?: Date
}

/**
 * SMTP Sent Folder Sync Service
 *
 * When sending emails via SMTP, the email is transmitted but NOT saved to the mail server's
 * Sent folder. This service uses IMAP APPEND to save a copy of sent emails to the Sent folder,
 * making them visible in mail clients and the application's outbox.
 */
export class SMTPSentSync {
  /**
   * Save sent email to Sent folder via IMAP APPEND
   *
   * This mimics what email clients do: after SMTP send, they APPEND a copy to the Sent folder
   * so the email appears in the user's sent mail history.
   */
  static async saveSentEmail(
    imapConfig: IMAPSentSyncConfig,
    emailData: SentEmailData
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      console.log('📥 Attempting to save sent email to Sent folder via IMAP APPEND')
      console.log(`📥 IMAP Config: ${imapConfig.host}:${imapConfig.port}, User: ${imapConfig.user}`)

      const imap = new Imap({
        user: imapConfig.user,
        password: imapConfig.password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
        authTimeout: 10000,
        connTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      })

      imap.once('ready', () => {
        console.log('✅ IMAP connection ready, searching for Sent folder...')

        // Try common Sent folder names in order of likelihood
        const sentFolders = [
          'Sent',           // Most common
          'SENT',           // Uppercase variant
          'Sent Items',     // Microsoft/Outlook
          'Sent Messages',  // Some providers
          '[Gmail]/Sent Mail', // Gmail IMAP
          'Gesendet',       // German
          'Enviados',       // Spanish/Portuguese
        ]

        const trySentFolder = (folders: string[], index = 0) => {
          if (index >= folders.length) {
            imap.end()
            console.error('❌ No Sent folder found. Tried:', folders.join(', '))
            reject(new Error('No Sent folder found on mail server'))
            return
          }

          const currentFolder = folders[index]
          console.log(`📂 Trying folder: ${currentFolder}`)

          imap.openBox(currentFolder, false, (err, box) => {
            if (err) {
              console.log(`⚠️ Folder ${currentFolder} not found or inaccessible, trying next...`)
              // Try next folder
              trySentFolder(folders, index + 1)
              return
            }

            console.log(`✅ Found Sent folder: ${currentFolder}`)

            // Build RFC 2822 email message
            const emailMessage = buildEmailMessage(emailData)

            // APPEND to Sent folder with \Seen flag (mark as read)
            imap.append(emailMessage, { mailbox: currentFolder, flags: ['\\Seen'] }, (err) => {
              imap.end()

              if (err) {
                console.error(`❌ IMAP APPEND failed:`, err)
                reject(err)
              } else {
                console.log(`✅ Email successfully saved to ${currentFolder} folder`)
                resolve(true)
              }
            })
          })
        }

        trySentFolder(sentFolders)
      })

      imap.once('error', (err) => {
        console.error('❌ IMAP connection error:', err)
        reject(err)
      })

      imap.once('end', () => {
        console.log('📥 IMAP connection closed')
      })

      imap.connect()
    })
  }

  /**
   * Test IMAP connection and Sent folder access
   */
  static async testSentFolderAccess(imapConfig: IMAPSentSyncConfig): Promise<{
    success: boolean
    sentFolder?: string
    error?: string
  }> {
    return new Promise((resolve) => {
      const imap = new Imap({
        user: imapConfig.user,
        password: imapConfig.password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
        authTimeout: 10000,
        connTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      })

      imap.once('ready', () => {
        const sentFolders = [
          'Sent',
          'SENT',
          'Sent Items',
          'Sent Messages',
          '[Gmail]/Sent Mail',
          'Gesendet',
          'Enviados',
        ]

        const testFolder = (folders: string[], index = 0) => {
          if (index >= folders.length) {
            imap.end()
            resolve({ success: false, error: 'No Sent folder found' })
            return
          }

          imap.openBox(folders[index], true, (err) => {
            if (err) {
              testFolder(folders, index + 1)
              return
            }

            imap.end()
            resolve({ success: true, sentFolder: folders[index] })
          })
        }

        testFolder(sentFolders)
      })

      imap.once('error', (err) => {
        resolve({ success: false, error: err.message })
      })

      imap.connect()
    })
  }
}

/**
 * Build RFC 2822 compliant email message for IMAP APPEND
 */
function buildEmailMessage(emailData: SentEmailData): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
  const messageId = emailData.messageId || `<${Date.now()}.${Math.random().toString(36).substring(2)}@pitchdonkey.com>`
  const date = emailData.date || new Date()

  // Format recipient addresses
  const toAddresses = Array.isArray(emailData.to)
    ? emailData.to.join(', ')
    : emailData.to

  // Encode subject with UTF-8 base64 to support special characters (umlauts, etc.)
  const encodedSubject = `=?UTF-8?B?${Buffer.from(emailData.subject, 'utf8').toString('base64')}?=`

  const parts: string[] = [
    `From: ${emailData.from}`,
    `To: ${toAddresses}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    `Date: ${date.toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    '',
    emailData.text || emailData.html.replace(/<[^>]*>/g, ''),
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    '',
    emailData.html,
    '',
    `--${boundary}--`
  ]

  return parts.join('\r\n')
}
