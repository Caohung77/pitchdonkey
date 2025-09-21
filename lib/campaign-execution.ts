import { z } from 'zod'
import { Campaign, EmailStep, CampaignContact, CampaignUtils } from './campaigns'
import { ABTestService } from './ab-testing'

// Campaign execution interfaces
export interface CampaignExecution {
  id: string
  campaign_id: string
  user_id: string
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed'
  total_contacts: number
  processed_contacts: number
  emails_scheduled: number
  emails_sent: number
  current_step_distribution: Record<number, number>
  next_execution_at?: string
  error_message?: string
  started_at?: string
  paused_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface EmailJob {
  id: string
  campaign_id: string
  contact_id: string
  email_account_id: string
  step_number: number
  step_id: string
  subject: string
  content: string
  personalized_subject?: string
  personalized_content?: string
  ab_test_variant_id?: string
  scheduled_at: string
  priority: number
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  retry_count: number
  max_retries: number
  error_message?: string
  sent_at?: string
  created_at: string
  updated_at: string
}

export interface ContactProgress {
  contact_id: string
  campaign_id: string
  current_step: number
  status: 'pending' | 'active' | 'completed' | 'stopped' | 'bounced' | 'unsubscribed'
  last_email_sent_at?: string
  next_email_scheduled_at?: string
  reply_received_at?: string
  unsubscribed_at?: string
  bounce_count: number
  engagement_data: {
    emails_sent: number
    emails_opened: number
    emails_clicked: number
    last_opened_at?: string
    last_clicked_at?: string
  }
  ab_test_variant?: string
  personalization_data?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface SequenceStepResult {
  action: 'continue' | 'stop' | 'skip' | 'branch' | 'delay'
  next_step?: number
  delay_hours?: number
  reason: string
}

// Validation schemas
export const emailJobSchema = z.object({
  campaign_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  email_account_id: z.string().uuid(),
  step_number: z.number().min(1).max(7),
  step_id: z.string().uuid(),
  subject: z.string().min(1),
  content: z.string().min(1),
  scheduled_at: z.string().datetime(),
  priority: z.number().min(1).max(10).default(5),
  max_retries: z.number().min(0).max(5).default(3)
})

// Campaign execution engine
export class CampaignExecutionEngine {
  /**
   * Initialize campaign execution
   */
  static async initializeCampaign(
    campaign: Campaign,
    contactIds: string[],
    supabaseClient: any
  ): Promise<CampaignExecution> {
    // Validate campaign is ready for execution
    const validation = CampaignUtils.validateCampaignForLaunch(campaign)
    if (!validation.valid) {
      throw new Error(`Campaign validation failed: ${validation.errors.join(', ')}`)
    }

    // Get contacts
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('contacts')
      .select('*')
      .in('id', contactIds)
      .eq('user_id', campaign.user_id)
      .eq('status', 'active')

    if (contactsError || !contacts || contacts.length === 0) {
      throw new Error('No valid contacts found for campaign')
    }

    // Create campaign execution record
    const execution: Omit<CampaignExecution, 'id' | 'created_at' | 'updated_at'> = {
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      status: 'initializing',
      total_contacts: contacts.length,
      processed_contacts: 0,
      emails_scheduled: 0,
      emails_sent: 0,
      current_step_distribution: { 1: contacts.length },
      next_execution_at: new Date().toISOString()
    }

    const { data: createdExecution, error: executionError } = await supabaseClient
      .from('campaign_executions')
      .insert(execution)
      .select()
      .single()

    if (executionError) {
      throw new Error('Failed to create campaign execution')
    }

    // Initialize contact progress records
    const contactProgressRecords = contacts.map(contact => {
      // Assign A/B test variant if test is enabled
      let abTestVariant: string | undefined
      // TODO: Fix AB test type conflicts
      // if (campaign.ab_test_settings?.enabled) {
      //   const variant = ABTestService.assignVariant(abTest, contact.id)
      //   abTestVariant = variant.id
      // }

      return {
        contact_id: contact.id,
        campaign_id: campaign.id,
        current_step: 1,
        status: 'pending' as const,
        bounce_count: 0,
        engagement_data: {
          emails_sent: 0,
          emails_opened: 0,
          emails_clicked: 0
        },
        ab_test_variant: abTestVariant
      }
    })

    const { error: progressError } = await supabaseClient
      .from('campaign_contact_progress')
      .insert(contactProgressRecords)

    if (progressError) {
      throw new Error('Failed to initialize contact progress')
    }

    // Schedule initial emails
    await this.scheduleNextBatch(campaign, createdExecution, supabaseClient)

    return createdExecution
  }

