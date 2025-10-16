/**
 * Email Notification Service
 * Handles sending system notification emails for AI Persona actions
 * Uses the persona's assigned email account to send notifications
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { renderPersonaNotificationEmail, type PersonaNotificationData } from './email-templates/ai-persona-notification.html'
import { getReplyJobEditUrl, getReplyJobCancelUrl, getPersonaSettingsUrl } from './email-urls'

export type Supabase = SupabaseClient<Database>

export interface SendPersonaNotificationParams {
  userId: string
  personaId: string
  replyJobId: string
  recipientEmail: string
  draftSubject: string
  draftBody: string
  scheduledAt: Date
  editableUntil: Date
  status: 'scheduled' | 'needs_approval'
}

export class EmailNotificationService {
  private supabase: Supabase

  constructor(supabase: Supabase) {
    this.supabase = supabase
  }

  /**
   * Send email notification for AI Persona reply draft
   * Sends FROM the persona's email account TO the user's Eisbrief account
   */
  async sendPersonaNotification(params: SendPersonaNotificationParams): Promise<void> {
    try {
      console.log('📧 Preparing to send AI persona notification email')

      // Check if notifications are enabled for this persona
      const notificationsEnabled = await this.isNotificationEnabled(params.personaId)
      if (!notificationsEnabled) {
        console.log('⏭️  Email notifications disabled for persona', params.personaId)
        return
      }

      // Get user email
      const userEmail = await this.getUserEmail(params.userId)
      if (!userEmail) {
        console.warn('⚠️  User email not found, cannot send notification')
        return
      }

      // Get persona details
      const persona = await this.getPersona(params.personaId)
      if (!persona) {
        console.warn('⚠️  Persona not found', params.personaId)
        return
      }

      // Get the email account for this reply job
      const emailAccount = await this.getEmailAccountFromReplyJob(params.replyJobId)
      if (!emailAccount) {
        console.warn('⚠️  Email account not found for reply job', params.replyJobId)
        return
      }

      console.log(`📧 Sending notification from: ${emailAccount.email} to: ${userEmail}`)

      // Calculate time remaining
      const timeRemaining = this.calculateTimeRemaining(params.scheduledAt)

      // Generate email content
      const emailData: PersonaNotificationData = {
        personaName: persona.sender_name || persona.name,
        personaInitials: this.getInitials(persona.sender_name || persona.name),
        personaAvatar: persona.avatar_url || undefined,
        recipientEmail: params.recipientEmail,
        draftSubject: params.draftSubject,
        draftBody: params.draftBody,
        timeRemaining,
        status: params.status,
        editUrl: getReplyJobEditUrl(params.replyJobId),
        cancelUrl: getReplyJobCancelUrl(params.replyJobId),
        settingsUrl: getPersonaSettingsUrl(params.personaId)
      }

      const htmlContent = renderPersonaNotificationEmail(emailData)

      // Email subject
      const emailSubject = params.status === 'needs_approval'
        ? `⚠️  AI Persona draft needs your approval`
        : `🤖 AI Persona drafting reply to ${params.recipientEmail}`

      // Send email using the persona's email account
      await this.sendEmail({
        to: userEmail,
        subject: emailSubject,
        htmlContent,
        emailAccount,
        senderName: persona.sender_name || persona.name
      })

      console.log('✅ AI persona notification email sent successfully')
    } catch (error) {
      console.error('❌ Failed to send AI persona notification email:', error)
      // Don't throw error - we don't want to block reply job creation if email fails
    }
  }

  /**
   * Check if email notifications are enabled for this persona
   */
  private async isNotificationEnabled(personaId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('ai_personas')
        .select('settings')
        .eq('id', personaId)
        .single()

      if (error || !data) {
        // Default to enabled if we can't fetch settings
        return true
      }

      // Check settings.email_notifications (default to true if not set)
      const settings = data.settings as any
      return settings?.email_notifications !== false
    } catch (error) {
      console.error('Error checking notification settings:', error)
      return true // Default to enabled on error
    }
  }

  /**
   * Get user's email address
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      if (error || !data) {
        return null
      }

      return data.email
    } catch (error) {
      console.error('Error fetching user email:', error)
      return null
    }
  }

  /**
   * Get persona details
   */
  private async getPersona(personaId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('ai_personas')
        .select('name, sender_name, avatar_url')
        .eq('id', personaId)
        .single()

      if (error || !data) {
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching persona:', error)
      return null
    }
  }

  /**
   * Get email account from reply job
   */
  private async getEmailAccountFromReplyJob(replyJobId: string): Promise<any> {
    try {
      const { data: replyJob, error: replyJobError } = await this.supabase
        .from('reply_jobs')
        .select('email_account_id')
        .eq('id', replyJobId)
        .single()

      if (replyJobError || !replyJob) {
        console.error('Error fetching reply job:', replyJobError)
        return null
      }

      // Get the email account details
      const { data: emailAccount, error: emailAccountError } = await this.supabase
        .from('email_accounts')
        .select('*')
        .eq('id', replyJob.email_account_id)
        .single()

      if (emailAccountError || !emailAccount) {
        console.error('Error fetching email account:', emailAccountError)
        return null
      }

      return emailAccount
    } catch (error) {
      console.error('Error in getEmailAccountFromReplyJob:', error)
      return null
    }
  }

  /**
   * Send email using the persona's email account
   * Supports SMTP and Gmail OAuth providers
   */
  private async sendEmail(params: {
    to: string
    subject: string
    htmlContent: string
    emailAccount: any
    senderName: string
  }): Promise<void> {
    // In development/testing, just log
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEV MODE] Email notification would be sent:')
      console.log(`   From: ${params.emailAccount.email} (${params.senderName})`)
      console.log(`   To: ${params.to}`)
      console.log(`   Subject: ${params.subject}`)
      console.log(`   Provider: ${params.emailAccount.provider}`)
      return
    }

    // Send email based on provider type
    try {
      if (params.emailAccount.provider === 'smtp') {
        await this.sendEmailSMTP(params)
      } else if (params.emailAccount.provider === 'gmail' || params.emailAccount.provider === 'gmail-imap-smtp') {
        await this.sendEmailGmail(params)
      } else {
        console.warn(`⚠️  Email provider ${params.emailAccount.provider} not yet supported for notifications`)
        console.log('📧 Notification not sent - unsupported provider')
      }
    } catch (error) {
      console.error('❌ Failed to send email:', error)
      throw error
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendEmailSMTP(params: {
    to: string
    subject: string
    htmlContent: string
    emailAccount: any
    senderName: string
  }): Promise<void> {
    const nodemailer = require('nodemailer')

    const transporter = nodemailer.createTransport({
      host: params.emailAccount.smtp_host,
      port: params.emailAccount.smtp_port,
      secure: params.emailAccount.smtp_secure,
      auth: {
        user: params.emailAccount.smtp_username,
        pass: params.emailAccount.smtp_password,
      },
    })

    const mailOptions = {
      from: `"${params.senderName}" <${params.emailAccount.email}>`,
      to: params.to,
      subject: params.subject,
      html: params.htmlContent,
      text: params.htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`✅ Notification email sent via SMTP: ${info.messageId}`)
  }

  /**
   * Send email via Gmail OAuth
   */
  private async sendEmailGmail(params: {
    to: string
    subject: string
    htmlContent: string
    emailAccount: any
    senderName: string
  }): Promise<void> {
    try {
      // Import the server-side Gmail service
      const { GmailIMAPSMTPServerService } = await import('./server/gmail-imap-smtp-server')
      const gmailService = new GmailIMAPSMTPServerService()

      const result = await gmailService.sendGmailEmail(params.emailAccount.id, {
        to: params.to,
        subject: params.subject,
        html: params.htmlContent,
        text: params.htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        senderName: params.senderName
      })

      console.log(`✅ Notification email sent via Gmail: ${result.messageId}`)
    } catch (error) {
      console.error('❌ Gmail notification send failed:', error)
      throw error
    }
  }

  /**
   * Calculate human-readable time remaining
   */
  private calculateTimeRemaining(scheduledAt: Date): string {
    const now = new Date()
    const diff = scheduledAt.getTime() - now.getTime()
    const minutes = Math.floor(diff / 1000 / 60)

    if (minutes < 1) {
      return 'less than a minute'
    } else if (minutes === 1) {
      return '1 minute'
    } else if (minutes < 60) {
      return `${minutes} minutes`
    } else {
      const hours = Math.floor(minutes / 60)
      return hours === 1 ? '1 hour' : `${hours} hours`
    }
  }

  /**
   * Get initials from name
   */
  private getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }
}

/**
 * Factory function to create email notification service
 */
export function createEmailNotificationService(supabase: Supabase): EmailNotificationService {
  return new EmailNotificationService(supabase)
}
