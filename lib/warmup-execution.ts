import { z } from 'zod'
import { WarmupSystem, WarmupPlan } from './warmup-system'
import { RateLimiter } from './rate-limiter'
import { TimezoneScheduler } from './timezone-scheduler'

// Warmup execution interfaces
export interface WarmupJob {
  id: string
  warmup_plan_id: string
  email_account_id: string
  scheduled_date: string
  target_emails: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_replied: number
  emails_bounced: number
  spam_complaints: number
  execution_log: WarmupExecutionLog[]
  started_at?: string
  completed_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export interface WarmupExecutionLog {
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
  details?: Record<string, any>
}

export interface WarmupEmail {
  id: string
  warmup_job_id: string
  recipient_email: string
  recipient_name: string
  recipient_type: 'internal' | 'partner' | 'existing_customer' | 'prospect'
  content_type: 'introduction' | 'follow_up' | 'newsletter' | 'promotional'
  subject: string
  content: string
  scheduled_at: string
  sent_at?: string
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'failed'
  tracking_pixel_id?: string
  interaction_simulated: boolean
  simulation_type?: 'open' | 'reply' | 'click'
  simulation_delay_hours?: number
  created_at: string
}

export interface WarmupRecipient {
  email: string
  name: string
  type: 'internal' | 'partner' | 'existing_customer' | 'prospect'
  company?: string
  industry?: string
  relationship: string
  engagement_likelihood: number // 0-1
  reply_likelihood: number // 0-1
  safe_for_warmup: boolean
}

export interface WarmupContentTemplate {
  id: string
  content_type: 'introduction' | 'follow_up' | 'newsletter' | 'promotional'
  recipient_type: 'internal' | 'partner' | 'existing_customer' | 'prospect'
  subject_templates: string[]
  content_templates: string[]
  variables: string[]
  engagement_score: number // Expected engagement rate
  spam_risk: 'low' | 'medium' | 'high'
}

/**
 * Automated warmup execution engine
 */
export class WarmupExecutor {
  private supabase: any
  private redis: any
  private warmupSystem: WarmupSystem
  private rateLimiter: RateLimiter
  private timezoneScheduler: TimezoneScheduler
  private emailService: any

  // Predefined warmup recipients for different types
  private readonly WARMUP_RECIPIENTS: WarmupRecipient[] = [
    // Internal team members (highest safety)
    {
      email: 'team@company.com',
      name: 'Team Member',
      type: 'internal',
      company: 'Internal',
      relationship: 'colleague',
      engagement_likelihood: 0.9,
      reply_likelihood: 0.7,
      safe_for_warmup: true
    },
    // Business partners (high safety)
    {
      email: 'partner@business.com',
      name: 'Business Partner',
      type: 'partner',
      company: 'Partner Company',
      relationship: 'business partner',
      engagement_likelihood: 0.8,
      reply_likelihood: 0.5,
      safe_for_warmup: true
    },
    // Existing customers (medium safety)
    {
      email: 'customer@client.com',
      name: 'Existing Customer',
      type: 'existing_customer',
      company: 'Client Company',
      relationship: 'customer',
      engagement_likelihood: 0.6,
      reply_likelihood: 0.3,
      safe_for_warmup: true
    },
    // Prospects (lower safety, used in later stages)
    {
      email: 'prospect@target.com',
      name: 'Potential Customer',
      type: 'prospect',
      company: 'Target Company',
      relationship: 'prospect',
      engagement_likelihood: 0.4,
      reply_likelihood: 0.1,
      safe_for_warmup: true
    }
  ]

  // Content templates for different warmup scenarios
  private readonly CONTENT_TEMPLATES: WarmupContentTemplate[] = [
    {
      id: 'internal-intro',
      content_type: 'introduction',
      recipient_type: 'internal',
      subject_templates: [
        'Quick check-in',
        'Team update',
        'Project status',
        'Weekly sync'
      ],
      content_templates: [
        'Hi {{name}},\n\nJust wanted to check in and see how things are going with the {{project}}. Let me know if you need any support.\n\nBest,\n{{sender_name}}',
        'Hello {{name}},\n\nHope you\'re having a great week! Quick update on {{topic}} - everything is on track.\n\nTalk soon,\n{{sender_name}}'
      ],
      variables: ['name', 'project', 'topic', 'sender_name'],
      engagement_score: 0.8,
      spam_risk: 'low'
    }
  ]