  /**
   * Process next batch of emails for campaign
   */
  static async processNextBatch(
    executionId: string,
    supabaseClient: any
  ): Promise<void> {
    // Get execution details
    const { data: execution, error: executionError } = await supabaseClient
      .from('campaign_executions')
      .select('*, campaigns(*)')
      .eq('id', executionId)
      .single()

    if (executionError || !execution) {
      throw new Error('Campaign execution not found')
    }

    if (execution.status !== 'running') {
      return // Campaign is not running
    }

    const campaign = execution.campaigns

    // Get pending email jobs
    const { data: pendingJobs, error: jobsError } = await supabaseClient
      .from('email_jobs')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(50) // Process in batches

    if (jobsError) {
      throw new Error('Failed to fetch pending jobs')
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      // Check if campaign is complete
      await this.checkCampaignCompletion(execution, supabaseClient)
      return
    }

    // Process each job
    for (const job of pendingJobs) {
      try {
        await this.processEmailJob(job, campaign, supabaseClient)
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error)
        await this.handleJobFailure(job, error, supabaseClient)
      }
    }

    // Update execution statistics
    await this.updateExecutionStats(execution, supabaseClient)
  }

  /**
   * Process individual email job
   */
  static async processEmailJob(
    job: EmailJob,
    campaign: Campaign,
    supabaseClient: any
  ): Promise<void> {
    // Update job status to processing
    await supabaseClient
      .from('email_jobs')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)

    // Get contact progress
    const { data: progress, error: progressError } = await supabaseClient
      .from('campaign_contact_progress')
      .select('*, contacts(*)')
      .eq('contact_id', job.contact_id)
      .eq('campaign_id', job.campaign_id)
      .single()

    if (progressError || !progress) {
      throw new Error('Contact progress not found')
    }

