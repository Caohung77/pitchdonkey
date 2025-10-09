import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { GmailIMAPSMTPService } from './gmail-imap-smtp'
import type { OAuthTokens } from './oauth-providers'

export type Supabase = SupabaseClient<Database>

export interface ReplyJobProcessingResult {
  processed: number
  sent: number
  failed: number
  skipped: number
  errors: string[]
}

/**
 * Service for processing scheduled reply jobs and sending autonomous emails
 */
export class ReplyJobProcessor {
  private supabase: Supabase

  constructor(supabase: Supabase) {
    this.supabase = supabase
  }

  /**
   * Process all ready reply jobs
   */
  async processReplyJobs(limit: number = 100): Promise<ReplyJobProcessingResult> {
    const result: ReplyJobProcessingResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }

    try {
      console.log('🤖 Processing scheduled reply jobs...')

      // Get jobs that are ready to be sent
      const now = new Date().toISOString()
      const { data: jobs, error } = await this.supabase
        .from('reply_jobs')
        .select(`
          *,
          email_account:email_accounts!reply_jobs_email_account_id_fkey(
            id,
            email,
            provider,
            access_token,
            refresh_token,
            token_expires_at,
            smtp_host,
            smtp_port,
            smtp_username,
            smtp_password,
            smtp_secure
          ),
          agent:outreach_agents!reply_jobs_agent_id_fkey(
            id,
            name,
            sender_name,
            sender_role
          ),
          contact:contacts(
            id,
            email,
            first_name,
            last_name
          )
        `)
        .in('status', ['scheduled', 'approved'])
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(limit)

      if (error) {
        result.errors.push(`Error fetching reply jobs: ${error.message}`)
        return result
      }

      if (!jobs || jobs.length === 0) {
        console.log('📭 No reply jobs ready to be sent')
        return result
      }

      console.log(`📬 Found ${jobs.length} reply jobs ready to be sent`)

      // Process each job
      for (const job of jobs) {
        result.processed++
        try {
          await this.processReplyJob(job)
          result.sent++
        } catch (error) {
          result.failed++
          result.errors.push(`Job ${job.id}: ${error.message}`)
          console.error(`❌ Error processing reply job ${job.id}:`, error)
        }
      }

      console.log(`✅ Processed ${result.sent}/${result.processed} reply jobs successfully`)
      return result

    } catch (error) {
      console.error('❌ Error in reply job processing:', error)
      result.errors.push(error.message)
      return result
    }
  }

  /**
   * Process a specific reply job immediately
   */
  async processReplyJobById(jobId: string, userId: string): Promise<boolean> {
    const { data: job, error } = await this.supabase
      .from('reply_jobs')
      .select(`
        *,
        email_account:email_accounts!reply_jobs_email_account_id_fkey(
          id,
          email,
          provider,
          access_token,
          refresh_token,
          token_expires_at,
          smtp_host,
          smtp_port,
          smtp_username,
          smtp_password,
          smtp_secure
        ),
        agent:outreach_agents!reply_jobs_agent_id_fkey(
          id,
          name,
          sender_name,
          sender_role
        ),
        contact:contacts(
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', jobId)
      .eq('user_id', userId)
      .single()

    if (error || !job) {
      console.error('❌ Reply job not found for immediate processing:', error)
      throw new Error('Reply job not found')
    }

    // Override editable window so manual send is allowed immediately
    job.editable_until = new Date(Date.now() - 60 * 1000).toISOString()

    await this.processReplyJob(job)
    return true
  }

  /**
   * Process a single reply job
   */
  private async processReplyJob(job: any): Promise<void> {
    console.log(`📤 Processing reply job ${job.id} for ${job.contact?.email || 'unknown'}`)

    // Check if job is still editable
    if (job.editable_until) {
      const editableUntil = new Date(job.editable_until)
      const now = new Date()
      if (now < editableUntil) {
        console.log(`⏳ Job ${job.id} is still editable (until ${editableUntil.toISOString()}) - skipping`)
        return
      }
    }

    // Update status to sending
    await this.updateJobStatus(job.id, 'sending')

    try {
      // Send the email
      const messageId = await this.sendReply(job)

      // Update job as sent
      await this.supabase
        .from('reply_jobs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          audit_log: [
            ...(job.audit_log || []),
            {
              action: 'email_sent',
              timestamp: new Date().toISOString(),
              messageId,
            },
          ],
        })
        .eq('id', job.id)

      // Create email tracking record
      await this.createEmailTracking(job, messageId)

      // Pause campaign if this is a successful reply
      if (job.contact_id) {
        await this.pauseCampaignForContact(job.contact_id, job.user_id)
      }

      console.log(`✅ Reply job ${job.id} sent successfully (Message-ID: ${messageId})`)

    } catch (error) {
      console.error(`❌ Failed to send reply job ${job.id}:`, error)

      // Increment retry count
      const newRetryCount = (job.retry_count || 0) + 1
      const maxRetries = 3

      if (newRetryCount >= maxRetries) {
        // Mark as failed after max retries
        await this.supabase
          .from('reply_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: newRetryCount,
            updated_at: new Date().toISOString(),
            audit_log: [
              ...(job.audit_log || []),
              {
                action: 'send_failed_max_retries',
                timestamp: new Date().toISOString(),
                error: error.message,
                retryCount: newRetryCount,
              },
            ],
          })
          .eq('id', job.id)

        console.error(`💥 Reply job ${job.id} failed permanently after ${maxRetries} retries`)
      } else {
        // Schedule retry (exponential backoff: 5min, 15min, 45min)
        const retryDelayMinutes = Math.pow(3, newRetryCount) * 5
        const nextRetry = new Date(Date.now() + retryDelayMinutes * 60 * 1000)

        await this.supabase
          .from('reply_jobs')
          .update({
            status: 'scheduled', // Reset to scheduled for retry
            scheduled_at: nextRetry.toISOString(),
            error_message: error.message,
            retry_count: newRetryCount,
            updated_at: new Date().toISOString(),
            audit_log: [
              ...(job.audit_log || []),
              {
                action: 'send_failed_retry_scheduled',
                timestamp: new Date().toISOString(),
                error: error.message,
                retryCount: newRetryCount,
                nextRetry: nextRetry.toISOString(),
              },
            ],
          })
          .eq('id', job.id)

        console.log(`🔄 Reply job ${job.id} retry ${newRetryCount}/${maxRetries} scheduled for ${nextRetry.toISOString()}`)
      }

      throw error
    }
  }

  /**
   * Send the reply email
   */
  private async sendReply(job: any): Promise<string> {
    const emailAccount = job.email_account
    const agent = job.agent
    const contact = job.contact

    if (!emailAccount) {
      throw new Error('Email account not found')
    }

    console.log(`📧 Sending via ${emailAccount.provider}: ${emailAccount.email}`)

    // Determine sender name
    const senderName = agent?.sender_name || agent?.name || undefined

    // Prepare email options with threading headers
    const emailOptions = {
      to: contact?.email || job.incoming_email?.from_address,
      subject: job.draft_subject,
      text: job.draft_body,
      html: this.convertTextToHTML(job.draft_body),
      senderName,
      // Add In-Reply-To and References headers for proper email threading
      inReplyTo: job.message_ref || undefined,
      references: job.message_ref || undefined,
    }

    // Send based on provider
    if (emailAccount.provider === 'gmail' || emailAccount.provider === 'gmail-imap-smtp') {
      return await this.sendViaGmail(emailAccount, emailOptions)
    } else if (emailAccount.provider === 'smtp') {
      return await this.sendViaSMTP(emailAccount, emailOptions)
    } else {
      throw new Error(`Unsupported email provider: ${emailAccount.provider}`)
    }
  }

  /**
   * Send email via Gmail
   */
  private async sendViaGmail(emailAccount: any, options: any): Promise<string> {
    // Prepare OAuth tokens
    const tokens: OAuthTokens = {
      access_token: emailAccount.access_token,
      refresh_token: emailAccount.refresh_token,
      expires_at: emailAccount.token_expires_at
        ? new Date(emailAccount.token_expires_at).getTime()
        : Date.now() + 3600 * 1000,
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    }

    // Create Gmail service
    const gmailService = new GmailIMAPSMTPService(tokens, emailAccount.email)

    // Send email with threading headers
    const { messageId } = await gmailService.sendEmail({
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      senderName: options.senderName,
      inReplyTo: options.inReplyTo,
      references: options.references,
    })

    console.log(`✅ Email sent with threading headers - In-Reply-To: ${options.inReplyTo}`)
    return messageId
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSMTP(emailAccount: any, options: any): Promise<string> {
    const nodemailer = require('nodemailer')

    console.log(`📧 Sending SMTP email to ${options.to} via ${emailAccount.smtp_host}`)

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: emailAccount.smtp_host,
      port: emailAccount.smtp_port,
      secure: emailAccount.smtp_secure,
      auth: {
        user: emailAccount.smtp_username,
        pass: emailAccount.smtp_password,
      },
    })

    // Build email headers for threading
    const headers: Record<string, string> = {}
    if (options.inReplyTo) {
      headers['In-Reply-To'] = options.inReplyTo
    }
    if (options.references) {
      headers['References'] = options.references
    }

    // Build sender name
    const from = options.senderName
      ? `"${options.senderName}" <${emailAccount.email}>`
      : emailAccount.email

    // Send email
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      headers, // Add threading headers
      encoding: 'utf8',
    })

    console.log(`✅ SMTP email sent successfully: ${info.messageId}`)
    console.log(`✅ Email sent with threading headers - In-Reply-To: ${options.inReplyTo}`)

    return info.messageId
  }

  /**
   * Convert plain text to simple HTML
   */
  private convertTextToHTML(text: string): string {
    // Simple conversion: wrap paragraphs in <p> tags and preserve line breaks
    const paragraphs = text.split('\n\n')
    const htmlParagraphs = paragraphs.map(p => {
      const lines = p.split('\n').join('<br>')
      return `<p>${lines}</p>`
    })
    return htmlParagraphs.join('\n')
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('reply_jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      console.error(`❌ Error updating job status:`, error)
    }
  }

  /**
   * Create email tracking record
   */
  private async createEmailTracking(job: any, messageId: string): Promise<void> {
    // Create tracking record in email_tracking or email_sends table
    // This allows monitoring of opens, clicks, bounces, etc.
    const trackingData = {
      user_id: job.user_id,
      email_account_id: job.email_account_id,
      contact_id: job.contact_id,
      message_id: messageId,
      subject: job.draft_subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      // Link to reply job
      metadata: {
        reply_job_id: job.id,
        agent_id: job.agent_id,
        autonomous: true,
      },
    }

    // Try email_sends table (campaign system)
    const { error: sendError } = await this.supabase
      .from('email_sends')
      .insert({
        ...trackingData,
        campaign_id: null, // Not part of a campaign
        sequence_step: 1,
        personalized_subject: job.draft_subject,
        personalized_body: job.draft_body,
      })

    if (sendError) {
      console.warn(`⚠️ Could not create email_sends tracking (table may not exist): ${sendError.message}`)
    }
  }

  /**
   * Pause campaign for contact after successful autonomous reply
   */
  private async pauseCampaignForContact(contactId: string, userId: string): Promise<void> {
    try {
      // Find active campaign progress for this contact
      const { data: campaignProgress, error } = await this.supabase
        .from('campaign_contact_progress')
        .select('campaign_id, contact_id, status')
        .eq('contact_id', contactId)
        .in('status', ['active', 'scheduled'])

      if (error) {
        console.error(`❌ Error finding campaign progress:`, error)
        return
      }

      if (!campaignProgress || campaignProgress.length === 0) {
        console.log(`⏭️ No active campaigns found for contact ${contactId}`)
        return
      }

      // Pause all active campaigns for this contact
      for (const progress of campaignProgress) {
        await this.supabase
          .from('campaign_contact_progress')
          .update({
            status: 'paused',
            updated_at: new Date().toISOString(),
          })
          .eq('campaign_id', progress.campaign_id)
          .eq('contact_id', contactId)

        console.log(`✅ Paused campaign ${progress.campaign_id} for contact ${contactId} (autonomous reply sent)`)
      }

    } catch (error) {
      console.error(`❌ Error pausing campaigns for contact:`, error)
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Get reply job statistics for a user
   */
  async getReplyJobStats(userId: string, dateFrom?: string): Promise<any> {
    const query = this.supabase
      .from('reply_jobs')
      .select('status, risk_score, created_at, sent_at')
      .eq('user_id', userId)

    if (dateFrom) {
      query.gte('created_at', dateFrom)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching reply job stats:', error)
      return {}
    }

    // Calculate statistics
    const stats = {
      total: data?.length || 0,
      by_status: {},
      avg_risk_score: 0,
      avg_time_to_send: 0,
    }

    let totalRisk = 0
    let totalTimeToSend = 0
    let sentCount = 0

    data?.forEach(job => {
      // Count by status
      stats.by_status[job.status] = (stats.by_status[job.status] || 0) + 1

      // Sum risk scores
      if (job.risk_score != null) {
        totalRisk += job.risk_score
      }

      // Calculate time to send
      if (job.sent_at && job.created_at) {
        const created = new Date(job.created_at).getTime()
        const sent = new Date(job.sent_at).getTime()
        totalTimeToSend += (sent - created) / (1000 * 60) // minutes
        sentCount++
      }
    })

    stats.avg_risk_score = data && data.length > 0 ? totalRisk / data.length : 0
    stats.avg_time_to_send = sentCount > 0 ? totalTimeToSend / sentCount : 0

    return stats
  }
}

// Export singleton factory
export function createReplyJobProcessor(supabase: Supabase): ReplyJobProcessor {
  return new ReplyJobProcessor(supabase)
}
