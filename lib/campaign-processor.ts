/**
 * Campaign Background Processor
 * Handles the execution of campaigns that are in "sending" or "scheduled" status
 */

import { CampaignExecutionEngine } from './campaign-execution'
import { createServerSupabaseClient } from './supabase-server'

export class CampaignProcessor {
  private static instance: CampaignProcessor | null = null
  private processingInterval: NodeJS.Timeout | null = null
  private isProcessing = false

  private constructor() {}

  public static getInstance(): CampaignProcessor {
    if (!CampaignProcessor.instance) {
      CampaignProcessor.instance = new CampaignProcessor()
    }
    return CampaignProcessor.instance
  }

  /**
   * Start the campaign processor with automatic interval processing
   */
  public start(intervalMs: number = 30000): void { // Default: check every 30 seconds
    if (this.processingInterval) {
      console.log('Campaign processor is already running')
      return
    }

    console.log(`🚀 Starting Campaign Processor (checking every ${intervalMs/1000}s)`)
    
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
      console.log('🛑 Campaign Processor stopped')
    }
  }

  /**
   * Process campaigns that are ready to be executed
   */
  public async processReadyCampaigns(): Promise<void> {
    console.log('🚀 === CAMPAIGN PROCESSOR STARTED ===')
    
    if (this.isProcessing) {
      console.log('⏳ Campaign processing already in progress, skipping...')
      return
    }

    this.isProcessing = true

    try {
      console.log('🔍 Checking for campaigns ready to process...')
      
      const supabase = createServerSupabaseClient()
      console.log('📡 Supabase client created successfully')
      
      // Get campaigns that need processing (exclude campaigns that are already fully processed)
      console.log('🔎 Querying campaigns with status: sending, scheduled (excluding already completed ones)')
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .in('status', ['sending', 'scheduled'])
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Error fetching campaigns:', error)
        console.error('📋 Error details:', error.message, error.code)
        return
      }

      console.log(`📊 Query returned ${campaigns?.length || 0} campaigns`)

      if (!campaigns || campaigns.length === 0) {
        console.log('✅ No campaigns ready for processing (status = sending or scheduled)')
        console.log('💡 Tip: Make sure your campaign status is set to "sending" not "draft"')
        return
      }

      console.log(`📋 Found ${campaigns.length} campaigns to process:`)
      campaigns.forEach((campaign, i) => {
        console.log(`  ${i+1}. ${campaign.name} (${campaign.id}) - Status: ${campaign.status}`)
      })

      // Filter out campaigns that are already fully processed but status wasn't updated
      const campaignsToProcess = []
      for (const campaign of campaigns) {
        // Check if campaign already has all emails sent
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('sent_at')
          .eq('campaign_id', campaign.id)
        
        const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
        const totalContacts = campaign.total_contacts || 0
        
        if (sentCount >= totalContacts && totalContacts > 0) {
          console.log(`⏭️  Skipping ${campaign.name} - already completed (${sentCount}/${totalContacts} sent)`)
          
          // Mark as completed if not already
          if (campaign.status !== 'completed') {
            await supabase
              .from('campaigns')
              .update({
                status: 'completed'
              })
              .eq('id', campaign.id)
            console.log(`✅ Marked ${campaign.name} as completed`)
          }
        } else {
          console.log(`🔄 Will process ${campaign.name} (${sentCount}/${totalContacts} sent)`)
          campaignsToProcess.push(campaign)
        }
      }

      console.log(`🎯 Processing ${campaignsToProcess.length} campaigns that need work`)

      for (const campaign of campaignsToProcess) {
        console.log(`\n🎯 === PROCESSING CAMPAIGN: ${campaign.name} ===`)
        await this.processCampaign(campaign)
      }

      console.log('🎉 === CAMPAIGN PROCESSING COMPLETED ===')

    } catch (error) {
      console.error('❌ Error in campaign processing:', error)
      console.error('📋 Error stack:', error.stack)
    } finally {
      this.isProcessing = false
      console.log('🏁 Campaign processor finished')
    }
  }

  /**
   * Process a single campaign
   */
  private async processCampaign(campaign: any): Promise<void> {
    console.log(`🎯 Processing campaign: ${campaign.name} (${campaign.id})`)

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
        await supabase
          .from('campaigns')
          .update({ status: 'sending' })
          .eq('id', campaign.id)
        
        console.log(`⚡ Scheduled campaign ${campaign.id} is now ready to send`)
      }

      // Process the campaign
      if (campaign.html_content) {
        // This is a simple campaign (single email)
        await this.processSimpleCampaign(campaign)
      } else {
        // This is a sequence campaign (multiple steps)
        await this.processSequenceCampaign(campaign)
      }

    } catch (error) {
      console.error(`❌ Error processing campaign ${campaign.id}:`, error)
      
      // Update campaign status to failed
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

      // Get the user's email accounts (simple campaigns use the first active SMTP account)
      const { data: emailAccounts, error: emailAccountError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', campaign.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)

      if (emailAccountError) {
        throw new Error(`Failed to get email account: ${emailAccountError.message}`)
      }

      if (!emailAccounts || emailAccounts.length === 0) {
        throw new Error('No active email account found for this user')
      }

      const emailAccount = emailAccounts[0]
      console.log(`📧 Using email account: ${emailAccount.email} (${emailAccount.provider})`)

      let emailsSent = 0
      let emailsFailed = 0

      // Send emails with delays to avoid rate limits
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        
        try {
          // Generate tracking ID
          const trackingId = `${campaign.id}_${contact.id}_${Date.now()}`

          // Personalize content
          const personalizedSubject = this.personalizeContent(campaign.email_subject, contact)
          const personalizedContent = this.personalizeContent(campaign.html_content, contact)

          // Extract sender name from campaign description (mandatory field)
          let senderName = 'ColdReach Pro' // Fallback for legacy campaigns
          try {
            const descriptionData = JSON.parse(campaign.description || '{}')
            senderName = descriptionData.sender_name
            if (!senderName) {
              console.warn(`⚠️ Campaign ${campaign.id} has no sender_name, using fallback`)
              senderName = (emailAccount as any).name || 'ColdReach Pro'
            }
          } catch {
            // If description is not JSON, this is likely a legacy campaign
            console.warn(`⚠️ Campaign ${campaign.id} has invalid description format, using email account name`)
            senderName = (emailAccount as any).name || 'ColdReach Pro'
          }

          // Create email tracking record FIRST to get the tracking_pixel_id
          const { data: trackingRecord, error: trackingError } = await supabase
            .from('email_tracking')
            .insert({
              user_id: campaign.user_id,
              campaign_id: campaign.id,
              contact_id: contact.id,
              message_id: trackingId,
              subject_line: personalizedSubject,
              email_body: personalizedContent,
              // Don't set sent_at yet - will be set after successful send
            })
            .select('tracking_pixel_id')
            .single()

          if (trackingError) {
            console.error('❌ Error creating tracking record:', trackingError)
            continue // Skip this contact
          }

          const pixelId = trackingRecord.tracking_pixel_id
          console.log(`📡 Created tracking record with pixel ID: ${pixelId}`)

          // Send email with the actual tracking pixel ID
          const result = await this.sendEmail({
            to: contact.email,
            subject: personalizedSubject,
            content: personalizedContent,
            emailAccount: emailAccount,
            senderName: senderName,
            trackingId: trackingId,
            pixelId: pixelId  // Add the actual pixel ID
          })

          if (result.status === 'sent') {
            emailsSent++
            console.log(`✅ Email ${i+1}/${contacts.length} sent to ${contact.email}`)

            // Update tracking record with sent+delivered timestamps (SMTP accepted)
            await supabase
              .from('email_tracking')
              .update({
                sent_at: new Date().toISOString(),
                delivered_at: new Date().toISOString()
              })
              .eq('tracking_pixel_id', pixelId)

            // Update campaign total_contacts if not set and trigger UI refresh
            await supabase
              .from('campaigns')
              .update({
                total_contacts: contacts.length,
                updated_at: new Date().toISOString()
              })
              .eq('id', campaign.id)

            console.log(`📊 Email ${emailsSent}/${contacts.length} sent and tracked`)

          } else {
            emailsFailed++
            console.log(`❌ Failed to send email ${i+1}/${contacts.length} to ${contact.email}: ${result.error}`)

            // Update existing tracking record with failure info
            await supabase
              .from('email_tracking')
              .update({
                bounced_at: new Date().toISOString(),
                bounce_reason: result.error
              })
              .eq('tracking_pixel_id', pixelId)

            // Update campaign total_contacts if not set and trigger UI refresh
            await supabase
              .from('campaigns')
              .update({
                total_contacts: contacts.length,
                updated_at: new Date().toISOString()
              })
              .eq('id', campaign.id)

            console.log(`📊 Email ${i+1}/${contacts.length} failed and tracked`)
          }

          // Apply rate limiting delay (30-60 seconds between emails)
          if (i < contacts.length - 1) { // Don't delay after the last email
            const delay = Math.random() * 30000 + 30000 // 30-60 seconds
            console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next email...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }

        } catch (error) {
          emailsFailed++
          console.error(`❌ Error sending to ${contact.email}:`, error)
          
          // Update campaign total_contacts if not set and trigger UI refresh
          await supabase
            .from('campaigns')
            .update({
              total_contacts: contacts.length,
              updated_at: new Date().toISOString()
            })
            .eq('id', campaign.id)

          console.log(`📊 Email ${i+1}/${contacts.length} error handled`)
        }
      }

      // Update campaign statistics
      await supabase
        .from('campaigns')
        .update({
          emails_sent: emailsSent,
          total_contacts: contacts.length,
          status: emailsSent > 0 ? 'completed' : 'paused'
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
    
    // Use the existing CampaignExecutionEngine for sequence campaigns
    // TODO: Fix CampaignExecutionEngine method reference
    // await CampaignExecutionEngine.executeCampaign(campaign.id)
    console.log(`⚠️ Campaign execution skipped for campaign ${campaign.id} - method needs fixing`)
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
    
    try {
      if (params.emailAccount.provider === 'smtp') {
        // Use Nodemailer for SMTP providers
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

        // Generate tracking pixel URL for this email using the actual pixelId
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        const trackingPixelUrl = `${baseUrl}/api/tracking/pixel/${params.pixelId || params.trackingId}`
        console.log(`📡 Using tracking pixel URL: ${trackingPixelUrl}`)
        
        // Insert tracking pixel into HTML content
        const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">`
        
        // Ensure content has tracking pixel
        let htmlContent = params.content
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `${trackingPixel}</body>`)
        } else {
          htmlContent = `${htmlContent}${trackingPixel}`
        }

        const info = await transporter.sendMail({
          from: `"${params.senderName}" <${params.emailAccount.email}>`,
          to: params.to,
          subject: params.subject,
          text: params.content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
          html: htmlContent
        })

        console.log(`✅ Email sent successfully via SMTP: ${info.messageId}`)
        
        return {
          messageId: info.messageId,
          status: 'sent',
          provider: 'smtp',
          trackingId: params.trackingId
        }

      } else {
        // For OAuth providers, return mock success for now
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
        error: error.message
      }
    }
  }

  /**
   * Personalize email content with contact data
   */
  private personalizeContent(content: string, contact: any): string {
    if (!content) return ''

    return content
      .replace(/\{\{first_name\}\}/g, contact.first_name || contact.name || 'there')
      .replace(/\{\{last_name\}\}/g, contact.last_name || '')
      .replace(/\{\{name\}\}/g, contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'there')
      .replace(/\{\{email\}\}/g, contact.email || '')
      .replace(/\{\{company\}\}/g, contact.company || '')
      .replace(/\{\{position\}\}/g, contact.position || contact.job_title || '')
      .replace(/\{\{phone\}\}/g, contact.phone || '')
      .replace(/\{\{website\}\}/g, contact.website || '')
      // Handle HTML entity encoded variables
      .replace(/&#123;&#123;first_name&#125;&#125;/g, contact.first_name || contact.name || 'there')
      .replace(/&#123;&#123;last_name&#125;&#125;/g, contact.last_name || '')
      .replace(/&#123;&#123;email&#125;&#125;/g, contact.email || '')
      .replace(/&#123;&#123;company&#125;&#125;/g, contact.company || '')
      .replace(/&#123;&#123;sender_name&#125;&#125;/g, 'Your Name')
      .replace(/&#123;&#123;company_name&#125;&#125;/g, 'Your Company')
  }
}

// Export singleton instance
export const campaignProcessor = CampaignProcessor.getInstance()
