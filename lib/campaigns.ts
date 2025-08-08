import { z } from 'zod'

// Core campaign interfaces
export interface Campaign {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  contact_list_ids: string[]
  email_sequence: EmailStep[]
  ai_settings: AIPersonalizationSettings
  schedule_settings: ScheduleSettings
  ab_test_settings?: ABTestSettings
  tags: string[]
  created_at: string
  updated_at: string
  launched_at?: string
  completed_at?: string
  archived_at?: string
}

export interface EmailStep {
  id: string
  step_number: number
  name: string
  subject_template: string
  content_template: string
  delay_days: number
  delay_hours: number
  conditions: StepCondition[]
  ab_test_variant?: string
  personalization_template_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StepCondition {
  id: string
  type: 'reply_received' | 'email_opened' | 'link_clicked' | 'time_elapsed' | 'previous_step_opened' | 'previous_step_clicked'
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  value: any
  action: 'stop_sequence' | 'skip_step' | 'branch_to_step' | 'delay_step'
  target_step_id?: string
  delay_hours?: number
}

export interface AIPersonalizationSettings {
  enabled: boolean
  provider: 'openai' | 'anthropic'
  model?: string
  template_id?: string
  custom_prompt?: string
  variables: Record<string, string>
  fallback_to_template: boolean
  confidence_threshold: number
}

export interface ScheduleSettings {
  timezone_detection: boolean
  business_hours_only: boolean
  business_hours_start: string // HH:MM format
  business_hours_end: string   // HH:MM format
  business_days: number[]      // 0-6, Sunday = 0
  custom_time_windows: TimeWindow[]
  avoid_weekends: boolean
  avoid_holidays: boolean
  holiday_list: string[]       // ISO date strings
  rate_limiting: RateLimitSettings
  send_immediately: boolean
}

export interface TimeWindow {
  id: string
  name: string
  start_time: string // HH:MM
  end_time: string   // HH:MM
  days: number[]     // 0-6, Sunday = 0
  timezone?: string
}

export interface RateLimitSettings {
  daily_limit: number
  hourly_limit: number
  domain_limit: number         // max emails per domain per day
  account_rotation: boolean
  warmup_mode: boolean
  batch_size: number
  batch_delay_minutes: number
}

export interface ABTestSettings {
  enabled: boolean
  test_type: 'subject_line' | 'content' | 'send_time'
  variants: ABTestVariant[]
  traffic_split: number[]      // percentages that sum to 100
  winner_criteria: 'open_rate' | 'click_rate' | 'reply_rate'
  confidence_level: number     // 0.90, 0.95, 0.99
  minimum_sample_size: number
  test_duration_hours: number
  auto_select_winner: boolean
}

export interface ABTestVariant {
  id: string
  name: string
  subject_template?: string
  content_template?: string
  send_time_offset_hours?: number
  is_control: boolean
}

export interface CampaignContact {
  id: string
  campaign_id: string
  contact_id: string
  current_step: number
  status: 'pending' | 'active' | 'completed' | 'stopped' | 'bounced' | 'unsubscribed'
  last_email_sent_at?: string
  next_email_scheduled_at?: string
  reply_received_at?: string
  unsubscribed_at?: string
  ab_test_variant?: string
  personalization_data?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CampaignStats {
  campaign_id: string
  total_contacts: number
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  emails_bounced: number
  unsubscribed: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
  unsubscribe_rate: number
  positive_reply_rate: number
  step_performance: StepPerformance[]
  ab_test_results?: ABTestResults
}

export interface StepPerformance {
  step_number: number
  step_name: string
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  reply_rate: number
}

export interface ABTestResults {
  test_id: string
  status: 'running' | 'completed' | 'stopped'
  winner_variant_id?: string
  confidence_level: number
  statistical_significance: boolean
  variants: ABTestVariantResults[]
}

export interface ABTestVariantResults {
  variant_id: string
  variant_name: string
  emails_sent: number
  metric_value: number  // based on winner_criteria
  confidence_interval: [number, number]
  is_winner: boolean
}

// Validation schemas
export const emailStepSchema = z.object({
  step_number: z.number().min(1).max(7),
  name: z.string().min(1, 'Step name is required').max(100),
  subject_template: z.string().min(1, 'Subject template is required').max(200),
  content_template: z.string().min(10, 'Content template must be at least 10 characters'),
  delay_days: z.number().min(0).max(30),
  delay_hours: z.number().min(0).max(23),
  conditions: z.array(z.object({
    type: z.enum(['reply_received', 'email_opened', 'link_clicked', 'time_elapsed', 'previous_step_opened', 'previous_step_clicked']),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains']),
    value: z.any(),
    action: z.enum(['stop_sequence', 'skip_step', 'branch_to_step', 'delay_step']),
    target_step_id: z.string().optional(),
    delay_hours: z.number().min(0).max(168).optional() // max 1 week
  })),
  personalization_template_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true)
})

export const scheduleSettingsSchema = z.object({
  timezone_detection: z.boolean().default(true),
  business_hours_only: z.boolean().default(true),
  business_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00'),
  business_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('17:00'),
  business_days: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]), // Mon-Fri
  custom_time_windows: z.array(z.object({
    id: z.string(),
    name: z.string(),
    start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    days: z.array(z.number().min(0).max(6)),
    timezone: z.string().optional()
  })).default([]),
  avoid_weekends: z.boolean().default(true),
  avoid_holidays: z.boolean().default(true),
  holiday_list: z.array(z.string()).default([]),
  rate_limiting: z.object({
    daily_limit: z.number().min(1).max(200).default(50),
    hourly_limit: z.number().min(1).max(50).default(10),
    domain_limit: z.number().min(1).max(20).default(10),
    account_rotation: z.boolean().default(true),
    warmup_mode: z.boolean().default(false),
    batch_size: z.number().min(1).max(50).default(10),
    batch_delay_minutes: z.number().min(1).max(60).default(5)
  }),
  send_immediately: z.boolean().default(false)
})

