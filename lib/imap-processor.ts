import * as Imap from 'node-imap'
import { simpleParser, ParsedMail } from 'mailparser'
import { createServerSupabaseClient } from './supabase-server'

export interface IMAPConfig {
  host: string
  port: number
  tls: boolean
  user: string
  password: string
}

export interface ProcessedEmail {
  messageId: string
  imapUid?: number
  flags?: string[]
  inReplyTo?: string
  emailReferences?: string
  from: string
  to: string
  cc?: string[]
  subject?: string
  dateReceived: Date
  textContent?: string
  htmlContent?: string
  attachments: Array<{
    filename: string
    contentType: string
    size: number
    data?: Buffer
  }>
}

export interface IMAPSyncResult {
  totalProcessed: number
  newEmails: number
  errors: string[]
  lastProcessedUID: number
}

/**
 * Core IMAP email processing service
 */
export class IMAPProcessor {
  private imap: Imap | null = null
  private supabase: any

  constructor() {
    this.supabase = createServerSupabaseClient()
  }

  /**
   * Test IMAP connection
   */
  async testConnection(config: IMAPConfig): Promise<{
    success: boolean
    message: string
    details?: any
  }> {
    return new Promise((resolve) => {
      console.log(`🔍 Testing IMAP connection: ${config.user}@${config.host}:${config.port} (TLS: ${config.tls})`)
      
      const imapConfig: any = {
        host: config.host,
        port: config.port,
        tls: config.tls,
        user: config.user,
        password: config.password,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 30000,
        connTimeout: 60000,
        debug: console.log // Enable debug logging
      }
      
      const testImap = new Imap(imapConfig)

      const timeout = setTimeout(() => {
        testImap.destroy()
        resolve({
          success: false,
          message: 'Connection timeout after 30 seconds'
        })
      }, 30000)

      testImap.once('ready', () => {
        clearTimeout(timeout)
        testImap.end()
        resolve({
          success: true,
          message: 'IMAP connection successful'
        })
      })

      testImap.once('error', (err: Error) => {
        clearTimeout(timeout)
        resolve({
          success: false,
          message: `IMAP connection failed: ${err.message}`,
          details: err
        })
      })

      try {
        testImap.connect()
      } catch (error) {
        clearTimeout(timeout)
        resolve({
          success: false,
          message: `Failed to initiate connection: ${error.message}`
        })
      }
    })
  }

  /**
   * Connect to IMAP server
   */
  async connect(config: IMAPConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`📧 Connecting to IMAP: ${config.user}@${config.host}:${config.port} (TLS: ${config.tls})`)
      
      const imapConfig: any = {
        host: config.host,
        port: config.port,
        tls: config.tls,
        user: config.user,
        password: config.password,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 30000,
        connTimeout: 60000
      }
      
      this.imap = new Imap(imapConfig)

      this.imap.once('ready', () => {
        console.log('📧 IMAP connection established')
        resolve()
      })

      this.imap.once('error', (err: Error) => {
        console.error('❌ IMAP connection error:', err)
        reject(err)
      })

      this.imap.once('end', () => {
        console.log('📧 IMAP connection ended')
      })

