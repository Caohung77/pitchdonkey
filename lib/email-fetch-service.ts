import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { GmailIMAPSMTPService } from './gmail-imap-smtp'
import { IMAPProcessor } from './imap-processor'
import { createReplyProcessor } from './reply-processor'
import type { OAuthTokens } from './oauth-providers'

export type Supabase = SupabaseClient<Database>

export interface EmailFetchResult {
  accountId: string
  email: string
  provider: string
  success: boolean
  newEmails: number
  errors: string[]
}

export interface EmailFetchSummary {
  totalAccounts: number
  successfulAccounts: number
  failedAccounts: number
  totalNewEmails: number
  results: EmailFetchResult[]
  errors: string[]
}

/**
 * Unified service for fetching emails from all account types
 * Supports: Gmail OAuth, Outlook OAuth, SMTP/IMAP
 */
export class EmailFetchService {
  private supabase: Supabase

  constructor(supabase: Supabase) {
    this.supabase = supabase
  }

  /**
   * Fetch emails from all active email accounts
   */
  async fetchAllAccounts(userId?: string): Promise<EmailFetchSummary> {
    const summary: EmailFetchSummary = {
      totalAccounts: 0,
      successfulAccounts: 0,
      failedAccounts: 0,
      totalNewEmails: 0,
      results: [],
      errors: [],
    }

    try {
      console.log('📧 Starting email fetch for all accounts...')

      // Get all active email accounts
      // Note: Removed is_verified check as column doesn't exist in production DB yet
      let query = this.supabase
        .from('email_accounts')
        .select('*')

      // Optional: Filter by specific user (for testing)
      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data: accounts, error } = await query

      if (error) {
        summary.errors.push(`Failed to fetch email accounts: ${error.message}`)
        return summary
      }

      if (!accounts || accounts.length === 0) {
        console.log('📭 No active email accounts found')
        return summary
      }

      summary.totalAccounts = accounts.length
      console.log(`📬 Found ${accounts.length} active email account(s)`)

      // Process each account
      for (const account of accounts) {
        console.log(`\n📧 Processing account: ${account.email} (${account.provider})`)

        try {
          const result = await this.fetchAccountEmails(account)
          summary.results.push(result)

          if (result.success) {
            summary.successfulAccounts++
            summary.totalNewEmails += result.newEmails
            console.log(`✅ ${account.email}: ${result.newEmails} new email(s)`)
          } else {
            summary.failedAccounts++
            console.error(`❌ ${account.email}: ${result.errors.join(', ')}`)
          }
        } catch (error) {
          summary.failedAccounts++
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          summary.errors.push(`${account.email}: ${errorMsg}`)
          summary.results.push({
            accountId: account.id,
            email: account.email,
            provider: account.provider,
            success: false,
            newEmails: 0,
            errors: [errorMsg],
          })
          console.error(`❌ Error processing ${account.email}:`, error)
        }
      }

      console.log(`\n📊 Summary: ${summary.successfulAccounts}/${summary.totalAccounts} successful, ${summary.totalNewEmails} new emails`)
      return summary

    } catch (error) {
      console.error('❌ Critical error in fetchAllAccounts:', error)
      summary.errors.push(error instanceof Error ? error.message : 'Unknown error')
      return summary
    }
  }

  /**
   * Fetch emails from a single email account
   */
  private async fetchAccountEmails(account: any): Promise<EmailFetchResult> {
    const result: EmailFetchResult = {
      accountId: account.id,
      email: account.email,
      provider: account.provider,
      success: false,
      newEmails: 0,
      errors: [],
    }

    try {
      if (account.provider === 'gmail' || account.provider === 'gmail-imap-smtp') {
        // Gmail OAuth
        await this.fetchGmailEmails(account, result)
      } else if (account.provider === 'outlook') {
        // Outlook OAuth (not yet implemented)
        result.errors.push('Outlook fetching not yet implemented')
      } else if (account.provider === 'smtp') {
        // SMTP/IMAP
        await this.fetchIMAPEmails(account, result)
      } else {
        result.errors.push(`Unsupported provider: ${account.provider}`)
      }

      result.success = result.errors.length === 0
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Fetch emails from Gmail using OAuth
   */
  private async fetchGmailEmails(account: any, result: EmailFetchResult): Promise<void> {
    try {
      // Prepare OAuth tokens
      const tokens: OAuthTokens = {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.token_expires_at
          ? new Date(account.token_expires_at).getTime()
          : Date.now() + 3600 * 1000,
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      }

      // Create Gmail service
      const gmailService = new GmailIMAPSMTPService(tokens, account.email)

      // Fetch emails from INBOX (last 24 hours, unseen only)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      const emails = await gmailService.fetchEmails('INBOX', {
        limit: 50,
        since,
        unseen: true,
      })

      console.log(`📬 Fetched ${emails.length} unseen email(s) from Gmail: ${account.email}`)

      // Process and save each email
      for (const email of emails) {
        try {
          await this.saveIncomingEmail(account, email)
          result.newEmails++
        } catch (error) {
          console.error(`Error saving email ${email.id}:`, error)
          result.errors.push(`Failed to save email ${email.id}`)
        }
      }

    } catch (error) {
      console.error('Error fetching Gmail emails:', error)
      throw error
    }
  }

  /**
   * Fetch emails from SMTP/IMAP account
   */
  private async fetchIMAPEmails(account: any, result: EmailFetchResult): Promise<void> {
    const imapProcessor = new IMAPProcessor()

    try {
      // Connect to IMAP server
      await imapProcessor.connect({
        host: account.smtp_host,
        port: account.imap_port || 993,
        tls: account.smtp_secure !== false,
        user: account.smtp_username,
        password: account.smtp_password,
      })

      // Sync emails (last 100, from last processed UID)
      const syncResult = await imapProcessor.syncEmails(
        account.user_id,
        account.id,
        {
          host: account.smtp_host,
          port: account.imap_port || 993,
          tls: account.smtp_secure !== false,
          user: account.smtp_username,
          password: account.smtp_password,
        },
        100, // limit
        account.last_imap_uid || undefined
      )

      console.log(`📬 IMAP sync result for ${account.email}:`, {
        processed: syncResult.totalProcessed,
        new: syncResult.newEmails,
        lastUID: syncResult.lastProcessedUID,
      })

      result.newEmails = syncResult.newEmails

      // Update last processed UID
      if (syncResult.lastProcessedUID > 0) {
        await this.supabase
          .from('email_accounts')
          .update({ last_imap_uid: syncResult.lastProcessedUID })
          .eq('id', account.id)
      }

      // Disconnect
      await imapProcessor.disconnect()

    } catch (error) {
      console.error('Error fetching IMAP emails:', error)
      await imapProcessor.disconnect()
      throw error
    }
  }

  /**
   * Save incoming email to database and trigger reply processing
   */
  private async saveIncomingEmail(account: any, email: any): Promise<void> {
    try {
      // Check if email already exists
      const { data: existing } = await this.supabase
        .from('incoming_emails')
        .select('id')
        .eq('message_id', email.messageId || email.id)
        .maybeSingle()

      if (existing) {
        console.log(`⏭️  Email ${email.messageId || email.id} already exists, skipping`)
        return
      }

      // Parse sender
      const fromAddress = typeof email.from === 'string'
        ? email.from
        : email.from?.[0]?.address || email.from?.address || 'unknown@example.com'

      // Create incoming email record
      const { data: incomingEmail, error: insertError } = await this.supabase
        .from('incoming_emails')
        .insert({
          user_id: account.user_id,
          email_account_id: account.id,
          message_id: email.messageId || email.id,
          thread_id: email.threadId || email.messageId || email.id,
          from_address: fromAddress,
          to_address: account.email,
          subject: email.subject || '(No Subject)',
          body_text: email.text || email.textContent || '',
          body_html: email.html || email.htmlContent || '',
          date_received: email.date || email.dateReceived || new Date().toISOString(),
          in_reply_to: email.inReplyTo,
          references: email.references || email.emailReferences,
          has_attachments: (email.attachments?.length || 0) > 0,
          labels: email.labels || [],
          is_read: false,
          is_starred: false,
          is_archived: false,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error inserting incoming email:', insertError)
        throw insertError
      }

      console.log(`💾 Saved incoming email: ${email.subject || '(No Subject)'} from ${fromAddress}`)

      // Trigger reply processing (which will check for assigned agents and draft replies)
      await this.triggerReplyProcessing(incomingEmail)

    } catch (error) {
      console.error('Error saving incoming email:', error)
      throw error
    }
  }

  /**
   * Trigger reply processor to check if this email needs an autonomous reply
   */
  private async triggerReplyProcessing(incomingEmail: any): Promise<void> {
    try {
      // Create reply processor
      const replyProcessor = createReplyProcessor(this.supabase)

      // Process the incoming email
      // This will check if there's an assigned agent and draft a reply if needed
      await replyProcessor.processIncomingEmail(incomingEmail)

      console.log(`🤖 Reply processing triggered for email ${incomingEmail.id}`)
    } catch (error) {
      // Don't throw - reply processing errors shouldn't stop email fetching
      console.error('Error in reply processing:', error)
    }
  }
}

// Export singleton factory
export function createEmailFetchService(supabase: Supabase): EmailFetchService {
  return new EmailFetchService(supabase)
}
