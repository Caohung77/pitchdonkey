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
   * Discover Trash folder using special-use attributes, with common fallbacks
   */
  async findTrashMailbox(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.imap) return resolve(null)
      this.imap.getBoxes((err, boxes) => {
        if (err) return reject(err)

        const flatten = (tree: any, prefix = ''): Array<{ path: string; attribs: string[] }> => {
          const result: Array<{ path: string; attribs: string[] }> = []
          for (const name of Object.keys(tree)) {
            const box = tree[name]
            const path = prefix ? `${prefix}${box.delimiter}${name}` : name
            result.push({ path, attribs: box.attribs || [] })
            if (box.children) result.push(...flatten(box.children, path))
          }
          return result
        }

        const flat = flatten(boxes)
        const byAttr = flat.find(b => (b.attribs || []).some((a: string) => /\\Trash/i.test(a)))
        if (byAttr) return resolve(byAttr.path)

        const candidates = ['Trash', '[Gmail]/Trash', 'Deleted Items', 'Deleted Messages', 'Bin']
        const found = flat.find(b => candidates.includes(b.path))
        resolve(found ? found.path : null)
      })
    })
  }

  /**
   * Ensure a mailbox exists, creating it if missing
   */
  async ensureMailbox(name: string): Promise<void> {
    if (!this.imap) return
    return new Promise((resolve, reject) => {
      this.imap!.getBoxes((err, boxes) => {
        if (err) return reject(err)
        const exists = (() => {
          const check = (tree: any, target: string): boolean => {
            for (const key of Object.keys(tree)) {
              if (key === target) return true
              if (tree[key].children && check(tree[key].children, target)) return true
            }
            return false
          }
          return check(boxes, name)
        })()
        if (exists) return resolve()
        this.imap!.addBox(name, (addErr) => {
          if (addErr) return reject(addErr)
          resolve()
        })
      })
    })
  }

  /**
   * Move a message by UID between mailboxes
   */
  async moveUid(uid: number, fromMailbox: string, toMailbox: string): Promise<void> {
    if (!this.imap) throw new Error('IMAP not connected')
    await this.openMailbox(fromMailbox)
    return new Promise((resolve, reject) => {
      // node-imap move uses UIDs when passing numeric ids here
      this.imap!.move(String(uid), toMailbox, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  /**
   * Find UID by Message-ID header in a mailbox
   */
  async findUidByMessageId(messageId: string, mailbox = 'INBOX'): Promise<number | null> {
    if (!this.imap) throw new Error('IMAP not connected')
    await this.openMailbox(mailbox)
    return new Promise((resolve, reject) => {
      const id = messageId
      this.imap!.search(['HEADER', 'Message-ID', id], (err, uids) => {
        if (err) return reject(err)
        resolve(uids && uids.length > 0 ? uids[0] : null)
      })
    })
  }

  /**
   * Move message to Trash; create Trash if missing; fallback to delete+expunge
   */
  async moveToTrashByUid(uid: number, sourceMailbox = 'INBOX'): Promise<void> {
    if (!this.imap) throw new Error('IMAP not connected')
    let trash = await this.findTrashMailbox()
    try {
      if (!trash) {
        // Try to create a Trash mailbox if none found
        await this.ensureMailbox('Trash')
        trash = 'Trash'
      }
    } catch (_) {
      // ignore creation failure; fallback below
    }

    if (trash) {
      await this.moveUid(uid, sourceMailbox, trash)
      return
    }

    // Fallback: mark as \Deleted and expunge only this message
    await this.openMailbox(sourceMailbox)
    await new Promise<void>((resolve, reject) => {
      this.imap!.addFlags(String(uid), '\\Deleted', (err) => {
        if (err) return reject(err)
        // Attempt to expunge just this UID; if not supported, expunge all (risky)
        try {
          ;(this.imap as any).expunge(String(uid), (expErr: any) => {
            if (expErr) return reject(expErr)
            resolve()
          })
        } catch (_) {
          ;(this.imap as any).expunge((expErr: any) => {
            if (expErr) return reject(expErr)
            resolve()
          })
        }
      })
    })
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

      // 1. First reconcile deletions to sync server state
      console.log('🔄 Reconciling deleted emails...')
      const reconcileResult = await this.reconcileDeletions(emailAccountId, 'INBOX')
      
      if (reconcileResult.errors.length > 0) {
        console.warn('⚠️ Reconciliation warnings:', reconcileResult.errors)
        // Don't fail the sync, just log warnings
      }
      
      const archivedTotal = reconcileResult.archivedByUID + reconcileResult.archivedByMessageId
      if (archivedTotal > 0) {
        console.log(`✅ Archived ${archivedTotal} deleted emails`)
      }

      // 2. Search for new emails
      const newUIDs = await this.searchNewEmails(lastProcessedUID)
      
      console.log(`📧 Found ${newUIDs.length} new emails to process`)

      if (newUIDs.length === 0) {
        console.log('✅ No new emails to process')
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
  ): Promise<{
    archivedByUID: number
    archivedByMessageId: number
    errors: string[]
  }> {
    const result = {
      archivedByUID: 0,
      archivedByMessageId: 0,
      errors: []
    }

    if (!this.imap) {
      result.errors.push('IMAP connection not available')
      return result
    }

    try {
      // List UIDs on server
      const uidsOnServer: number[] = await new Promise((resolve, reject) => {
        this.imap!.search(['ALL'], (err, uids) => {
          if (err) reject(err)
          else resolve(uids || [])
        })
      })

      console.log(`🔍 Server has ${uidsOnServer.length} emails`)

      // Fetch known rows (with/without UID) not archived
      const { data: localRows, error } = await this.supabase
        .from('incoming_emails')
        .select('id, imap_uid, message_id, subject, from_address')
        .eq('email_account_id', emailAccountId)
        .is('archived_at', null)
        .order('date_received', { ascending: false })

      if (error) {
        result.errors.push(`Failed to load local emails: ${error.message}`)
        return result
      }

      console.log(`🔍 Database has ${localRows?.length || 0} unarchived emails`)

      if (!localRows || localRows.length === 0) {
        console.log('✅ No emails to reconcile')
        return result
      }

      // First pass: by UID
      const serverUIDSet = new Set(uidsOnServer)
      const toArchiveByUid = (localRows || [])
        .filter(r => typeof r.imap_uid === 'number' && !serverUIDSet.has(r.imap_uid as any))

      if (toArchiveByUid.length > 0) {
        console.log(`🧹 Archiving ${toArchiveByUid.length} emails (UID not on server)`)
        for (const email of toArchiveByUid) {
          console.log(`  - Archiving: ${email.from_address} - ${email.subject} (UID: ${email.imap_uid})`)
        }
        
        const { error: updErr } = await this.supabase
          .from('incoming_emails')
          .update({ archived_at: new Date().toISOString() })
          .in('id', toArchiveByUid.map(r => r.id))
        
        if (updErr) {
          result.errors.push(`Failed to archive by UID: ${updErr.message}`)
        } else {
          result.archivedByUID = toArchiveByUid.length
        }
      }

      // Second pass: for rows without imap_uid, compare Message-ID
      const withoutUid = (localRows || []).filter(r => !r.imap_uid && r.message_id)
      if (withoutUid.length > 0) {
        console.log(`🔍 Checking ${withoutUid.length} emails without UID by Message-ID`)
        
        try {
          // Fetch Message-ID headers for ALL on server
          const serverMessageIds = await this.fetchServerMessageIds()
          console.log(`🔍 Server has ${serverMessageIds.size} Message-IDs`)
          
          const toArchiveByMsgId = withoutUid
            .filter(r => r.message_id && !serverMessageIds.has(r.message_id))
          
          if (toArchiveByMsgId.length > 0) {
            console.log(`🧹 Archiving ${toArchiveByMsgId.length} emails (Message-ID not on server)`)
            for (const email of toArchiveByMsgId) {
              console.log(`  - Archiving: ${email.from_address} - ${email.subject} (Message-ID: ${email.message_id})`)
            }
            
            const { error: upd2 } = await this.supabase
              .from('incoming_emails')
              .update({ archived_at: new Date().toISOString() })
              .in('id', toArchiveByMsgId.map(r => r.id))
            
            if (upd2) {
              result.errors.push(`Failed to archive by Message-ID: ${upd2.message}`)
            } else {
              result.archivedByMessageId = toArchiveByMsgId.length
            }
          }
        } catch (msgIdError) {
          result.errors.push(`Failed to fetch server Message-IDs: ${msgIdError.message}`)
        }
      }

      const total = result.archivedByUID + result.archivedByMessageId
      console.log(`✅ Reconciliation complete: ${total} emails archived (${result.archivedByUID} by UID, ${result.archivedByMessageId} by Message-ID)`)
      
      return result

    } catch (error) {
      result.errors.push(`Reconciliation failed: ${error.message}`)
      console.error('❌ Reconciliation error:', error)
      return result
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
   * Perform full reconciliation (should be run periodically, e.g., daily)
   */
  async performFullReconciliation(
    userId: string,
    emailAccountId: string,
    config: IMAPConfig
  ): Promise<{
    success: boolean
    archivedEmails: number
    errors: string[]
    message: string
  }> {
    const result = {
      success: false,
      archivedEmails: 0,
      errors: [],
      message: ''
    }

    try {
      console.log('🔄 Starting full IMAP reconciliation...')
      
      await this.connect(config)
      if (!this.imap) {
        throw new Error('Failed to establish IMAP connection')
      }

      await this.openMailbox('INBOX')
      
      const reconcileResult = await this.reconcileDeletions(emailAccountId, 'INBOX')
      
      result.archivedEmails = reconcileResult.archivedByUID + reconcileResult.archivedByMessageId
      result.errors = reconcileResult.errors
      result.success = reconcileResult.errors.length === 0
      result.message = `Full reconciliation completed: ${result.archivedEmails} emails archived`
      
      // Update the full reconciliation timestamp
      await this.supabase
        .from('imap_connections')
        .update({
          last_full_reconciliation_at: new Date().toISOString()
        })
        .eq('email_account_id', emailAccountId)

      await this.disconnect()
      
      console.log(`✅ Full reconciliation completed: ${result.archivedEmails} emails archived`)
      return result

    } catch (error) {
      result.errors.push(error.message)
      result.message = `Full reconciliation failed: ${error.message}`
      console.error('❌ Full reconciliation error:', error)
      
      try {
        await this.disconnect()
      } catch (disconnectError) {
        console.error('❌ Error disconnecting after reconciliation failure:', disconnectError)
      }
      
      return result
    }
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