      this.imap.connect()
    })
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.imap) {
      this.imap.end()
      this.imap = null
    }
  }

  /**
   * Sync emails from IMAP server
   */
  async syncEmails(
    userId: string,
    emailAccountId: string,
    config: IMAPConfig,
    lastProcessedUID: number = 0
  ): Promise<IMAPSyncResult> {
    const result: IMAPSyncResult = {
      totalProcessed: 0,
      newEmails: 0,
      errors: [],
      lastProcessedUID: lastProcessedUID
    }

    try {
      await this.connect(config)

      if (!this.imap) {
        throw new Error('Failed to establish IMAP connection')
      }

      // Open INBOX
      await this.openMailbox('INBOX')

      // Search for new emails
      const newUIDs = await this.searchNewEmails(lastProcessedUID)
      
      console.log(`📧 Found ${newUIDs.length} new emails to process`)

      if (newUIDs.length === 0) {
        await this.disconnect()
        return result
      }

      result.totalProcessed = newUIDs.length

      // Process emails in batches to avoid memory issues
      const batchSize = 50
      for (let i = 0; i < newUIDs.length; i += batchSize) {
        const batch = newUIDs.slice(i, i + batchSize)
        
        try {
          await this.processBatch(batch, userId, emailAccountId, result)
        } catch (error) {
          console.error(`❌ Error processing batch ${i}-${i + batchSize}:`, error)
          result.errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`)
        }
      }

      // Update last processed UID
      result.lastProcessedUID = Math.max(...newUIDs, lastProcessedUID)

      await this.disconnect()
      return result

    } catch (error) {
      console.error('❌ IMAP sync error:', error)
      result.errors.push(error.message)
      await this.disconnect()
      return result
    }
  }

  /**
   * Open mailbox
   */
  private async openMailbox(boxName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'))
        return
      }

      this.imap.openBox(boxName, false, (err, box) => {
        if (err) {
          reject(err)
        } else {
          console.log(`📧 Opened ${boxName} with ${box.messages.total} total messages`)
          resolve()
        }
      })
    })
  }

  /**
   * Search for new emails
   */
  private async searchNewEmails(lastProcessedUID: number): Promise<number[]> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'))
        return
      }

      // Search for emails newer than last processed UID
      if (lastProcessedUID > 0) {
        // Use UID search for emails with UID greater than last processed
        this.imap.search([['UID', `${lastProcessedUID + 1}:*`]], (err, uids) => {
          if (err) {
            reject(err)
          } else {
            resolve(uids || [])
          }
        })
      } else {
        // Get all emails if no last processed UID
        this.imap.search(['ALL'], (err, uids) => {
          if (err) {
            reject(err)
          } else {
            resolve(uids || [])
          }
        })
      }
    })
  }

  /**
   * Process a batch of emails
   */
  private async processBatch(
    uids: number[],
    userId: string,
    emailAccountId: string,
    result: IMAPSyncResult
  ): Promise<void> {
    if (!this.imap || uids.length === 0) return

    return new Promise((resolve, reject) => {
      const fetch = this.imap!.fetch(uids, { 
        bodies: '',
        struct: true,
        envelope: true
      })

      fetch.on('message', (msg, seqno) => {
        this.processMessage(msg, seqno, userId, emailAccountId, result)
          .catch(error => {
            console.error(`❌ Error processing message ${seqno}:`, error)
            result.errors.push(`Message ${seqno}: ${error.message}`)
          })
      })

      fetch.once('error', (err) => {
        console.error('❌ Fetch error:', err)
        reject(err)
      })

      fetch.once('end', () => {
        console.log(`✅ Processed batch of ${uids.length} emails`)
        resolve()
      })
    })
  }

  /**
   * Process individual email message
   */
  private async processMessage(
    msg: Imap.ImapMessage,
    seqno: number,
    userId: string,
    emailAccountId: string,
    result: IMAPSyncResult
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = ''
      let attributes: any = null

      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8')
        })
      })

      msg.once('attributes', (attrs) => {
        attributes = attrs
      })

      msg.once('end', async () => {
        try {
          // Parse the email
          const parsed = await simpleParser(buffer)
          
          // Convert to our format
          const processedEmail = this.convertParsedEmail(parsed, attributes)
          
          // Store in database
          await this.storeIncomingEmail(processedEmail, userId, emailAccountId)
          
          result.newEmails++
          console.log(`✅ Processed email: ${processedEmail.subject}`)
          resolve()
        } catch (error) {
          console.error(`❌ Error parsing email ${seqno}:`, error)
          result.errors.push(`Parse error ${seqno}: ${error.message}`)
          reject(error)
        }
      })
    })
  }

  /**
   * Convert parsed email to our format
   */
  private convertParsedEmail(parsed: ParsedMail, attributes: any): ProcessedEmail {
    return {
      messageId: parsed.messageId || `generated-${Date.now()}-${Math.random()}`,
      imapUid: attributes?.uid,
      flags: Array.isArray(attributes?.flags) ? attributes.flags : undefined,
      inReplyTo: parsed.inReplyTo,
      emailReferences: parsed.references,
      from: parsed.from?.text || '',
      to: parsed.to?.text || '',
      cc: parsed.cc ? [parsed.cc.text] : [],
      subject: parsed.subject,
      dateReceived: parsed.date || new Date(),
      textContent: parsed.text,
      htmlContent: parsed.html || undefined,
      attachments: (parsed.attachments || []).map(att => ({
        filename: att.filename || 'unnamed',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        data: att.content
      }))
    }
  }

  /**
   * Store incoming email in database
   */
  private async storeIncomingEmail(
    email: ProcessedEmail,
    userId: string,
    emailAccountId: string
  ): Promise<void> {
    // Try to include imap metadata, but fall back if columns not present
    const base = {
        user_id: userId,
        email_account_id: emailAccountId,
        message_id: email.messageId,
        in_reply_to: email.inReplyTo,
        email_references: email.emailReferences,
        from_address: email.from,
        to_address: email.to,
        cc_addresses: email.cc,
        subject: email.subject,
        date_received: email.dateReceived.toISOString(),
        text_content: email.textContent,
        html_content: email.htmlContent,
        attachments: email.attachments.map(att => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size
          // Note: We don't store attachment data in DB for space reasons
        })),
        processing_status: 'pending',
        classification_status: 'unclassified'
      }

    // Attempt to set imap_uid and flags if the columns exist
    let payload: any = base
    try {
      payload = { ...base, imap_uid: email.imapUid, flags: email.flags }
      const { error } = await this.supabase.from('incoming_emails').insert(payload)
      if (error) throw error
    } catch (e: any) {
      // Retry without optional columns if the insert failed due to unknown columns
      console.warn('⚠️ Insert with IMAP columns failed, retrying without optional fields:', e?.message)
      const { error: fallbackError } = await this.supabase.from('incoming_emails').insert(base)
      if (fallbackError) {
        console.error('❌ Error storing incoming email:', fallbackError)
        throw new Error(`Database insert failed: ${fallbackError.message}`)
      }
    }
  }

  /**
   * Reconcile deletions: mark emails as archived if their UID is no longer on server
   */
  async reconcileDeletions(
    emailAccountId: string,
    folder: string = 'INBOX'
  ): Promise<void> {
    if (!this.imap) return
    // List UIDs on server
    const uidsOnServer: number[] = await new Promise((resolve, reject) => {
      this.imap!.search(['ALL'], (err, uids) => {
        if (err) reject(err)
        else resolve(uids || [])
      })
    })

    // Fetch known rows (with/without UID) not archived
    const { data: localRows, error } = await this.supabase
      .from('incoming_emails')
      .select('id, imap_uid, message_id')
      .eq('email_account_id', emailAccountId)
      .is('archived_at', null)
      

    if (error) {
      console.error('❌ Failed to load local IMAP UIDs:', error)
      return
    }

    // First pass: by UID
    const serverUIDSet = new Set(uidsOnServer)
    const toArchiveByUid = (localRows || [])
      .filter(r => typeof r.imap_uid === 'number' && !serverUIDSet.has(r.imap_uid as any))
      .map(r => r.id)

    if (toArchiveByUid.length > 0) {
      console.log(`🧹 Archiving ${toArchiveByUid.length} emails (UID not on server)`)
      const { error: updErr } = await this.supabase
        .from('incoming_emails')
        .update({ archived_at: new Date().toISOString() })
        .in('id', toArchiveByUid)
      if (updErr) console.error('❌ Failed to archive by UID:', updErr)
    }

    // Second pass: for rows without imap_uid, compare Message-ID
    const withoutUid = (localRows || []).filter(r => !r.imap_uid)
    if (withoutUid.length > 0) {
      // Fetch Message-ID headers for ALL on server
      const serverMessageIds = await this.fetchServerMessageIds()
      const toArchiveByMsgId = withoutUid
        .filter(r => r.message_id && !serverMessageIds.has(r.message_id))
        .map(r => r.id)
      if (toArchiveByMsgId.length > 0) {
        console.log(`🧹 Archiving ${toArchiveByMsgId.length} emails (Message-ID not on server)`)
        const { error: upd2 } = await this.supabase
          .from('incoming_emails')
          .update({ archived_at: new Date().toISOString() })
          .in('id', toArchiveByMsgId)
        if (upd2) console.error('❌ Failed to archive by Message-ID:', upd2)
      }
    }
  }

  /**
   * Fetch Message-ID values for all messages in the currently opened mailbox
   */
  private async fetchServerMessageIds(): Promise<Set<string>> {
    return new Promise((resolve, reject) => {
      const ids = new Set<string>()
      if (!this.imap) return resolve(ids)
      // Fetch headers only
      const f = this.imap!.fetch('1:*', { bodies: 'HEADER.FIELDS (MESSAGE-ID)', struct: false })
      f.on('message', (msg) => {
        let header = ''
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => { header += chunk.toString('utf8') })
        })
        msg.once('end', () => {
          const m = header.match(/Message-ID:\s*<([^>]+)>/i)
          if (m && m[1]) ids.add(`<${m[1]}>`)
        })
      })
      f.once('error', (err) => reject(err))
      f.once('end', () => resolve(ids))
    })
  }

  /**
   * Update IMAP connection status
   */
  async updateConnectionStatus(
    emailAccountId: string,
    status: 'active' | 'inactive' | 'error' | 'connecting',
    error?: string,
    lastProcessedUID?: number
  ): Promise<void> {
    const updateData: any = {
      status,
      last_sync_at: new Date().toISOString()
    }

    if (error) {
      updateData.last_error = error
      updateData.consecutive_failures = this.supabase.rpc('increment_consecutive_failures', {
        account_id: emailAccountId
      })
    } else {
      updateData.consecutive_failures = 0
      updateData.last_successful_connection = new Date().toISOString()
    }

    if (lastProcessedUID !== undefined) {
      updateData.last_processed_uid = lastProcessedUID
    }

    const { error: updateError } = await this.supabase
      .from('imap_connections')
      .upsert({
        email_account_id: emailAccountId,
        ...updateData
      })

    if (updateError) {
      console.error('❌ Error updating IMAP connection status:', updateError)
    }
  }

  /**
   * Get emails that need classification
   */
  async getUnclassifiedEmails(userId: string, limit: number = 100): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('incoming_emails')
      .select('*')
      .eq('user_id', userId)
      .eq('classification_status', 'unclassified')
      .eq('processing_status', 'pending')
      .order('date_received', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('❌ Error fetching unclassified emails:', error)
      return []
    }

    return data || []
  }

  /**
   * Update email classification
   */
  async updateEmailClassification(
    emailId: string,
    classification: 'bounce' | 'auto_reply' | 'human_reply' | 'unsubscribe' | 'spam',
    confidence: number,
    processingStatus: 'completed' | 'failed' = 'completed'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('incoming_emails')
      .update({
        classification_status: classification,
        classification_confidence: confidence,
        processing_status: processingStatus,
        processed_at: new Date().toISOString()
      })
      .eq('id', emailId)

    if (error) {
      console.error('❌ Error updating email classification:', error)
      throw error
    }
  }
}

// Export singleton instance
export const imapProcessor = new IMAPProcessor()