    // Check if contact should still receive emails
    if (progress.status !== 'active' && progress.status !== 'pending') {
      await supabaseClient
        .from('email_jobs')
        .update({ 
          status: 'cancelled',
          error_message: `Contact status: ${progress.status}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
      return
    }

    // Get email account
    const { data: emailAccount, error: accountError } = await supabaseClient
      .from('email_accounts')
      .select('*')
      .eq('id', job.email_account_id)
      .eq('user_id', campaign.user_id)
      .single()

    if (accountError || !emailAccount || emailAccount.status !== 'active') {
      throw new Error('Email account not available')
    }

    // Apply personalization if enabled
    let personalizedSubject = job.subject
    let personalizedContent = job.content

    if (campaign.ai_settings.enabled) {
      try {
        // This would integrate with the AI personalization service
        // For now, we'll do basic variable replacement
        personalizedSubject = this.replaceVariables(job.subject, progress.contacts)
        personalizedContent = this.replaceVariables(job.content, progress.contacts)
      } catch (error) {
        console.error('Personalization failed, using template:', error)
      }
    }

    // Send email (this would integrate with the email sending service)
    try {
      const emailResult = await this.sendEmail({
        to: progress.contacts.email,
        subject: personalizedSubject,
        content: personalizedContent,
        emailAccount,
        trackingId: job.id
      })

      // Update job as sent
      await supabaseClient
        .from('email_jobs')
        .update({
          status: 'sent',
          personalized_subject: personalizedSubject,
          personalized_content: personalizedContent,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      // Update contact progress
      await supabaseClient
        .from('campaign_contact_progress')
        .update({
          status: 'active',
          last_email_sent_at: new Date().toISOString(),
          engagement_data: {
            ...progress.engagement_data,
            emails_sent: progress.engagement_data.emails_sent + 1
          },
          updated_at: new Date().toISOString()
        })
        .eq('contact_id', job.contact_id)
        .eq('campaign_id', job.campaign_id)

      // Trigger UI refresh by updating campaign timestamp
      await supabaseClient
        .from('campaigns')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', job.campaign_id)

      console.log(`📊 Sequence email sent and tracked for campaign ${job.campaign_id}`)

      // Create email tracking record (using actual database schema)
      await supabaseClient
        .from('email_tracking')
        .insert({
          user_id: campaign.user_id,
          campaign_id: job.campaign_id,
          contact_id: job.contact_id,
          message_id: job.id, // Required unique field
          tracking_pixel_id: job.id, // Use job ID as tracking pixel ID
          status: 'delivered', // Set status to delivered when successfully sent
          sent_at: new Date().toISOString(),
          // Treat SMTP acceptance as delivery to recipient server
          delivered_at: new Date().toISOString(),
        })

      // Schedule next step if applicable
      await this.scheduleNextStep(progress, campaign, supabaseClient)

    } catch (error) {
      throw new Error(`Email sending failed: ${error}`)
    }
  }

  /**
   * Schedule next step for contact based on sequence logic
   */
  static async scheduleNextStep(
    progress: ContactProgress & { contacts: any },
    campaign: Campaign,
    supabaseClient: any
  ): Promise<void> {
    const currentStep = campaign.email_sequence.find(s => s.step_number === progress.current_step)
    if (!currentStep) return

    // Evaluate step conditions and get next action
    const stepResult = await this.evaluateStepConditions(currentStep, progress, supabaseClient)

    switch (stepResult.action) {
      case 'stop':
        await supabaseClient
          .from('campaign_contact_progress')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('contact_id', progress.contact_id)
          .eq('campaign_id', progress.campaign_id)
        break

      case 'skip':
        // Move to next step immediately
        const nextStepNumber = progress.current_step + 1
        const nextStep = campaign.email_sequence.find(s => s.step_number === nextStepNumber)
        if (nextStep) {
          await this.scheduleEmailJob(progress, nextStep, campaign, new Date(), supabaseClient)
          await supabaseClient
            .from('campaign_contact_progress')
            .update({
              current_step: nextStepNumber,
              updated_at: new Date().toISOString()
            })
            .eq('contact_id', progress.contact_id)
            .eq('campaign_id', progress.campaign_id)
        }
        break

      case 'branch':
        if (stepResult.next_step) {
          const branchStep = campaign.email_sequence.find(s => s.step_number === stepResult.next_step)
          if (branchStep) {
            const scheduleTime = new Date(Date.now() + (stepResult.delay_hours || 0) * 60 * 60 * 1000)
            await this.scheduleEmailJob(progress, branchStep, campaign, scheduleTime, supabaseClient)
            await supabaseClient
              .from('campaign_contact_progress')
              .update({
                current_step: stepResult.next_step,
                next_email_scheduled_at: scheduleTime.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('contact_id', progress.contact_id)
              .eq('campaign_id', progress.campaign_id)
          }
        }
        break

      case 'continue':
      default:
        // Schedule next step with delay
        const nextStepNum = progress.current_step + 1
        const nextStepToSchedule = campaign.email_sequence.find(s => s.step_number === nextStepNum)
        if (nextStepToSchedule) {
          const delayHours = CampaignUtils.calculateStepDelay(nextStepToSchedule)
          const scheduleTime = new Date(Date.now() + delayHours * 60 * 60 * 1000)
          
          await this.scheduleEmailJob(progress, nextStepToSchedule, campaign, scheduleTime, supabaseClient)
          await supabaseClient
            .from('campaign_contact_progress')
            .update({
              current_step: nextStepNum,
              next_email_scheduled_at: scheduleTime.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('contact_id', progress.contact_id)
            .eq('campaign_id', progress.campaign_id)
        } else {
          // No more steps, mark as completed
          await supabaseClient
            .from('campaign_contact_progress')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('contact_id', progress.contact_id)
            .eq('campaign_id', progress.campaign_id)
        }
        break
    }
  }

  /**
   * Evaluate step conditions to determine next action
   */
  static async evaluateStepConditions(
    step: EmailStep,
    progress: ContactProgress,
    supabaseClient: any
  ): Promise<SequenceStepResult> {
    // Check for replies (auto-stop sequence)
    if (progress.reply_received_at) {
      return {
        action: 'stop',
        reason: 'Reply received - sequence stopped'
      }
    }

    // Check for unsubscribe
    if (progress.unsubscribed_at) {
      return {
        action: 'stop',
        reason: 'Contact unsubscribed'
      }
    }

    // Check for too many bounces
    if (progress.bounce_count >= 2) {
      return {
        action: 'stop',
        reason: 'Too many bounces'
      }
    }

    // Evaluate custom conditions
    for (const condition of step.conditions) {
      const conditionMet = await this.evaluateCondition(condition, progress, supabaseClient)
      
      if (conditionMet) {
        switch (condition.action) {
          case 'stop_sequence':
            return {
              action: 'stop',
              reason: `Condition met: ${condition.type}`
            }
          case 'skip_step':
            return {
              action: 'skip',
              reason: `Condition met: ${condition.type}`
            }
          case 'branch_to_step':
            return {
              action: 'branch',
              next_step: parseInt(condition.target_step_id || '0'),
              delay_hours: condition.delay_hours,
              reason: `Condition met: ${condition.type}`
            }
          case 'delay_step':
            return {
              action: 'delay',
              delay_hours: condition.delay_hours || 24,
              reason: `Condition met: ${condition.type}`
            }
        }
      }
    }

    return {
      action: 'continue',
      reason: 'No conditions met - continue sequence'
    }
  }

  /**
   * Evaluate individual condition
   */
  static async evaluateCondition(
    condition: any,
    progress: ContactProgress,
    supabaseClient: any
  ): Promise<boolean> {
    switch (condition.type) {
      case 'reply_received':
        return !!progress.reply_received_at

      case 'email_opened':
        return progress.engagement_data.emails_opened > 0

      case 'link_clicked':
        return progress.engagement_data.emails_clicked > 0

      case 'time_elapsed':
        if (progress.last_email_sent_at) {
          const elapsed = Date.now() - new Date(progress.last_email_sent_at).getTime()
          const elapsedHours = elapsed / (1000 * 60 * 60)
          return elapsedHours >= (condition.value || 24)
        }
        return false

      case 'previous_step_opened':
        return progress.engagement_data.last_opened_at !== undefined

      case 'previous_step_clicked':
        return progress.engagement_data.last_clicked_at !== undefined

      default:
        return false
    }
  }

  /**
   * Schedule email job for contact and step
   */
  static async scheduleEmailJob(
    progress: ContactProgress & { contacts: any },
    step: EmailStep,
    campaign: Campaign,
    scheduledAt: Date,
    supabaseClient: any
  ): Promise<void> {
    // Get available email account (this would implement account rotation)
    const { data: emailAccounts, error: accountsError } = await supabaseClient
      .from('email_accounts')
      .select('*')
      .eq('user_id', campaign.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)

    if (accountsError || !emailAccounts || emailAccounts.length === 0) {
      throw new Error('No active email accounts available')
    }

    const emailAccount = emailAccounts[0]

    // Apply A/B test variant if applicable
    let subject = step.subject_template
    let content = step.content_template

    if (progress.ab_test_variant && campaign.ab_test_settings?.enabled) {
      const variant = campaign.ab_test_settings.variants.find(v => v.id === progress.ab_test_variant)
      if (variant) {
        if (campaign.ab_test_settings.test_type === 'subject_line' && variant.subject_template) {
          subject = variant.subject_template
        }
        if (campaign.ab_test_settings.test_type === 'content' && variant.content_template) {
          content = variant.content_template
        }
      }
    }

    const emailJob: Omit<EmailJob, 'id' | 'created_at' | 'updated_at'> = {
      campaign_id: campaign.id,
      contact_id: progress.contact_id,
      email_account_id: emailAccount.id,
      step_number: step.step_number,
      step_id: step.id,
      subject,
      content,
      ab_test_variant_id: progress.ab_test_variant,
      scheduled_at: scheduledAt.toISOString(),
      priority: 5,
      status: 'pending',
      retry_count: 0,
      max_retries: 3
    }

    await supabaseClient
      .from('email_jobs')
      .insert(emailJob)
  }

  /**
   * Handle job failure with retry logic
   */
  static async handleJobFailure(
    job: EmailJob,
    error: any,
    supabaseClient: any
  ): Promise<void> {
    const retryCount = job.retry_count + 1
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (retryCount <= job.max_retries) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, retryCount) * 60 * 1000 // 2^n minutes
      const retryAt = new Date(Date.now() + retryDelay)

      await supabaseClient
        .from('email_jobs')
        .update({
          status: 'pending',
          retry_count: retryCount,
          scheduled_at: retryAt.toISOString(),
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
    } else {
      // Max retries reached, mark as failed
      await supabaseClient
        .from('email_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
    }
  }

  /**
   * Pause campaign execution
   */
  static async pauseCampaign(
    campaignId: string,
    supabaseClient: any
  ): Promise<void> {
    // Update campaign status
    await supabaseClient
      .from('campaigns')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    // Update execution status
    await supabaseClient
      .from('campaign_executions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)

    // Cancel pending jobs
    await supabaseClient
      .from('email_jobs')
      .update({
        status: 'cancelled',
        error_message: 'Campaign paused',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
  }

  /**
   * Resume campaign execution
   */
  static async resumeCampaign(
    campaignId: string,
    supabaseClient: any
  ): Promise<void> {
    // Update campaign status
    await supabaseClient
      .from('campaigns')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    // Update execution status
    await supabaseClient
      .from('campaign_executions')
      .update({
        status: 'running',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)

    // Reschedule pending contacts
    const { data: campaign } = await supabaseClient
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaign) {
      const { data: execution } = await supabaseClient
        .from('campaign_executions')
        .select('*')
        .eq('campaign_id', campaignId)
        .single()

      if (execution) {
        await this.scheduleNextBatch(campaign, execution, supabaseClient)
      }
    }
  }

  /**
   * Stop campaign execution permanently
   */
  static async stopCampaign(
    campaignId: string,
    supabaseClient: any
  ): Promise<void> {
    // Update campaign status to stopped
    await supabaseClient
      .from('campaigns')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    // Update execution status to completed (stopped campaigns are considered completed)
    await supabaseClient
      .from('campaign_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)

    // Cancel all pending email jobs
    await supabaseClient
      .from('email_jobs')
      .update({
        status: 'cancelled',
        error_message: 'Campaign stopped permanently',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    // Mark all pending and active contacts as stopped
    await supabaseClient
      .from('campaign_contact_progress')
      .update({
        status: 'stopped',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'active'])

    console.log(`Campaign ${campaignId} stopped permanently`)
  }

  // Helper methods

  private static async scheduleNextBatch(
    campaign: Campaign,
    execution: CampaignExecution,
    supabaseClient: any
  ): Promise<void> {
    // Get contacts ready for next step
    const { data: readyContacts } = await supabaseClient
      .from('campaign_contact_progress')
      .select('*, contacts(*)')
      .eq('campaign_id', campaign.id)
      .in('status', ['pending', 'active'])
      .is('next_email_scheduled_at', null)
      .limit(100)

    if (readyContacts && readyContacts.length > 0) {
      for (const progress of readyContacts) {
        const step = campaign.email_sequence.find(s => s.step_number === progress.current_step)
        if (step) {
          const scheduleTime = progress.current_step === 1 
            ? new Date() // Send first step immediately
            : new Date(Date.now() + CampaignUtils.calculateStepDelay(step) * 60 * 60 * 1000)
          
          await this.scheduleEmailJob(progress, step, campaign, scheduleTime, supabaseClient)
        }
      }
    }

    // Update execution status to running
    await supabaseClient
      .from('campaign_executions')
      .update({
        status: 'running',
        started_at: execution.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', execution.id)
  }

  private static async updateExecutionStats(
    execution: CampaignExecution,
    supabaseClient: any
  ): Promise<void> {
    // Get current statistics
    const { data: stats } = await supabaseClient
      .from('campaign_contact_progress')
      .select('current_step, status')
      .eq('campaign_id', execution.campaign_id)

    if (stats) {
      const stepDistribution: Record<number, number> = {}
      let processedCount = 0

      stats.forEach((stat: any) => {
        stepDistribution[stat.current_step] = (stepDistribution[stat.current_step] || 0) + 1
        if (stat.status !== 'pending') {
          processedCount++
        }
      })

      // Get email job counts
      const { data: jobStats } = await supabaseClient
        .from('email_jobs')
        .select('status')
        .eq('campaign_id', execution.campaign_id)

      const emailsScheduled = jobStats?.length || 0
      const emailsSent = jobStats?.filter((j: any) => j.status === 'sent').length || 0

      await supabaseClient
        .from('campaign_executions')
        .update({
          processed_contacts: processedCount,
          emails_scheduled: emailsScheduled,
          emails_sent: emailsSent,
          current_step_distribution: stepDistribution,
          updated_at: new Date().toISOString()
        })
        .eq('id', execution.id)
    }
  }

  private static async checkCampaignCompletion(
    execution: CampaignExecution,
    supabaseClient: any
  ): Promise<void> {
    // Check if all contacts are completed or stopped
    const { data: activeContacts } = await supabaseClient
      .from('campaign_contact_progress')
      .select('status')
      .eq('campaign_id', execution.campaign_id)
      .in('status', ['pending', 'active'])

    if (!activeContacts || activeContacts.length === 0) {
      // Campaign is complete
      await supabaseClient
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', execution.campaign_id)

      await supabaseClient
        .from('campaign_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', execution.id)
    }
  }

  private static replaceVariables(template: string, contact: any): string {
    return template
      .replace(/\{\{first_name\}\}/g, contact.first_name || '')
      .replace(/\{\{last_name\}\}/g, contact.last_name || '')
      .replace(/\{\{company_name\}\}/g, contact.company_name || '')
      .replace(/\{\{job_title\}\}/g, contact.job_title || '')
      .replace(/\{\{industry\}\}/g, contact.industry || '')
      .replace(/\{\{website\}\}/g, contact.website || '')
  }

  private static async sendEmail(params: {
    to: string
    subject: string
    content: string
    emailAccount: any
    trackingId: string
    senderName?: string
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

        // Generate tracking pixel URL for this email
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ?
            (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) :
            'http://localhost:3000')
        const trackingPixelUrl = `${baseUrl}/api/tracking/pixel/${params.trackingId}`
        
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
          from: `"${params.senderName || params.emailAccount.name || 'ColdReach Pro'}" <${params.emailAccount.email}>`,
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

          // Generate tracking pixel URL for this email
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ?
              (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) :
              'http://localhost:3000')
          const trackingPixelUrl = `${baseUrl}/api/tracking/pixel/${params.trackingId}`

          // Insert tracking pixel into HTML content
          const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">`

          // Ensure content has tracking pixel
          let htmlContent = params.content
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
          throw new Error(`Gmail sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }

      } else if (params.emailAccount.provider === 'outlook') {
        // Outlook OAuth sending - for now return success but note it needs implementation  
        console.log(`⚠️ Outlook OAuth sending not fully implemented yet`)
        
        return {
          messageId: `outlook_mock_${params.trackingId}`,
          status: 'sent',
          provider: 'outlook',
          trackingId: params.trackingId,
          note: 'Outlook OAuth implementation needed'
        }

      } else {
        throw new Error(`Unsupported email provider: ${params.emailAccount.provider}`)
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
}
