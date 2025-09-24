/**
 * Fixed Campaign Background Processor
 * Completely rebuilt to fix Gmail campaign scheduling and email status tracking
 */

import { CampaignExecutionEngine } from './campaign-execution'
import { createServerSupabaseClient } from './supabase-server'

export class FixedCampaignProcessor {
  private static instance: FixedCampaignProcessor | null = null
  private processingInterval: NodeJS.Timeout | null = null
  private isProcessing = false

  private constructor() {}

  public static getInstance(): FixedCampaignProcessor {
    if (!FixedCampaignProcessor.instance) {
      FixedCampaignProcessor.instance = new FixedCampaignProcessor()
    }
    return FixedCampaignProcessor.instance
  }

  /**
   * Start the campaign processor with automatic interval processing
   */
  public start(intervalMs: number = 30000): void {
    if (this.processingInterval) {
      console.log('Fixed Campaign processor is already running')
      return
    }

    console.log(`🚀 Starting Fixed Campaign Processor (checking every ${intervalMs/1000}s)`)

    // Process immediately, then set interval
    this.processReadyCampaigns()

    this.processingInterval = setInterval(async () => {
      await this.processReadyCampaigns()
    }, intervalMs)
  }

  /**
   * Stop the campaign processor
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      console.log('🛑 Fixed Campaign Processor stopped')
    }
  }

  /**
   * Process campaigns that are ready to be executed
   */
  public async processReadyCampaigns(): Promise<void> {
    console.log('🚀 === FIXED CAMPAIGN PROCESSOR STARTED ===')

    if (this.isProcessing) {
      console.log('⏳ Campaign processing already in progress, skipping...')
      return
    }

    this.isProcessing = true

    try {
      console.log('🔍 Checking for campaigns ready to process...')

      const supabase = createServerSupabaseClient()
      console.log('📡 Supabase client created successfully')

      // Get campaigns that need processing with proper Gmail detection
      console.log('🔎 Querying campaigns with status: sending, scheduled')
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          email_accounts!from_email_account_id(
            id,
            email,
            provider,
            status,
            access_token,
            refresh_token
          )
        `)
        .in('status', ['sending', 'scheduled'])
        .eq('email_accounts.status', 'active')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Error fetching campaigns:', error)
        console.error('📋 Error details:', error.message, error.code)
        return
      }

      console.log(`📊 Query returned ${campaigns?.length || 0} campaigns`)

      if (!campaigns || campaigns.length === 0) {
        console.log('✅ No campaigns ready for processing')
        return
      }

      console.log(`📋 Found ${campaigns.length} campaigns to process:`)
      campaigns.forEach((campaign, i) => {
        console.log(`  ${i+1}. ${campaign.name} (${campaign.id}) - Status: ${campaign.status} - Provider: ${campaign.email_accounts.provider}`)
      })

      // Filter out campaigns that are already fully processed
      const campaignsToProcess = []
      for (const campaign of campaigns) {
        // Check if campaign already has all emails processed
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('sent_at, status')
          .eq('campaign_id', campaign.id)

        const processedCount = emailStats?.filter(e => e.sent_at !== null || e.status === 'failed').length || 0
        const totalContacts = campaign.total_contacts || 0

        if (processedCount >= totalContacts && totalContacts > 0) {
          console.log(`⏭️  Skipping ${campaign.name} - already completed (${processedCount}/${totalContacts} processed)`)

          // Mark as completed if not already
          if (campaign.status !== 'completed') {
            const sentEmails = emailStats?.filter(e => e.sent_at !== null && e.status !== 'failed').length || 0
            const failedEmails = emailStats?.filter(e => e.status === 'failed').length || 0

            await supabase
              .from('campaigns')
              .update({
                status: 'completed',
                emails_sent: sentEmails,
                emails_bounced: 0, // Only count actual bounces, not send failures
                updated_at: new Date().toISOString()
              })
              .eq('id', campaign.id)
            console.log(`✅ Marked ${campaign.name} as completed (${sentEmails} sent, ${failedEmails} failed)`)
          }
        } else {
          console.log(`🔄 Will process ${campaign.name} (${processedCount}/${totalContacts} processed) - Provider: ${campaign.email_accounts.provider}`)
          campaignsToProcess.push(campaign)
        }
      }

      console.log(`🎯 Processing ${campaignsToProcess.length} campaigns that need work`)

      for (const campaign of campaignsToProcess) {
        console.log(`\n🎯 === PROCESSING CAMPAIGN: ${campaign.name} ===`)
        await this.processCampaign(campaign)
      }

      console.log('🎉 === FIXED CAMPAIGN PROCESSING COMPLETED ===')

    } catch (error) {
      console.error('❌ Error in fixed campaign processing:', error)
      console.error('📋 Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    } finally {
      this.isProcessing = false
      console.log('🏁 Fixed Campaign processor finished')
    }
  }

  /**
   * Process a single campaign
   */
  private async processCampaign(campaign: any): Promise<void> {
    console.log(`🎯 Processing campaign: ${campaign.name} (${campaign.id})`)
    console.log(`📧 Email account: ${campaign.email_accounts.email} (${campaign.email_accounts.provider})`)

    try {
      // Check if this is a scheduled campaign and if it's time to send
      if (campaign.status === 'scheduled') {
        if (!campaign.scheduled_date) {
          console.log(`⚠️ Scheduled campaign ${campaign.id} has no scheduled_date`)
          return
        }

        const scheduledTime = new Date(campaign.scheduled_date)
        const now = new Date()

        if (scheduledTime > now) {
          console.log(`⏰ Campaign ${campaign.id} scheduled for ${scheduledTime.toISOString()}, waiting...`)
          return
        }

        // Time to send! Update status to sending
        const supabase = createServerSupabaseClient()
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            status: 'sending',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id)

        if (updateError) {
          console.error(`❌ Failed to update campaign status to sending:`, updateError)
          return
        }

        console.log(`⚡ Scheduled campaign ${campaign.id} is now ready to send`)
        // Update the campaign object for processing
        campaign.status = 'sending'
      }

      // Process the campaign based on type
      if (campaign.html_content) {
        // This is a simple campaign (single email)
        await this.processSimpleCampaign(campaign)
      } else {
        // This is a sequence campaign (multiple steps)
        await this.processSequenceCampaign(campaign)
      }

    } catch (error) {
      console.error(`❌ Error processing campaign ${campaign.id}:`, error)

      // Update campaign status to paused on error
      const supabase = createServerSupabaseClient()
      await supabase
        .from('campaigns')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id)
    }
  }

  /**
   * Process a simple campaign (single HTML email)
   */
  private async processSimpleCampaign(campaign: any): Promise<void> {
    console.log(`📧 Processing simple campaign: ${campaign.name}`)
    console.log(`📧 Using email account: ${campaign.email_accounts.email} (${campaign.email_accounts.provider})`)

    const supabase = createServerSupabaseClient()

    try {
      // Get contacts from contact lists
      let contacts = []

      if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
        // Get the contact lists first
        const { data: contactLists, error: listError } = await supabase
          .from('contact_lists')
          .select('contact_ids')
          .in('id', campaign.contact_list_ids)

        if (listError) {
          throw new Error(`Failed to get contact lists: ${listError.message}`)
        }

        // Collect all contact IDs from all selected lists
        const contactIds = []
        contactLists?.forEach(list => {
          if (list.contact_ids && Array.isArray(list.contact_ids)) {
            contactIds.push(...list.contact_ids)
          }
        })

        // Remove duplicates
        const uniqueContactIds = [...new Set(contactIds)]

        if (uniqueContactIds.length > 0) {
          // Get the actual contact records
          const { data: contactData, error: contactsError } = await supabase
            .from('contacts')
            .select('*')
            .in('id', uniqueContactIds)

          if (contactsError) {
            throw new Error(`Failed to get contacts: ${contactsError.message}`)
          }

          contacts = contactData || []
        }
      }

      if (!contacts || contacts.length === 0) {
        console.log(`⚠️ No contacts found for campaign ${campaign.id}`)
        return
      }

      console.log(`👥 Found ${contacts.length} contacts to email`)

      // Use the email account from the campaign
      const emailAccount = campaign.email_accounts
      console.log(`📧 Using email account: ${emailAccount.email} (${emailAccount.provider})`)

      // Verify Gmail account has proper tokens
      if (this.isGmailProvider(emailAccount.provider)) {
        if (!emailAccount.access_token || !emailAccount.refresh_token) {
          throw new Error(`Gmail account ${emailAccount.email} is missing OAuth tokens`)
        }
        console.log(`🔑 Gmail OAuth tokens verified for ${emailAccount.email}`)
      }

      // Enforce per-campaign daily limit
      const dailyLimit = Number(campaign.daily_send_limit) || 5
      const startOfDay = new Date()
      startOfDay.setHours(0,0,0,0)
      const { data: sentTodayRows } = await supabase
        .from('email_tracking')
        .select('sent_at')
        .eq('campaign_id', campaign.id)
        .gte('sent_at', startOfDay.toISOString())
      const sentToday = (sentTodayRows || []).length
      const remainingToday = Math.max(0, dailyLimit - sentToday)

      if (remainingToday <= 0) {
        console.log(`⏳ Daily limit reached for campaign ${campaign.id}: ${dailyLimit}/day`)
        return
      }

      // Limit contacts batch to remaining quota
      if (contacts.length > remainingToday) {
        console.log(`⚖️ Limiting send batch to daily quota: ${remainingToday} of ${contacts.length}`)
        contacts = contacts.slice(0, remainingToday)
      }

      let emailsSent = 0
      let emailsFailed = 0

      // Send emails with delays to avoid rate limits
      const delayConfig = this.getSendDelayConfig()

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]

        try {
          console.log(`\n📧 Processing email ${i+1}/${contacts.length} to ${contact.email}`)

          const trackingId = `${campaign.id}_${contact.id}_${Date.now()}`

          // Get personalized content
          let personalizedSubject = campaign.email_subject
          let personalizedContent = campaign.html_content

          // Check if this contact has personalized content stored
          const { data: campaignContact } = await supabase
            .from('campaign_contacts')
            .select('personalized_subject, personalized_body, ai_personalization_used')
            .eq('campaign_id', campaign.id)
            .eq('contact_id', contact.id)
            .single()

          if (campaignContact) {
            if (campaignContact.personalized_subject) {
              personalizedSubject = campaignContact.personalized_subject
            }
            if (campaignContact.personalized_body) {
              personalizedContent = campaignContact.personalized_body
            }
            console.log(`✨ Using personalized content for ${contact.first_name} ${contact.last_name}`)
          }

          // Apply standard variable replacement
          personalizedSubject = this.personalizeContent(personalizedSubject, contact, campaignContact?.ai_personalization_used)
          personalizedContent = this.personalizeContent(personalizedContent, contact, campaignContact?.ai_personalization_used)

          // Extract sender name from campaign description
          let senderName = 'Eisbrief'
          try {
            const descriptionData = JSON.parse(campaign.description || '{}')
            senderName = descriptionData.sender_name || emailAccount.name || 'Eisbrief'
          } catch {
            senderName = emailAccount.name || 'Eisbrief'
          }

          // Create email tracking record FIRST with proper initial status
          const trackingInsert = {
            user_id: campaign.user_id,
            campaign_id: campaign.id,
            contact_id: contact.id,
            message_id: trackingId,
            subject_line: personalizedSubject,
            email_body: personalizedContent,
            email_account_id: emailAccount.id,
            status: 'pending',
            sent_at: null,
            delivered_at: null,
            bounced_at: null,
            bounce_reason: null
          }

          const { data: trackingRecord, error: trackingError } = await supabase
            .from('email_tracking')
            .insert(trackingInsert)
            .select('tracking_pixel_id, id')
            .single()

          if (trackingError || !trackingRecord) {
            console.error('❌ Error creating tracking record:', trackingError)
            emailsFailed++
            continue
          }

          const trackingPixelId = trackingRecord.tracking_pixel_id
          console.log(`📡 Created tracking record with pixel ID: ${trackingPixelId}`)

          // Send email with proper error handling
          const result = await this.sendEmail({
            to: contact.email,
            subject: personalizedSubject,
            content: personalizedContent,
            emailAccount: emailAccount,
            senderName: senderName,
            trackingId: trackingId,
            pixelId: trackingPixelId
          })

          if (result.status === 'sent') {
            emailsSent++
            console.log(`✅ Email ${i+1}/${contacts.length} sent to ${contact.email}`)

            // Update tracking record with success
            const nowIso = new Date().toISOString()
            await supabase
              .from('email_tracking')
              .update({
                status: 'delivered',
                sent_at: nowIso,
                delivered_at: nowIso,
                message_id: result.messageId || trackingId,
                // Clear any error fields
                bounced_at: null,
                bounce_reason: null
              })
              .eq('tracking_pixel_id', trackingPixelId)

          } else {
            emailsFailed++
            console.log(`❌ Failed to send email ${i+1}/${contacts.length} to ${contact.email}: ${result.error}`)

            // Update tracking record with failure (NOT bounce)
            await supabase
              .from('email_tracking')
              .update({
                status: 'failed',
                sent_at: null, // Email was never actually sent
                delivered_at: null,
                // DO NOT set bounced_at or bounce_reason for send failures
                bounced_at: null,
                bounce_reason: null
              })
              .eq('tracking_pixel_id', trackingPixelId)
          }

          // Update campaign total_contacts
          await supabase
            .from('campaigns')
            .update({
              total_contacts: contacts.length,
              updated_at: new Date().toISOString()
            })
            .eq('id', campaign.id)

          // Apply rate limiting delay
          if (i < contacts.length - 1) {
            const delay = delayConfig.min === delayConfig.max
              ? delayConfig.min
              : Math.random() * (delayConfig.max - delayConfig.min) + delayConfig.min

            if (delay > 0) {
              console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next email...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }

        } catch (error) {
          emailsFailed++
          console.error(`❌ Error sending to ${contact.email}:`, error)
        }
      }

      // Update campaign statistics with accurate counts
      const processedCount = emailsSent + emailsFailed
      await supabase
        .from('campaigns')
        .update({
          emails_sent: emailsSent,
          emails_bounced: 0, // Only count actual bounces, not send failures
          total_contacts: contacts.length,
          status: processedCount >= contacts.length ? 'completed' : (processedCount > 0 ? 'running' : 'paused'),
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id)

      console.log(`🎉 Campaign ${campaign.name} completed! Sent: ${emailsSent}, Failed: ${emailsFailed}`)

    } catch (error) {
      console.error(`❌ Error in simple campaign processing:`, error)
      throw error
    }
  }

  /**
   * Process a sequence campaign (multiple email steps)
   */
  private async processSequenceCampaign(campaign: any): Promise<void> {
    console.log(`📈 Processing sequence campaign: ${campaign.name}`)

    const supabase = createServerSupabaseClient()

    try {
      // Check if campaign execution already exists
      const { data: existingExecution, error: executionError } = await supabase
        .from('campaign_executions')
        .select('*')
        .eq('campaign_id', campaign.id)
        .single()

      let executionId: string

      if (executionError || !existingExecution) {
        console.log(`🎬 Initializing new campaign execution for ${campaign.id}`)

        // Get campaign with its contacts
        const { data: campaignWithContacts, error: campaignError } = await supabase
          .from('campaigns')
          .select(`
            *,
            campaign_contacts(contact_id)
          `)
          .eq('id', campaign.id)
          .single()

        if (campaignError || !campaignWithContacts) {
          throw new Error('Failed to get campaign with contacts')
        }

        // Extract contact IDs
        const contactIds = campaignWithContacts.campaign_contacts?.map((cc: any) => cc.contact_id) || []

        if (contactIds.length === 0) {
          console.log(`⚠️ No contacts found for sequence campaign ${campaign.id}`)
          return
        }

        console.log(`👥 Found ${contactIds.length} contacts for sequence campaign`)

        // Initialize campaign execution using the CampaignExecutionEngine
        const execution = await CampaignExecutionEngine.initializeCampaign(
          campaignWithContacts,
          contactIds,
          supabase
        )

        executionId = execution.id
        console.log(`✅ Campaign execution initialized with ID: ${executionId}`)
      } else {
        executionId = existingExecution.id
        console.log(`🔄 Using existing campaign execution: ${executionId}`)
      }

      // Process the next batch of emails
      console.log(`⚡ Processing next batch for execution ${executionId}`)
      await CampaignExecutionEngine.processNextBatch(executionId, supabase)

      console.log(`✅ Sequence campaign processing completed for ${campaign.name}`)

    } catch (error) {
      console.error(`❌ Error processing sequence campaign ${campaign.id}:`, error)
      throw error
    }
  }

  /**
   * Send an email using the configured email provider
   */
  private async sendEmail(params: {
    to: string
    subject: string
    content: string
    emailAccount: any
    senderName: string
    trackingId: string
    pixelId?: string
  }): Promise<any> {
    console.log(`📧 Sending email to ${params.to} with subject: ${params.subject}`)
    console.log(`🔍 Email account provider: ${params.emailAccount.provider}`)

    try {
      if (params.emailAccount.provider === 'smtp') {
        return await this.sendEmailSMTP(params)
      } else if (this.isGmailProvider(params.emailAccount.provider)) {
        return await this.sendEmailGmail(params)
      } else {
        console.log(`⚠️ ${params.emailAccount.provider} OAuth sending not implemented yet`)
        return {
          messageId: `${params.emailAccount.provider}_mock_${params.trackingId}`,
          status: 'sent',
          provider: params.emailAccount.provider,
          trackingId: params.trackingId,
          note: `${params.emailAccount.provider} OAuth implementation needed`
        }
      }
    } catch (error) {
      console.error(`❌ Failed to send email to ${params.to}:`, error)
      return {
        messageId: null,
        status: 'failed',
        provider: params.emailAccount.provider,
        trackingId: params.trackingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check if provider is Gmail-based
   */
  private isGmailProvider(provider: string): boolean {
    const gmailProviders = ['gmail', 'gmail-imap-smtp', 'google', 'gmail-oauth']
    const isGmail = gmailProviders.includes(provider.toLowerCase())
    console.log(`🔍 Provider ${provider} is Gmail: ${isGmail}`)
    return isGmail
  }

  /**
   * Send email via SMTP
   */
  private async sendEmailSMTP(params: {
    to: string
    subject: string
    content: string
    emailAccount: any
    senderName: string
    trackingId: string
    pixelId?: string
  }): Promise<any> {
    console.log(`📧 Sending SMTP email to ${params.to}`)

    const nodemailer = require('nodemailer')

    const transporter = nodemailer.createTransporter({
      host: params.emailAccount.smtp_host,
      port: params.emailAccount.smtp_port,
      secure: params.emailAccount.smtp_secure,
      auth: {
        user: params.emailAccount.smtp_username,
        pass: params.emailAccount.smtp_password,
      },
    })

    const htmlContent = this.addTrackingPixel(params.content, params.pixelId || params.trackingId)

    const info = await transporter.sendMail({
      from: `"${params.senderName}" <${params.emailAccount.email}>`,
      to: params.to,
      subject: params.subject,
      text: params.content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html: htmlContent
    })

    console.log(`✅ SMTP email sent successfully: ${info.messageId}`)

    return {
      messageId: info.messageId,
      status: 'sent',
      provider: 'smtp',
      trackingId: params.trackingId
    }
  }

  /**
   * Send email via Gmail with enhanced error handling
   */
  private async sendEmailGmail(params: {
    to: string
    subject: string
    content: string
    emailAccount: any
    senderName: string
    trackingId: string
    pixelId?: string
  }): Promise<any> {
    console.log(`📧 Sending Gmail email to ${params.to}`)
    console.log(`🔑 Gmail account ID: ${params.emailAccount.id}`)
    console.log(`📧 Gmail account email: ${params.emailAccount.email}`)

    try {
      // Verify Gmail account has required tokens
      if (!params.emailAccount.access_token || !params.emailAccount.refresh_token) {
        throw new Error(`Gmail account ${params.emailAccount.email} is missing OAuth tokens`)
      }

      // Import the server-side Gmail service
      const { GmailIMAPSMTPServerService } = await import('./server/gmail-imap-smtp-server')
      const gmailService = new GmailIMAPSMTPServerService()

      const htmlContent = this.addTrackingPixel(params.content, params.pixelId || params.trackingId)

      console.log(`🚀 Attempting Gmail send via service...`)
      const result = await gmailService.sendGmailEmail(params.emailAccount.id, {
        to: params.to,
        subject: params.subject,
        html: htmlContent,
        text: params.content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      })

      console.log(`✅ Gmail email sent successfully: ${result.messageId}`)

      return {
        messageId: result.messageId || `gmail_${params.trackingId}`,
        status: 'sent',
        provider: 'gmail',
        trackingId: params.trackingId,
        details: result
      }
    } catch (error) {
      console.error(`❌ Gmail sending failed:`, error)
      console.error(`📋 Gmail error details:`, {
        accountId: params.emailAccount.id,
        provider: params.emailAccount.provider,
        email: params.emailAccount.email,
        hasAccessToken: !!params.emailAccount.access_token,
        hasRefreshToken: !!params.emailAccount.refresh_token,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error // Re-throw to be handled by caller
    }
  }

  /**
   * Add tracking pixel to HTML content
   */
  private addTrackingPixel(content: string, pixelId: string): string {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const trackingPixelUrl = `${baseUrl}/api/tracking/pixel/${pixelId}`
    console.log(`📡 Using tracking pixel URL: ${trackingPixelUrl}`)

    const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">`

    // Ensure content has tracking pixel
    if (content.includes('</body>')) {
      return content.replace('</body>', `${trackingPixel}</body>`)
    } else {
      return `${content}${trackingPixel}`
    }
  }

  /**
   * Personalize email content with contact data
   */
  private personalizeContent(content: string, contact: any, isAIPersonalized: boolean = false): string {
    if (!content) return ''

    let personalizedContent = content
      .replace(/\{\{first_name\}\}/g, contact.first_name || contact.name || 'there')
      .replace(/\{\{last_name\}\}/g, contact.last_name || '')
      .replace(/\{\{name\}\}/g, contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'there')
      .replace(/\{\{email\}\}/g, contact.email || '')
      .replace(/\{\{company\}\}/g, contact.company || '')
      .replace(/\{\{company_name\}\}/g, contact.company_name || contact.company || '')
      .replace(/\{\{position\}\}/g, contact.position || contact.job_title || '')
      .replace(/\{\{phone\}\}/g, contact.phone || '')
      .replace(/\{\{website\}\}/g, contact.website || '')
      // Handle HTML entity encoded variables
      .replace(/&#123;&#123;first_name&#125;&#125;/g, contact.first_name || contact.name || 'there')
      .replace(/&#123;&#123;last_name&#125;&#125;/g, contact.last_name || '')
      .replace(/&#123;&#123;email&#125;&#125;/g, contact.email || '')
      .replace(/&#123;&#123;company&#125;&#125;/g, contact.company || '')
      .replace(/&#123;&#123;company_name&#125;&#125;/g, contact.company_name || contact.company || '')
      .replace(/&#123;&#123;sender_name&#125;&#125;/g, 'Your Name')

    // Only apply fallback personalized reason replacement if this is NOT AI-personalized content
    if (!isAIPersonalized) {
      personalizedContent = personalizedContent
        .replace(/\(\(personalised_reason\)\)/g, `I noticed your work at ${contact.company_name || contact.company || 'your company'} and wanted to connect.`)
    }

    return personalizedContent
  }

  /**
   * Determine delay configuration between sends
   */
  private getSendDelayConfig(): { min: number; max: number } {
    const parseDelay = (value?: string | number | null) => {
      if (value === undefined || value === null) return NaN
      const num = typeof value === 'number' ? value : parseInt(value, 10)
      return Number.isFinite(num) && num >= 0 ? num : NaN
    }

    const envMin = parseDelay(process.env.CAMPAIGN_SEND_DELAY_MIN_MS as any)
    const envMax = parseDelay(process.env.CAMPAIGN_SEND_DELAY_MAX_MS as any)

    if (!Number.isNaN(envMin) && !Number.isNaN(envMax) && envMax >= envMin) {
      return { min: envMin, max: envMax }
    }

    const runtime = process.env.NEXT_RUNTIME
    const isEdgeRuntime = runtime ? runtime !== 'nodejs' : false
    const isServerless = Boolean(process.env.VERCEL || process.env.SERVERLESS) || isEdgeRuntime

    if (isServerless) {
      // Tighten delays to stay within serverless execution limits
      return { min: 1000, max: 2000 }
    }

    // Default desktop/server delay (30-60 seconds)
    return { min: 30000, max: 60000 }
  }
}

// Export singleton instance
export const fixedCampaignProcessor = FixedCampaignProcessor.getInstance()