export const aiPersonalizationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['openai', 'anthropic']).default('openai'),
  model: z.string().optional(),
  template_id: z.string().uuid().optional(),
  custom_prompt: z.string().optional(),
  variables: z.record(z.string()).default({}),
  fallback_to_template: z.boolean().default(true),
  confidence_threshold: z.number().min(0).max(1).default(0.7)
}).refine(data => data.template_id || data.custom_prompt, {
  message: 'Either template_id or custom_prompt is required when AI personalization is enabled'
})

export const abTestSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  test_type: z.enum(['subject_line', 'content', 'send_time']),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    subject_template: z.string().optional(),
    content_template: z.string().optional(),
    send_time_offset_hours: z.number().min(-12).max(12).optional(),
    is_control: z.boolean()
  })).min(2).max(5),
  traffic_split: z.array(z.number().min(10).max(90)).refine(arr => 
    arr.reduce((sum, val) => sum + val, 0) === 100, 
    { message: 'Traffic split must sum to 100%' }
  ),
  winner_criteria: z.enum(['open_rate', 'click_rate', 'reply_rate']).default('open_rate'),
  confidence_level: z.enum(['0.90', '0.95', '0.99']).default('0.95'),
  minimum_sample_size: z.number().min(50).max(10000).default(100),
  test_duration_hours: z.number().min(24).max(168).default(72), // 1-7 days
  auto_select_winner: z.boolean().default(true)
})

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Campaign name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  contact_list_ids: z.array(z.string().uuid()).min(1, 'At least one contact list is required'),
  email_sequence: z.array(emailStepSchema).min(1, 'At least one email step is required').max(7, 'Maximum 7 email steps allowed'),
  ai_settings: aiPersonalizationSettingsSchema,
  schedule_settings: scheduleSettingsSchema,
  ab_test_settings: abTestSettingsSchema.optional(),
  tags: z.array(z.string()).default([])
})

// Campaign template interfaces
export interface CampaignTemplate {
  id: string
  name: string
  description: string
  category: 'cold_outreach' | 'follow_up' | 'nurture' | 'event' | 'product_launch' | 'custom'
  industry?: string
  use_case: string
  email_sequence: Omit<EmailStep, 'id' | 'created_at' | 'updated_at'>[]
  default_ai_settings: AIPersonalizationSettings
  default_schedule_settings: ScheduleSettings
  tags: string[]
  is_public: boolean
  usage_count: number
  success_rate?: number
  created_by: string
  created_at: string
  updated_at: string
}