  constructor(
    supabaseClient?: any,
    redisClient?: any,
    warmupSystem?: WarmupSystem,
    rateLimiter?: RateLimiter,
    timezoneScheduler?: TimezoneScheduler,
    emailService?: any
  ) {
    this.supabase = supabaseClient
    this.redis = redisClient
    this.warmupSystem = warmupSystem || new WarmupSystem(supabaseClient, redisClient)
    this.rateLimiter = rateLimiter || new RateLimiter(supabaseClient, redisClient)
    this.timezoneScheduler = timezoneScheduler || new TimezoneScheduler(supabaseClient)
    this.emailService = emailService
  }  
/**
   * Schedule daily warmup jobs for all active warmup plans
   */
  async scheduleDailyWarmupJobs(): Promise<void> {
    try {
      // Get all active warmup plans
      const { data: activePlans, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('status', 'active')

      if (error) throw error
      if (!activePlans || activePlans.length === 0) return

      const today = new Date().toISOString().split('T')[0]

      for (const plan of activePlans) {
        // Check if job already exists for today
        const { data: existingJob } = await this.supabase
          .from('warmup_jobs')
          .select('id')
          .eq('warmup_plan_id', plan.id)
          .eq('scheduled_date', today)
          .single()

        if (existingJob) continue // Job already scheduled

        // Create warmup job for today
        await this.createWarmupJob(plan, today)
      }

    } catch (error) {
      console.error('Error scheduling daily warmup jobs:', error)
    }
  }

  /**
   * Create a warmup job for a specific plan and date
   */
  async createWarmupJob(plan: WarmupPlan, date: string): Promise<WarmupJob> {
    try {
      const job: Omit<WarmupJob, 'id' | 'created_at' | 'updated_at'> = {
        warmup_plan_id: plan.id,
        email_account_id: plan.email_account_id,
        scheduled_date: date,
        target_emails: plan.daily_target,
        status: 'pending',
        emails_sent: 0,
        emails_delivered: 0,
        emails_opened: 0,
        emails_replied: 0,
        emails_bounced: 0,
        spam_complaints: 0,
        execution_log: [{
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Warmup job created with target of ${plan.daily_target} emails`
        }]
      }

      const { data: created, error } = await this.supabase
        .from('warmup_jobs')
        .insert(job)
        .select()
        .single()

      if (error) throw error

      // Generate warmup emails for this job
      await this.generateWarmupEmails(created)

      return created

    } catch (error) {
      console.error('Error creating warmup job:', error)
      throw error
    }
  }

  /**
   * Generate warmup emails for a job
   */
  async generateWarmupEmails(job: WarmupJob): Promise<void> {
    try {
      // Get warmup plan details
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('id', job.warmup_plan_id)
        .single()

      if (error || !plan) throw new Error('Warmup plan not found')

      // Determine email distribution based on current week
      const distribution = this.calculateEmailDistribution(plan.current_week, job.target_emails)
      
      const warmupEmails: Omit<WarmupEmail, 'id' | 'created_at'>[] = []

      // Generate emails for each recipient type
      for (const [recipientType, count] of Object.entries(distribution)) {
        const recipients = this.selectRecipients(recipientType as any, count)
        const contentType = this.selectContentType(plan.current_week, recipientType as any)

        for (let i = 0; i < count; i++) {
          const recipient = recipients[i % recipients.length]
          const template = this.selectContentTemplate(contentType, recipientType as any)
          
          // Generate personalized content
          const { subject, content } = this.generateEmailContent(template, recipient, plan)
          
          // Calculate send time
          const sendTime = await this.calculateSendTime(job.scheduled_date, i, count, plan.settings)

          // Determine if interaction should be simulated
          const shouldSimulate = this.shouldSimulateInteraction(recipient, plan.current_week)
          
          warmupEmails.push({
            warmup_job_id: job.id,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            recipient_type: recipient.type,
            content_type: contentType,
            subject,
            content,
            scheduled_at: sendTime,
            status: 'pending',
            interaction_simulated: shouldSimulate.simulate,
            simulation_type: shouldSimulate.type,
            simulation_delay_hours: shouldSimulate.delayHours
          })
        }
      }

      // Insert warmup emails
      const { error: insertError } = await this.supabase
        .from('warmup_emails')
        .insert(warmupEmails)

      if (insertError) throw insertError

      // Log generation completion
      await this.addJobLog(job.id, 'info', `Generated ${warmupEmails.length} warmup emails`)

    } catch (error) {
      console.error('Error generating warmup emails:', error)
      await this.addJobLog(job.id, 'error', `Failed to generate emails: ${error.message}`)
      throw error
    }
  }

  /**
   * Execute warmup jobs for today
   */
  async executeWarmupJobs(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Get pending warmup jobs for today
      const { data: jobs, error } = await this.supabase
        .from('warmup_jobs')
        .select('*')
        .eq('scheduled_date', today)
        .eq('status', 'pending')

      if (error) throw error
      if (!jobs || jobs.length === 0) return

      // Execute each job
      for (const job of jobs) {
        await this.executeWarmupJob(job)
      }

    } catch (error) {
      console.error('Error executing warmup jobs:', error)
    }
  }

  /**
   * Execute a specific warmup job
   */
  async executeWarmupJob(job: WarmupJob): Promise<void> {
    try {
      // Update job status to running
      await this.supabase
        .from('warmup_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', job.id)

      await this.addJobLog(job.id, 'info', 'Starting warmup job execution')

      // Get pending emails for this job
      const { data: emails, error } = await this.supabase
        .from('warmup_emails')
        .select('*')
        .eq('warmup_job_id', job.id)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      if (!emails || emails.length === 0) {
        await this.completeWarmupJob(job.id, 'No emails to send')
        return
      }

      // Check rate limits
      const quota = await this.rateLimiter.checkSendingQuota(job.email_account_id, 'warmup.test')
      if (!quota.is_available) {
        await this.addJobLog(job.id, 'warning', 'Rate limit reached, rescheduling emails')
        await this.rescheduleEmails(emails)
        return
      }

      let sentCount = 0
      let deliveredCount = 0
      let failedCount = 0

      // Send emails
      for (const email of emails) {
        try {
          const sendResult = await this.sendWarmupEmail(email)
          
          if (sendResult.success) {
            sentCount++
            if (sendResult.delivered) deliveredCount++
            
            // Schedule interaction simulation if needed
            if (email.interaction_simulated && email.simulation_type) {
              await this.scheduleInteractionSimulation(email)
            }
          } else {
            failedCount++
            await this.addJobLog(job.id, 'warning', `Failed to send email to ${email.recipient_email}: ${sendResult.error}`)
          }

          // Small delay between sends
          await this.delay(1000 + Math.random() * 2000) // 1-3 seconds

        } catch (error) {
          failedCount++
          await this.addJobLog(job.id, 'error', `Error sending email to ${email.recipient_email}: ${error.message}`)
        }
      }

      // Update job statistics
      await this.supabase
        .from('warmup_jobs')
        .update({
          emails_sent: sentCount,
          emails_delivered: deliveredCount
        })
        .eq('id', job.id)

      // Update warmup plan metrics
      await this.warmupSystem.updateWarmupMetrics(job.warmup_plan_id, {
        emails_sent: sentCount,
        emails_delivered: deliveredCount,
        emails_opened: 0, // Will be updated by tracking
        emails_replied: 0, // Will be updated by tracking
        emails_bounced: failedCount,
        spam_complaints: 0,
        content_type: 'mixed',
        recipient_type: 'mixed'
      })

      await this.completeWarmupJob(job.id, `Sent ${sentCount}/${emails.length} emails successfully`)

    } catch (error) {
      console.error('Error executing warmup job:', error)
      await this.failWarmupJob(job.id, error.message)
    }
  }

  /**
   * Send a warmup email
   */
  async sendWarmupEmail(email: WarmupEmail): Promise<{
    success: boolean
    delivered?: boolean
    error?: string
    trackingPixelId?: string
  }> {
    try {
      // Update email status
      await this.supabase
        .from('warmup_emails')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', email.id)

      // Send via email service (mock implementation)
      const result = await this.emailService.send({
        to: email.recipient_email,
        subject: email.subject,
        content: email.content,
        trackingEnabled: true,
        warmupMode: true
      })

      if (result.success) {
        const trackingPixelId = result.trackingPixelId || `warmup_${email.id}_${Date.now()}`
        
        await this.supabase
          .from('warmup_emails')
          .update({
            status: 'delivered',
            tracking_pixel_id: trackingPixelId
          })
          .eq('id', email.id)

        return {
          success: true,
          delivered: true,
          trackingPixelId
        }
      } else {
        await this.supabase
          .from('warmup_emails')
          .update({ status: 'failed' })
          .eq('id', email.id)

        return {
          success: false,
          error: result.error
        }
      }

    } catch (error) {
      await this.supabase
        .from('warmup_emails')
        .update({ status: 'failed' })
        .eq('id', email.id)

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Schedule interaction simulation for an email
   */
  async scheduleInteractionSimulation(email: WarmupEmail): Promise<void> {
    try {
      const simulationTime = new Date()
      simulationTime.setHours(simulationTime.getHours() + (email.simulation_delay_hours || 2))

      // Schedule simulation job (this would typically use a job queue)
      await this.redis.set(
        `warmup_simulation:${email.id}`,
        JSON.stringify({
          emailId: email.id,
          type: email.simulation_type,
          scheduledAt: simulationTime.toISOString()
        }),
        'EX',
        24 * 60 * 60 // 24 hours expiry
      )

    } catch (error) {
      console.error('Error scheduling interaction simulation:', error)
    }
  }

  /**
   * Process interaction simulations
   */
  async processInteractionSimulations(): Promise<void> {
    try {
      // Get all scheduled simulations (in a real implementation, this would use a job queue)
      const keys = await this.redis.keys('warmup_simulation:*')
      
      for (const key of keys) {
        const data = await this.redis.get(key)
        if (!data) continue

        const simulation = JSON.parse(data)
        const scheduledTime = new Date(simulation.scheduledAt)
        
        if (scheduledTime <= new Date()) {
          await this.simulateInteraction(simulation.emailId, simulation.type)
          await this.redis.del(key)
        }
      }

    } catch (error) {
      console.error('Error processing interaction simulations:', error)
    }
  }

  /**
   * Simulate an interaction (open, click, reply)
   */
  async simulateInteraction(emailId: string, type: 'open' | 'click' | 'reply'): Promise<void> {
    try {
      const { data: email, error } = await this.supabase
        .from('warmup_emails')
        .select('*')
        .eq('id', emailId)
        .single()

      if (error || !email) return

      const now = new Date().toISOString()

      switch (type) {
        case 'open':
          await this.supabase
            .from('warmup_emails')
            .update({ status: 'opened' })
            .eq('id', emailId)
          
          // Update job metrics
          await this.supabase
            .from('warmup_jobs')
            .update({
              emails_opened: this.supabase.raw('emails_opened + 1')
            })
            .eq('id', email.warmup_job_id)
          break

        case 'reply':
          await this.supabase
            .from('warmup_emails')
            .update({ status: 'replied' })
            .eq('id', emailId)
          
          // Update job metrics
          await this.supabase
            .from('warmup_jobs')
            .update({
              emails_replied: this.supabase.raw('emails_replied + 1')
            })
            .eq('id', email.warmup_job_id)
          break

        case 'click':
          // Track click simulation
          await this.supabase
            .from('warmup_email_clicks')
            .insert({
              warmup_email_id: emailId,
              clicked_at: now,
              simulated: true
            })
          break
      }

    } catch (error) {
      console.error('Error simulating interaction:', error)
    }
  }

  /**
   * Monitor warmup job health and detect failures
   */
  async monitorWarmupHealth(): Promise<void> {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // Get jobs from yesterday that should be completed
      const { data: jobs, error } = await this.supabase
        .from('warmup_jobs')
        .select(`
          *,
          warmup_plans(*)
        `)
        .eq('scheduled_date', yesterdayStr)
        .in('status', ['running', 'pending'])

      if (error) throw error
      if (!jobs || jobs.length === 0) return

      for (const job of jobs) {
        await this.handleStuckJob(job)
      }

      // Check for warmup plans with poor performance
      await this.checkWarmupPerformance()

    } catch (error) {
      console.error('Error monitoring warmup health:', error)
    }
  }

  /**
   * Handle stuck or failed warmup jobs
   */
  async handleStuckJob(job: any): Promise<void> {
    try {
      const plan = job.warmup_plans

      // Check if job has been running too long
      if (job.status === 'running' && job.started_at) {
        const startTime = new Date(job.started_at)
        const hoursSinceStart = (Date.now() - startTime.getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceStart > 4) { // Job running for more than 4 hours
          await this.failWarmupJob(job.id, 'Job timeout - running too long')
          
          // Pause warmup plan if multiple failures
          const recentFailures = await this.getRecentJobFailures(job.warmup_plan_id)
          if (recentFailures >= 3) {
            await this.warmupSystem.pauseWarmup(job.warmup_plan_id, 'Multiple job failures detected')
          }
        }
      }

      // Check if pending job should have started
      if (job.status === 'pending') {
        await this.failWarmupJob(job.id, 'Job failed to start on scheduled date')
      }

    } catch (error) {
      console.error('Error handling stuck job:', error)
    }
  }

  /**
   * Check warmup performance and detect issues
   */
  async checkWarmupPerformance(): Promise<void> {
    try {
      // Get active warmup plans
      const { data: plans, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('status', 'active')

      if (error) throw error
      if (!plans) return

      for (const plan of plans) {
        const metrics = plan.metrics

        // Check for critical issues
        const issues = []

        if (metrics.bounce_rate > plan.settings.max_bounce_rate * 1.5) {
          issues.push('Critical bounce rate')
        }

        if (metrics.spam_rate > plan.settings.max_spam_rate * 2) {
          issues.push('Critical spam rate')
        }

        if (metrics.delivery_rate < 0.7) {
          issues.push('Very low delivery rate')
        }

        if (issues.length > 0) {
          await this.warmupSystem.pauseWarmup(
            plan.id, 
            `Auto-paused due to performance issues: ${issues.join(', ')}`
          )
        }
      }

    } catch (error) {
      console.error('Error checking warmup performance:', error)
    }
  }

  // Private helper methods

  private calculateEmailDistribution(currentWeek: number, targetEmails: number): Record<string, number> {
    // Distribution changes based on warmup week
    const distributions = {
      1: { internal: 0.6, partner: 0.3, existing_customer: 0.1, prospect: 0 },
      2: { internal: 0.4, partner: 0.3, existing_customer: 0.2, prospect: 0.1 },
      3: { internal: 0.3, partner: 0.2, existing_customer: 0.3, prospect: 0.2 },
      4: { internal: 0.2, partner: 0.2, existing_customer: 0.3, prospect: 0.3 }
    }

    const distribution = distributions[Math.min(currentWeek, 4)] || distributions[4]
    const result = {}

    for (const [type, percentage] of Object.entries(distribution)) {
      result[type] = Math.round(targetEmails * percentage)
    }

    return result
  }

  private selectRecipients(type: string, count: number): WarmupRecipient[] {
    const typeRecipients = this.WARMUP_RECIPIENTS.filter(r => r.type === type)
    const selected = []

    for (let i = 0; i < count; i++) {
      selected.push(typeRecipients[i % typeRecipients.length])
    }

    return selected
  }

  private selectContentType(currentWeek: number, recipientType: string): 'introduction' | 'follow_up' | 'newsletter' | 'promotional' {
    // Content type selection based on week and recipient
    if (currentWeek === 1) return 'introduction'
    if (currentWeek === 2) return Math.random() > 0.5 ? 'introduction' : 'follow_up'
    if (currentWeek === 3) return Math.random() > 0.3 ? 'follow_up' : 'newsletter'
    return ['follow_up', 'newsletter', 'promotional'][Math.floor(Math.random() * 3)] as any
  }

  private selectContentTemplate(contentType: string, recipientType: string): WarmupContentTemplate {
    const matching = this.CONTENT_TEMPLATES.find(
      t => t.content_type === contentType && t.recipient_type === recipientType
    )
    
    return matching || this.CONTENT_TEMPLATES[0]
  }

  private generateEmailContent(
    template: WarmupContentTemplate, 
    recipient: WarmupRecipient, 
    plan: WarmupPlan
  ): { subject: string; content: string } {
    const subjectTemplate = template.subject_templates[Math.floor(Math.random() * template.subject_templates.length)]
    const contentTemplate = template.content_templates[Math.floor(Math.random() * template.content_templates.length)]

    const variables = {
      name: recipient.name,
      company: recipient.company || 'your company',
      project: 'the current project',
      topic: 'recent developments',
      sender_name: 'Team'
    }

    let subject = subjectTemplate
    let content = contentTemplate

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      subject = subject.replace(regex, value)
      content = content.replace(regex, value)
    }

    return { subject, content }
  }

  private async calculateSendTime(date: string, index: number, total: number, settings: any): Promise<string> {
    const baseDate = new Date(`${date}T09:00:00Z`)
    
    // Spread emails throughout business hours (9 AM - 5 PM)
    const businessHours = 8 * 60 // 8 hours in minutes
    const interval = businessHours / total
    const offsetMinutes = index * interval + Math.random() * 30 // Add some randomness
    
    baseDate.setMinutes(baseDate.getMinutes() + offsetMinutes)
    
    return baseDate.toISOString()
  }

  private shouldSimulateInteraction(recipient: WarmupRecipient, currentWeek: number): {
    simulate: boolean
    type?: 'open' | 'reply' | 'click'
    delayHours?: number
  } {
    // Higher simulation rates for safer recipients and early weeks
    const baseRate = recipient.engagement_likelihood * (currentWeek <= 2 ? 1.2 : 0.8)
    
    if (Math.random() > baseRate) {
      return { simulate: false }
    }

    // Determine interaction type
    const rand = Math.random()
    let type: 'open' | 'reply' | 'click'
    
    if (rand < 0.7) {
      type = 'open'
    } else if (rand < 0.9) {
      type = 'click'
    } else {
      type = 'reply'
    }

    // Random delay between 1-8 hours
    const delayHours = 1 + Math.random() * 7

    return {
      simulate: true,
      type,
      delayHours
    }
  }

  private async addJobLog(jobId: string, level: 'info' | 'warning' | 'error', message: string): Promise<void> {
    try {
      const logEntry: WarmupExecutionLog = {
        timestamp: new Date().toISOString(),
        level,
        message
      }

      await this.supabase
        .from('warmup_jobs')
        .update({
          execution_log: this.supabase.raw('execution_log || ?', [JSON.stringify([logEntry])])
        })
        .eq('id', jobId)

    } catch (error) {
      console.error('Error adding job log:', error)
    }
  }

  private async completeWarmupJob(jobId: string, message: string): Promise<void> {
    await this.supabase
      .from('warmup_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    await this.addJobLog(jobId, 'info', `Job completed: ${message}`)
  }

  private async failWarmupJob(jobId: string, error: string): Promise<void> {
    await this.supabase
      .from('warmup_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error
      })
      .eq('id', jobId)

    await this.addJobLog(jobId, 'error', `Job failed: ${error}`)
  }

  private async rescheduleEmails(emails: WarmupEmail[]): Promise<void> {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    for (const email of emails) {
      const newTime = new Date(tomorrow)
      newTime.setHours(9 + Math.random() * 8) // Random time between 9 AM - 5 PM
      
      await this.supabase
        .from('warmup_emails')
        .update({
          scheduled_at: newTime.toISOString()
        })
        .eq('id', email.id)
    }
  }

  private async getRecentJobFailures(warmupPlanId: string): Promise<number> {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data, error } = await this.supabase
      .from('warmup_jobs')
      .select('id')
      .eq('warmup_plan_id', warmupPlanId)
      .eq('status', 'failed')
      .gte('created_at', threeDaysAgo.toISOString())

    if (error) return 0
    return data?.length || 0
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get warmup execution statistics
   */
  async getExecutionStats(warmupPlanId: string, days: number = 7): Promise<{
    totalJobs: number
    completedJobs: number
    failedJobs: number
    totalEmailsSent: number
    totalEmailsDelivered: number
    averageDeliveryRate: number
    averageEngagementRate: number
    recentJobs: Array<{
      date: string
      status: string
      emailsSent: number
      deliveryRate: number
    }>
  }> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data: jobs, error } = await this.supabase
        .from('warmup_jobs')
        .select('*')
        .eq('warmup_plan_id', warmupPlanId)
        .gte('scheduled_date', startDate.toISOString().split('T')[0])
        .order('scheduled_date', { ascending: false })

      if (error) throw error

      const stats = {
        totalJobs: jobs?.length || 0,
        completedJobs: jobs?.filter(j => j.status === 'completed').length || 0,
        failedJobs: jobs?.filter(j => j.status === 'failed').length || 0,
        totalEmailsSent: jobs?.reduce((sum, j) => sum + j.emails_sent, 0) || 0,
        totalEmailsDelivered: jobs?.reduce((sum, j) => sum + j.emails_delivered, 0) || 0,
        averageDeliveryRate: 0,
        averageEngagementRate: 0,
        recentJobs: []
      }

      if (stats.totalEmailsSent > 0) {
        stats.averageDeliveryRate = stats.totalEmailsDelivered / stats.totalEmailsSent
      }

      const totalEngagement = jobs?.reduce((sum, j) => sum + j.emails_opened + j.emails_replied, 0) || 0
      if (stats.totalEmailsDelivered > 0) {
        stats.averageEngagementRate = totalEngagement / stats.totalEmailsDelivered
      }

      stats.recentJobs = jobs?.map(job => ({
        date: job.scheduled_date,
        status: job.status,
        emailsSent: job.emails_sent,
        deliveryRate: job.emails_sent > 0 ? job.emails_delivered / job.emails_sent : 0
      })) || []

      return stats

    } catch (error) {
      console.error('Error getting execution stats:', error)
      throw error
    }
  }
}