/**
 * Campaign Background Processor
 * Handles the execution of campaigns that are in "sending" or "scheduled" status
 */

import { CampaignExecutionEngine } from './campaign-execution'
import { createServerSupabaseClient } from './supabase-server'
import { EmailLinkRewriter } from './email-link-rewriter'

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
        .select(`
          *,
          first_batch_sent_at,
          next_batch_send_time,
          current_batch_number
        `)
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
        // Check if campaign already has all emails processed (sent OR bounced)
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('sent_at, bounced_at')
          .eq('campaign_id', campaign.id)

        const processedCount = emailStats?.filter(e => e.sent_at !== null).length || 0
        const totalContacts = campaign.total_contacts || 0

        if (processedCount >= totalContacts && totalContacts > 0) {
          console.log(`⏭️  Skipping ${campaign.name} - already completed (${processedCount}/${totalContacts} processed)`)

          // Mark as completed if not already and update statistics
          if (campaign.status !== 'completed') {
            const sentEmails = emailStats?.filter(e => e.sent_at !== null && e.bounced_at === null).length || 0
            const bouncedEmails = emailStats?.filter(e => e.bounced_at !== null).length || 0

            await supabase
              .from('campaigns')
              .update({
                status: 'completed',
                emails_sent: sentEmails,
                emails_bounced: bouncedEmails,
                end_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', campaign.id)
            console.log(`✅ Marked ${campaign.name} as completed (${sentEmails} sent, ${bouncedEmails} bounced)`)
          }
        } else {
          console.log(`🔄 Will process ${campaign.name} (${processedCount}/${totalContacts} processed)`)
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

        // Time to send! Update status to sending and set start date
        const supabase = createServerSupabaseClient()
        await supabase
          .from('campaigns')
          .update({
            status: 'sending',
            start_date: new Date().toISOString()
          })
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

      // Choose email account: honor campaign.from_email_account_id if provided
      let emailAccount: any = null
      if (campaign.from_email_account_id) {
        const { data: acc, error: eaErr } = await supabase
          .from('email_accounts')
          .select('*')
          .eq('user_id', campaign.user_id)
          .eq('id', campaign.from_email_account_id)
          .eq('status', 'active')
          .single()
        if (eaErr || !acc) {
          throw new Error('Selected email account is not available')
        }
        emailAccount = acc
      } else {
        const { data: emailAccounts, error: emailAccountError } = await supabase
          .from('email_accounts')
          .select('*')
          .eq('user_id', campaign.user_id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
        if (emailAccountError || !emailAccounts || emailAccounts.length === 0) {
          throw new Error('No active email account found for this user')
        }
        emailAccount = emailAccounts[0]
      }
      console.log(`📧 Using email account: ${emailAccount.email} (${emailAccount.provider})`)      

      // Implement 24-hour interval batch scheduling
      const dailyLimit = Number(campaign.daily_send_limit) || 5
      const now = new Date()

      // Check if this is the first batch or a scheduled batch
      const isFirstBatch = !campaign.first_batch_sent_at
      const currentBatchNumber = campaign.current_batch_number || 0

      if (isFirstBatch) {
        // First batch - set initial timing
        console.log(`🚀 Starting first batch for campaign ${campaign.id}`)
        const nextBatchTime = new Date(now.getTime() + (24 * 60 * 60 * 1000)) // 24 hours from now

        await supabase
          .from('campaigns')
          .update({
            first_batch_sent_at: now.toISOString(),
            current_batch_number: 1,
            next_batch_send_time: nextBatchTime.toISOString()
          })
          .eq('id', campaign.id)

        console.log(`⏰ Next batch scheduled for: ${nextBatchTime.toISOString()}`)
      } else {
        // Subsequent batches - check if it's time to send
        if (!campaign.next_batch_send_time) {
          console.log(`⚠️ Missing next_batch_send_time for campaign ${campaign.id}, skipping`)
          return
        }

        const nextBatchTime = new Date(campaign.next_batch_send_time)
        const batchWindow = this.isWithinBatchSendWindow(nextBatchTime, now)

        if (!batchWindow.canSend) {
          console.log(`⏳ Campaign ${campaign.id} not ready yet. Next batch in ${Math.round(batchWindow.timeUntilBatch / (60 * 1000))} minutes`)
          return
        }

        if (batchWindow.windowStatus === 'overdue') {
          console.log(`⚠️ Campaign ${campaign.id} batch is ${Math.round(Math.abs(batchWindow.timeUntilBatch) / (60 * 1000))} minutes overdue`)
        } else {
          console.log(`✅ Campaign ${campaign.id} batch is ready to send (${batchWindow.windowStatus})`)
        }

        // Update for next batch (24 hours from original scheduled time)
        const nextNextBatchTime = new Date(nextBatchTime.getTime() + (24 * 60 * 60 * 1000))
        await supabase
          .from('campaigns')
          .update({
            current_batch_number: currentBatchNumber + 1,
            next_batch_send_time: nextNextBatchTime.toISOString()
          })
          .eq('id', campaign.id)

        console.log(`📅 Batch ${currentBatchNumber + 1} processing. Next batch: ${nextNextBatchTime.toISOString()}`)
      }

      // Limit contacts batch to daily quota
      if (contacts.length > dailyLimit) {
        console.log(`⚖️ Limiting batch to daily quota: ${dailyLimit} of ${contacts.length} contacts`)
        contacts = contacts.slice(0, dailyLimit)
      }

      let emailsSent = 0
      let emailsFailed = 0

      // Send emails with delays to avoid rate limits
      const delayConfig = this.getSendDelayConfig()

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        
        // Check if email already sent to this contact to prevent duplicates
        const { data: existingTracking } = await supabase
          .from('email_tracking')
          .select('id, tracking_pixel_id, status')
          .eq('campaign_id', campaign.id)
          .eq('contact_id', contact.id)
          .single()

        if (existingTracking && existingTracking.status !== 'failed') {
          console.log(`⏭️ Skipping ${contact.email} - email already sent/delivered (status: ${existingTracking.status})`)
          continue // Skip this contact
        }

        const trackingId = `${campaign.id}_${contact.id}_${Date.now()}`
        let trackingPixelId: string | null = null
        try {
          // Generate tracking ID (used for message + tracking fallback)

          // Get personalized content from database if available
          let personalizedSubject = campaign.email_subject
          let personalizedContent = campaign.html_content
          
          // Check if this contact has personalized content stored in campaign_contacts
          const { data: campaignContact, error: campaignContactError } = await supabase
            .from('campaign_contacts')
            .select('personalized_subject, personalized_body, ai_personalization_used')
            .eq('campaign_id', campaign.id)
            .eq('contact_id', contact.id)
            .single()
          
          if (campaignContactError || !campaignContact) {
            console.log(`ℹ️ No campaign_contact record for ${contact.id}, using base campaign content (immediate send)`)

            // For immediate sends, we should use the base campaign content that was already set
            // personalizedSubject and personalizedContent are already set from campaign.email_subject and campaign.html_content

            // Only try description fallback if the base content is missing
            if (!personalizedContent || personalizedContent.trim() === '') {
              console.warn(`⚠️ Base campaign content is missing, trying description fallback for ${contact.id}`)

              try {
                const desc = JSON.parse(campaign.description || '{}')
                const map = desc?.personalized_emails || {}
                const fromMap = map[contact.id]
                if (fromMap?.subject || fromMap?.content) {
                  if (fromMap.subject) personalizedSubject = fromMap.subject
                  if (fromMap.content) personalizedContent = fromMap.content
                  console.log(`✨ Using fallback personalized content from description for ${contact.first_name} ${contact.last_name}`)

                  // Best-effort backfill campaign_contacts for analytics/history
                  try {
                    await supabase
                      .from('campaign_contacts')
                      .insert({
                        campaign_id: campaign.id,
                        contact_id: contact.id,
                        status: 'pending',
                        current_sequence: 1,
                        personalized_subject: personalizedSubject,
                        personalized_body: personalizedContent,
                        ai_personalization_used: true
                      })
                  } catch (e) {
                    console.warn('⚠️ Backfill campaign_contacts failed (non-fatal):', (e as any)?.message)
                  }
                }
              } catch (e) {
                console.warn('⚠️ Failed to parse campaign description for fallback content:', e)
              }
            } else {
              console.log(`✅ Using base campaign HTML content for ${contact.first_name} ${contact.last_name}`)
              console.log(`📧 Content length: ${personalizedContent.length} chars`)
              console.log(`📧 Content preview: ${personalizedContent.substring(0, 300)}...`)
            }
          } else {
            // Use personalized content if available
            if (campaignContact.personalized_subject) {
              personalizedSubject = campaignContact.personalized_subject
              console.log(`✨ Using personalized subject for ${contact.first_name} ${contact.last_name}`)
            }
            if (campaignContact.personalized_body) {
              personalizedContent = campaignContact.personalized_body
              console.log(`✨ Using personalized content for ${contact.first_name} ${contact.last_name} (AI: ${campaignContact.ai_personalization_used})`)
              console.log(`🔍 Personalized content preview: ${campaignContact.personalized_body.substring(0, 200)}...`)
            }
          }

          // Apply standard variable replacement to the personalized content
          console.log(`🔧 Before personalization - Contact: ${JSON.stringify({name: contact.first_name + ' ' + contact.last_name, email: contact.email})}`)
          console.log(`🔧 Before personalization - Subject: ${personalizedSubject}`)
          console.log(`🔧 Before personalization - Content preview: ${personalizedContent.substring(0, 200)}...`)

          personalizedSubject = this.personalizeContent(personalizedSubject, contact, campaignContact?.ai_personalization_used)
          personalizedContent = this.personalizeContent(personalizedContent, contact, campaignContact?.ai_personalization_used)

          console.log(`✅ After personalization - Subject: ${personalizedSubject}`)
          console.log(`✅ After personalization - Content preview: ${personalizedContent.substring(0, 200)}...`)

          // Extract sender name from campaign description (mandatory field)
          let senderName = 'Eisbrief' // Fallback for legacy campaigns
          try {
            const descriptionData = JSON.parse(campaign.description || '{}')
            senderName = descriptionData.sender_name
            if (!senderName) {
              console.warn(`⚠️ Campaign ${campaign.id} has no sender_name, using fallback`)
              senderName = (emailAccount as any).name || 'Eisbrief'
            }
          } catch {
            // If description is not JSON, this is likely a legacy campaign
            console.warn(`⚠️ Campaign ${campaign.id} has invalid description format, using email account name`)
            senderName = (emailAccount as any).name || 'Eisbrief'
          }

          // Create email tracking record FIRST to get the tracking_pixel_id
          const trackingInsert = {
            user_id: campaign.user_id,
            campaign_id: campaign.id,
            contact_id: contact.id,
            message_id: trackingId,
            subject_line: personalizedSubject,
            email_body: personalizedContent,
            email_account_id: emailAccount.id,
            status: 'pending', // explicitly set initial status
            sent_at: null as string | null // override DB defaults so analytics wait for the actual send
          }

          const { data: trackingRecord, error: trackingError } = await supabase
            .from('email_tracking')
            .insert(trackingInsert)
            .select('tracking_pixel_id, id')
            .single()

          if (trackingError || !trackingRecord) {
            console.error('❌ Error creating tracking record:', trackingError)
            continue // Skip this contact
          }

          trackingPixelId = trackingRecord.tracking_pixel_id
          console.log(`📡 Created tracking record with pixel ID: ${trackingPixelId}`)

          const updateTrackingRecord = async (update: Record<string, any>) => {
            const buildQuery = () => {
              const query = supabase
                .from('email_tracking')
                .update(update)
              if (trackingPixelId) {
                return query.eq('tracking_pixel_id', trackingPixelId)
              }
              return query.eq('message_id', trackingId)
            }

            const { error: updateError } = await buildQuery()

            if (updateError) {
              console.warn('⚠️ Primary email_tracking update failed, retrying with reduced payload:', {
                error: updateError.message,
                code: updateError.code
              })

              // Only remove problematic fields, keep status for tracking
              const { tracking_pixel_id: _pixel, message_id: _msg, ...minimal } = update

              const { error: fallbackError } = await supabase
                .from('email_tracking')
                .update(minimal)
                .eq(trackingPixelId ? 'tracking_pixel_id' : 'message_id', trackingPixelId || trackingId)

              if (fallbackError) {
                console.error('❌ email_tracking fallback update failed:', fallbackError)
              }
            }
          }

          // Send email with the actual tracking pixel ID
          const result = await this.sendEmail({
            to: contact.email,
            subject: personalizedSubject,
            content: personalizedContent,
            emailAccount: emailAccount,
            senderName: senderName,
            trackingId: trackingId,
            pixelId: trackingPixelId || undefined,
            campaignId: campaign.id,
            contactId: contact.id
          })

          if (result.status === 'sent') {
            emailsSent++
            console.log(`✅ Email ${i+1}/${contacts.length} sent to ${contact.email}`)

            // Update tracking record with sent+delivered timestamps and status (SMTP accepted)
            const nowIso = new Date().toISOString()
            await updateTrackingRecord({
              status: 'delivered',
              sent_at: nowIso,
              delivered_at: nowIso,
              message_id: result.messageId || trackingId,
              tracking_pixel_id: trackingPixelId || null
            })

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
            const nowIso = new Date().toISOString()
            await updateTrackingRecord({
              status: 'failed',
              bounced_at: nowIso,
              sent_at: nowIso,
              bounce_reason: result.error || 'Email send failed',
              tracking_pixel_id: trackingPixelId || null
            })

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

          // Apply rate limiting delay (configurable, defaults to shorter pauses on serverless)
          if (i < contacts.length - 1) { // Don't delay after the last email
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

          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const nowIso = new Date().toISOString()
          try {
            const updates: Record<string, any> = {
              status: 'failed',
              bounced_at: nowIso,
              sent_at: nowIso,
              bounce_reason: errorMessage,
            }
            const { error: failUpdateError } = await supabase
              .from('email_tracking')
              .update(updates)
              .eq(trackingPixelId ? 'tracking_pixel_id' : 'message_id', trackingPixelId || trackingId)

            if (failUpdateError) {
              console.warn('⚠️ Failed to mark tracking record as failed with status column, retrying with reduced payload')
              const { status: _status, tracking_pixel_id: _pixel, message_id: _msg, ...fallback } = updates
              const { error: fallbackError } = await supabase
                .from('email_tracking')
                .update(fallback)
                .eq(trackingPixelId ? 'tracking_pixel_id' : 'message_id', trackingPixelId || trackingId)

              if (fallbackError) {
                console.error('❌ Could not update tracking record after send error:', fallbackError)
              }
            }
          } catch (trackingUpdateError) {
            console.error('❌ Unexpected error updating tracking record after send failure:', trackingUpdateError)
          }
          
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
      const processedCount = emailsSent + emailsFailed
      const newStatus = processedCount >= contacts.length ? 'completed' : (processedCount > 0 ? 'running' : 'paused')

      // Prepare update data
      const updateData = {
        emails_sent: emailsSent,
        emails_bounced: emailsFailed, // Bounced emails are tracked as failures in this context
        total_contacts: contacts.length,
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      // Set start_date if campaign is starting for the first time
      if (campaign.status === 'sending' && processedCount > 0) {
        updateData.start_date = new Date().toISOString()
      }

      // Set end_date if campaign is completing and clear batch scheduling
      if (newStatus === 'completed') {
        updateData.end_date = new Date().toISOString()
        updateData.next_batch_send_time = null // Clear future scheduling
        console.log(`🎉 Campaign completed! Total batches processed: ${campaign.current_batch_number || 0}`)
      }

      await supabase
        .from('campaigns')
        .update(updateData)
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
    campaignId?: string
    contactId?: string
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

        // Rewrite links for click tracking
        console.log('🔗 Rewriting links for click tracking...')
        let htmlContent = await EmailLinkRewriter.rewriteLinksForTracking(
          params.content,
          params.trackingId,
          params.to,
          params.campaignId,
          params.contactId
        )

        // Generate tracking pixel URL for this email using the actual pixelId
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ?
            (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) :
            'http://localhost:3000')
        const trackingPixelUrl = `${baseUrl}/api/tracking/pixel/${params.pixelId || params.trackingId}`
        console.log(`📡 Using tracking pixel URL: ${trackingPixelUrl}`)
        
        // Insert tracking pixel into HTML content
        const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">`
        
        // Ensure content has tracking pixel
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
          html: htmlContent,
          encoding: 'utf8' // Ensure proper UTF-8 encoding for umlauts
        })

        console.log(`✅ Email sent successfully via SMTP: ${info.messageId}`)
        
        return {
          messageId: info.messageId,
          status: 'sent',
          provider: 'smtp',
          trackingId: params.trackingId
        }

      } else if (params.emailAccount.provider === 'gmail' || params.emailAccount.provider === 'gmail-imap-smtp') {
        // Gmail OAuth sending via server-side service
        console.log(`📧 Sending Gmail email to ${params.to}`)

        try {
          // Import the server-side Gmail service
          const { GmailIMAPSMTPServerService } = await import('./server/gmail-imap-smtp-server')
          const gmailService = new GmailIMAPSMTPServerService()

          // Rewrite links for click tracking
          console.log('🔗 Rewriting links for click tracking...')
          let htmlContent = await EmailLinkRewriter.rewriteLinksForTracking(
            params.content,
            params.trackingId,
            params.to,
            params.campaignId,
            params.contactId
          )

          // Generate tracking pixel URL for this email using the actual pixelId
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ?
              (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) :
              'http://localhost:3000')
          const trackingPixelUrl = `${baseUrl}/api/tracking/pixel/${params.pixelId || params.trackingId}`
          console.log(`📡 Using tracking pixel URL: ${trackingPixelUrl}`)

          // Insert tracking pixel into HTML content
          const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">`

          // Ensure content has tracking pixel
          if (htmlContent.includes('</body>')) {
            htmlContent = htmlContent.replace('</body>', `${trackingPixel}</body>`)
          } else {
            htmlContent = `${htmlContent}${trackingPixel}`
          }

          const result = await gmailService.sendGmailEmail(params.emailAccount.id, {
            to: params.to,
            subject: params.subject,
            html: htmlContent,
            text: params.content.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            senderName: params.senderName
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
          // Additional production debugging
          console.error(`📋 Environment details:`, {
            hasVercelUrl: !!process.env.VERCEL_URL,
            hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
            baseUrl,
            isProduction: process.env.NODE_ENV === 'production'
          })
          return {
            messageId: null,
            status: 'failed',
            provider: 'gmail',
            trackingId: params.trackingId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }

      } else {
        // For other OAuth providers, return mock success for now
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
   * Determine delay configuration between sends, with overrides for serverless environments
   */
  /**
   * Check if a campaign is within its scheduled batch send window
   */
  private isWithinBatchSendWindow(nextBatchTime: Date, now: Date = new Date()): {
    canSend: boolean;
    timeUntilBatch: number;
    windowStatus: 'early' | 'ready' | 'overdue';
  } {
    const timeUntilBatch = nextBatchTime.getTime() - now.getTime()
    const timeWindow = 5 * 60 * 1000 // 5-minute window (configurable)

    if (timeUntilBatch > timeWindow) {
      return {
        canSend: false,
        timeUntilBatch,
        windowStatus: 'early'
      }
    }

    if (timeUntilBatch < -timeWindow) {
      return {
        canSend: true, // Allow overdue sends
        timeUntilBatch,
        windowStatus: 'overdue'
      }
    }

    return {
      canSend: true,
      timeUntilBatch,
      windowStatus: 'ready'
    }
  }

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
      // Extended delays for more humanlike behavior in serverless environments
      return { min: 15000, max: 45000 }
    }

    // Default desktop/server delay (30-60 seconds)
    return { min: 30000, max: 60000 }
  }
}

// Export singleton instance
export const campaignProcessor = CampaignProcessor.getInstance()