export const campaignTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  category: z.enum(['cold_outreach', 'follow_up', 'nurture', 'event', 'product_launch', 'custom']),
  industry: z.string().optional(),
  use_case: z.string().min(1).max(200),
  email_sequence: z.array(emailStepSchema),
  default_ai_settings: aiPersonalizationSettingsSchema,
  default_schedule_settings: scheduleSettingsSchema,
  tags: z.array(z.string()).default([]),
  is_public: z.boolean().default(false)
})

// Utility functions
export class CampaignUtils {
  /**
   * Calculate total delay for a sequence step
   */
  static calculateStepDelay(step: EmailStep): number {
    return (step.delay_days * 24) + step.delay_hours
  }

  /**
   * Validate email sequence for logical consistency
   */
  static validateEmailSequence(sequence: EmailStep[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Check step numbers are sequential
    const stepNumbers = sequence.map(s => s.step_number).sort((a, b) => a - b)
    for (let i = 0; i < stepNumbers.length; i++) {
      if (stepNumbers[i] !== i + 1) {
        errors.push(`Step numbers must be sequential starting from 1. Missing step ${i + 1}`)
      }
    }
    
    // Check for duplicate step numbers
    const uniqueSteps = new Set(stepNumbers)
    if (uniqueSteps.size !== stepNumbers.length) {
      errors.push('Duplicate step numbers found')
    }
    
    // Validate conditions reference valid steps
    sequence.forEach(step => {
      step.conditions.forEach(condition => {
        if (condition.action === 'branch_to_step' && condition.target_step_id) {
          const targetExists = sequence.some(s => s.id === condition.target_step_id)
          if (!targetExists) {
            errors.push(`Step ${step.step_number} references non-existent target step`)
          }
        }
      })
    })
    
    // Check first step has no delay
    const firstStep = sequence.find(s => s.step_number === 1)
    if (firstStep && (firstStep.delay_days > 0 || firstStep.delay_hours > 0)) {
      errors.push('First step cannot have a delay')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Calculate estimated campaign duration
   */
  static calculateCampaignDuration(sequence: EmailStep[]): number {
    if (sequence.length === 0) return 0
    
    const sortedSteps = sequence.sort((a, b) => a.step_number - b.step_number)
    let totalHours = 0
    
    for (const step of sortedSteps) {
      totalHours += this.calculateStepDelay(step)
    }
    
    return totalHours
  }

  /**
   * Get next step for a contact based on conditions
   */
  static getNextStep(
    currentStep: EmailStep,
    sequence: EmailStep[],
    contactData: any
  ): EmailStep | null {
    // Check conditions
    for (const condition of currentStep.conditions) {
      if (this.evaluateCondition(condition, contactData)) {
        switch (condition.action) {
          case 'stop_sequence':
            return null
          case 'skip_step':
            const nextStepNumber = currentStep.step_number + 1
            return sequence.find(s => s.step_number === nextStepNumber) || null
          case 'branch_to_step':
            return sequence.find(s => s.id === condition.target_step_id) || null
        }
      }
    }
    
    // Default: proceed to next step
    const nextStepNumber = currentStep.step_number + 1
    return sequence.find(s => s.step_number === nextStepNumber) || null
  }

  /**
   * Evaluate a step condition
   */
  private static evaluateCondition(condition: StepCondition, contactData: any): boolean {
    const { type, operator, value } = condition
    let actualValue: any
    
    switch (type) {
      case 'reply_received':
        actualValue = contactData.reply_received_at ? true : false
        break
      case 'email_opened':
        actualValue = contactData.last_opened_at ? true : false
        break
      case 'link_clicked':
        actualValue = contactData.last_clicked_at ? true : false
        break
      case 'time_elapsed':
        const elapsed = Date.now() - new Date(contactData.last_email_sent_at).getTime()
        actualValue = Math.floor(elapsed / (1000 * 60 * 60)) // hours
        break
      default:
        return false
    }
    
    switch (operator) {
      case 'equals':
        return actualValue === value
      case 'not_equals':
        return actualValue !== value
      case 'greater_than':
        return actualValue > value
      case 'less_than':
        return actualValue < value
      case 'contains':
        return String(actualValue).includes(String(value))
      default:
        return false
    }
  }

  /**
   * Generate campaign summary
   */
  static generateCampaignSummary(campaign: Campaign): {
    totalSteps: number
    estimatedDuration: string
    hasConditionalLogic: boolean
    hasABTesting: boolean
    aiPersonalizationEnabled: boolean
  } {
    const totalSteps = campaign.email_sequence.length
    const durationHours = this.calculateCampaignDuration(campaign.email_sequence)
    const hasConditionalLogic = campaign.email_sequence.some(step => step.conditions.length > 0)
    const hasABTesting = campaign.ab_test_settings?.enabled || false
    const aiPersonalizationEnabled = campaign.ai_settings.enabled
    
    let estimatedDuration = ''
    if (durationHours < 24) {
      estimatedDuration = `${durationHours} hours`
    } else {
      const days = Math.floor(durationHours / 24)
      const hours = durationHours % 24
      estimatedDuration = hours > 0 ? `${days} days ${hours} hours` : `${days} days`
    }
    
    return {
      totalSteps,
      estimatedDuration,
      hasConditionalLogic,
      hasABTesting,
      aiPersonalizationEnabled
    }
  }

  /**
   * Validate campaign before launch
   */
  static validateCampaignForLaunch(campaign: Campaign): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Basic validation
    if (!campaign.name.trim()) {
      errors.push('Campaign name is required')
    }
    
    if (campaign.contact_list_ids.length === 0) {
      errors.push('At least one contact list is required')
    }
    
    if (campaign.email_sequence.length === 0) {
      errors.push('At least one email step is required')
    }
    
    // Validate email sequence
    const sequenceValidation = this.validateEmailSequence(campaign.email_sequence)
    if (!sequenceValidation.valid) {
      errors.push(...sequenceValidation.errors)
    }
    
    // Validate AI settings
    if (campaign.ai_settings.enabled) {
      if (!campaign.ai_settings.template_id && !campaign.ai_settings.custom_prompt) {
        errors.push('AI personalization requires either a template or custom prompt')
      }
    }
    
    // Validate A/B test settings
    if (campaign.ab_test_settings?.enabled) {
      if (campaign.ab_test_settings.variants.length < 2) {
        errors.push('A/B testing requires at least 2 variants')
      }
      
      const controlVariants = campaign.ab_test_settings.variants.filter(v => v.is_control)
      if (controlVariants.length !== 1) {
        errors.push('A/B testing requires exactly one control variant')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get default campaign template
   */
  static getDefaultCampaignTemplate(): Partial<Campaign> {
    return {
      name: '',
      description: '',
      status: 'draft',
      contact_list_ids: [],
      email_sequence: [
        {
          id: crypto.randomUUID(),
          step_number: 1,
          name: 'Initial Outreach',
          subject_template: 'Quick question about {{company_name}}',
          content_template: `Hi {{first_name}},

I hope this email finds you well. I noticed {{company_name}} is doing great work in {{industry}}.

I'd love to share how we've helped similar companies achieve [specific benefit].

Would you be open to a brief 15-minute call this week?

Best regards,
[Your Name]`,
          delay_days: 0,
          delay_hours: 0,
          conditions: [],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      ai_settings: {
        enabled: true,
        provider: 'openai',
        variables: {},
        fallback_to_template: true,
        confidence_threshold: 0.7
      },
      schedule_settings: {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        custom_time_windows: [],
        avoid_weekends: true,
        avoid_holidays: true,
        holiday_list: [],
        rate_limiting: {
          daily_limit: 50,
          hourly_limit: 10,
          domain_limit: 10,
          account_rotation: true,
          warmup_mode: false,
          batch_size: 10,
          batch_delay_minutes: 5
        },
        send_immediately: false
      },
      tags: []
    }
  }
}