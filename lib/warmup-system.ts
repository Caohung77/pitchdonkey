import { z } from 'zod'

// Warmup system interfaces
export interface WarmupPlan {
  id: string
  user_id: string
  email_account_id: string
  strategy: 'conservative' | 'moderate' | 'aggressive'
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed'
  current_week: number
  total_weeks: number
  daily_target: number
  actual_sent_today: number
  total_sent: number
  start_date: string
  expected_completion_date: string
  actual_completion_date?: string
  pause_reason?: string
  failure_reason?: string
  settings: WarmupSettings
  metrics: WarmupMetrics
  created_at: string
  updated_at: string
}

export interface WarmupSettings {
  max_daily_increase: number
  min_daily_volume: number
  max_daily_volume: number
  target_open_rate: number
  target_reply_rate: number
  max_bounce_rate: number
  max_spam_rate: number
  weekend_sending: boolean
  business_hours_only: boolean
  domain_diversification: boolean
  content_variation: boolean
  reply_simulation: boolean
  auto_pause_on_issues: boolean
}

export interface WarmupMetrics {
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_replied: number
  emails_bounced: number
  spam_complaints: number
  unsubscribes: number
  delivery_rate: number
  open_rate: number
  reply_rate: number
  bounce_rate: number
  spam_rate: number
  reputation_score: number
  health_score: number
  trend: 'improving' | 'stable' | 'declining'
}

export interface WarmupSchedule {
  week: number
  daily_target: number
  cumulative_target: number
  focus_areas: string[]
  content_types: string[]
  recipient_types: string[]
  success_criteria: {
    min_delivery_rate: number
    max_bounce_rate: number
    max_spam_rate: number
  }
}

export interface WarmupActivity {
  id: string
  warmup_plan_id: string
  date: string
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_replied: number
  emails_bounced: number
  spam_complaints: number
  content_type: 'introduction' | 'follow_up' | 'newsletter' | 'promotional'
  recipient_type: 'internal' | 'partner' | 'prospect' | 'existing_customer'
  success: boolean
  issues: string[]
  notes?: string
  created_at: string
}

export interface WarmupRecommendation {
  type: 'action' | 'warning' | 'info'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  action_required: boolean
  suggested_actions: string[]
  impact: string
  timeline: string
}

export interface WarmupNotification {
  id: string
  user_id: string
  email_account_id: string
  type: 'milestone' | 'warning' | 'completion' | 'failure' | 'pause'
  title: string
  message: string
  data: Record<string, any>
  read: boolean
  created_at: string
}

// Validation schemas
const warmupSettingsSchema = z.object({
  max_daily_increase: z.number().min(1).max(20),
  min_daily_volume: z.number().min(1).max(50),
  max_daily_volume: z.number().min(10).max(200),
  target_open_rate: z.number().min(0.1).max(1.0),
  target_reply_rate: z.number().min(0.01).max(0.5),
  max_bounce_rate: z.number().min(0.01).max(0.1),
  max_spam_rate: z.number().min(0.001).max(0.05),
  weekend_sending: z.boolean(),
  business_hours_only: z.boolean(),
  domain_diversification: z.boolean(),
  content_variation: z.boolean(),
  reply_simulation: z.boolean(),
  auto_pause_on_issues: z.boolean()
})

const warmupPlanSchema = z.object({
  strategy: z.enum(['conservative', 'moderate', 'aggressive']),
  settings: warmupSettingsSchema.optional()
})

/**
 * Email account warmup system
 */
export class WarmupSystem {
  private supabase: any
  private redis: any
  private notificationService: any

  // Predefined warmup strategies (Updated: Max 50 emails/day limit)
  private readonly WARMUP_STRATEGIES = {
    conservative: {
      total_weeks: 6, // Extended to 6 weeks for safer warmup
      max_daily_increase: 3,
      min_daily_volume: 5,
      max_daily_volume: 50, // Changed from 30 to respect 50/day max
      target_open_rate: 0.25,
      target_reply_rate: 0.05,
      max_bounce_rate: 0.03,
      max_spam_rate: 0.002,
      weekend_sending: false,
      business_hours_only: true,
      domain_diversification: true,
      content_variation: true,
      reply_simulation: true,
      auto_pause_on_issues: true
    },
    moderate: {
      total_weeks: 4, // Extended to 4 weeks
      max_daily_increase: 5,
      min_daily_volume: 8,
      max_daily_volume: 50, // Already compliant
      target_open_rate: 0.20,
      target_reply_rate: 0.03,
      max_bounce_rate: 0.05,
      max_spam_rate: 0.003,
      weekend_sending: true,
      business_hours_only: true,
      domain_diversification: true,
      content_variation: true,
      reply_simulation: true,
      auto_pause_on_issues: true
    },
    aggressive: {
      total_weeks: 3, // Extended to 3 weeks
      max_daily_increase: 10,
      min_daily_volume: 15,
      max_daily_volume: 50, // Changed from 80 to respect 50/day max
      target_open_rate: 0.15,
      target_reply_rate: 0.02,
      max_bounce_rate: 0.07,
      max_spam_rate: 0.005,
      weekend_sending: true,
      business_hours_only: false,
      domain_diversification: true,
      content_variation: true,
      reply_simulation: false,
      auto_pause_on_issues: false
    }
  }

  // Warmup schedules: Simple time-based progression (no milestones)
  // Week progression is based solely on calendar time from start_date
  private readonly WARMUP_SCHEDULES = {
    conservative: [
      {
        week: 1,
        daily_target: 5,
        cumulative_target: 35, // For reference only, not used for progression
        focus_areas: ['Domain reputation', 'Basic deliverability'],
        content_types: ['introduction', 'follow_up'],
        recipient_types: ['internal', 'partner'],
        success_criteria: { min_delivery_rate: 0.95, max_bounce_rate: 0.02, max_spam_rate: 0.001 }
      },
      {
        week: 2,
        daily_target: 10,
        cumulative_target: 105,
        focus_areas: ['Engagement building', 'Content variation'],
        content_types: ['introduction', 'follow_up', 'newsletter'],
        recipient_types: ['internal', 'partner', 'existing_customer'],
        success_criteria: { min_delivery_rate: 0.93, max_bounce_rate: 0.03, max_spam_rate: 0.002 }
      },
      {
        week: 3,
        daily_target: 15,
        cumulative_target: 210,
        focus_areas: ['Volume scaling', 'Prospect outreach'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.90, max_bounce_rate: 0.04, max_spam_rate: 0.003 }
      },
      {
        week: 4,
        daily_target: 20,
        cumulative_target: 350,
        focus_areas: ['Increased volume', 'Campaign diversification'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.88, max_bounce_rate: 0.05, max_spam_rate: 0.004 }
      },
      {
        week: 5,
        daily_target: 30,
        cumulative_target: 560,
        focus_areas: ['Near-full capacity', 'Reputation solidification'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.86, max_bounce_rate: 0.06, max_spam_rate: 0.005 }
      },
      {
        week: 6,
        daily_target: 50,
        cumulative_target: 910,
        focus_areas: ['Full capacity', 'Campaign readiness'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.85, max_bounce_rate: 0.07, max_spam_rate: 0.006 }
      }
    ],
    moderate: [
      {
        week: 1,
        daily_target: 5,
        cumulative_target: 35,
        focus_areas: ['Basic reputation building', 'Gradual start'],
        content_types: ['introduction', 'follow_up'],
        recipient_types: ['internal', 'partner'],
        success_criteria: { min_delivery_rate: 0.92, max_bounce_rate: 0.03, max_spam_rate: 0.002 }
      },
      {
        week: 2,
        daily_target: 10,
        cumulative_target: 105,
        focus_areas: ['Volume scaling', 'Content diversification'],
        content_types: ['introduction', 'follow_up', 'newsletter'],
        recipient_types: ['internal', 'partner', 'existing_customer'],
        success_criteria: { min_delivery_rate: 0.88, max_bounce_rate: 0.05, max_spam_rate: 0.003 }
      },
      {
        week: 3,
        daily_target: 15,
        cumulative_target: 210,
        focus_areas: ['Steady scaling', 'Campaign optimization'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.85, max_bounce_rate: 0.06, max_spam_rate: 0.004 }
      },
      {
        week: 4,
        daily_target: 20,
        cumulative_target: 350,
        focus_areas: ['Increased capacity', 'Campaign diversification'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.82, max_bounce_rate: 0.07, max_spam_rate: 0.005 }
      },
      {
        week: 5,
        daily_target: 30,
        cumulative_target: 560,
        focus_areas: ['High volume preparation', 'Reputation solidification'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.80, max_bounce_rate: 0.08, max_spam_rate: 0.006 }
      },
      {
        week: 6,
        daily_target: 50,
        cumulative_target: 910,
        focus_areas: ['Full capacity', 'Campaign readiness'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.78, max_bounce_rate: 0.09, max_spam_rate: 0.007 }
      }
    ],
    aggressive: [
      {
        week: 1,
        daily_target: 5,
        cumulative_target: 35,
        focus_areas: ['Initial reputation building'],
        content_types: ['introduction', 'follow_up'],
        recipient_types: ['internal', 'partner'],
        success_criteria: { min_delivery_rate: 0.88, max_bounce_rate: 0.05, max_spam_rate: 0.003 }
      },
      {
        week: 2,
        daily_target: 10,
        cumulative_target: 105,
        focus_areas: ['Quick scaling'],
        content_types: ['introduction', 'follow_up', 'newsletter'],
        recipient_types: ['internal', 'partner', 'existing_customer'],
        success_criteria: { min_delivery_rate: 0.82, max_bounce_rate: 0.07, max_spam_rate: 0.005 }
      },
      {
        week: 3,
        daily_target: 15,
        cumulative_target: 210,
        focus_areas: ['Rapid volume increase'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.78, max_bounce_rate: 0.09, max_spam_rate: 0.007 }
      },
      {
        week: 4,
        daily_target: 20,
        cumulative_target: 350,
        focus_areas: ['Accelerated capacity'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.75, max_bounce_rate: 0.10, max_spam_rate: 0.008 }
      },
      {
        week: 5,
        daily_target: 30,
        cumulative_target: 560,
        focus_areas: ['High volume preparation'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.72, max_bounce_rate: 0.11, max_spam_rate: 0.009 }
      },
      {
        week: 6,
        daily_target: 50,
        cumulative_target: 910,
        focus_areas: ['Maximum capacity', 'Campaign readiness'],
        content_types: ['introduction', 'follow_up', 'newsletter', 'promotional'],
        recipient_types: ['internal', 'partner', 'existing_customer', 'prospect'],
        success_criteria: { min_delivery_rate: 0.70, max_bounce_rate: 0.12, max_spam_rate: 0.010 }
      }
    ]
  }

  constructor(supabaseClient?: any, redisClient?: any, notificationService?: any) {
    this.supabase = supabaseClient
    this.redis = redisClient
    this.notificationService = notificationService
  }

  /**
   * Create a new warmup plan for an email account
   */
  async createWarmupPlan(
    userId: string,
    emailAccountId: string,
    strategy: 'conservative' | 'moderate' | 'aggressive' = 'moderate',
    customSettings?: Partial<WarmupSettings>
  ): Promise<WarmupPlan> {
    try {
      // Validate inputs
      const validatedInput = warmupPlanSchema.parse({ strategy, settings: customSettings })

      // Get base settings for strategy
      const baseSettings = this.WARMUP_STRATEGIES[strategy]
      const settings: WarmupSettings = { ...baseSettings, ...customSettings }

      // Calculate dates
      const startDate = new Date()
      const expectedCompletionDate = new Date(startDate)
      expectedCompletionDate.setDate(startDate.getDate() + settings.total_weeks * 7)

      // Get initial daily target
      const schedule = this.WARMUP_SCHEDULES[strategy]
      const initialTarget = schedule[0].daily_target

      // Create warmup plan
      const warmupPlan: Omit<WarmupPlan, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        email_account_id: emailAccountId,
        strategy,
        status: 'pending',
        current_week: 0,
        total_weeks: settings.total_weeks,
        daily_target: initialTarget,
        actual_sent_today: 0,
        total_sent: 0,
        start_date: startDate.toISOString(),
        expected_completion_date: expectedCompletionDate.toISOString(),
        settings,
        metrics: this.initializeMetrics()
      }

      // Save to database
      const { data: created, error } = await this.supabase
        .from('warmup_plans')
        .insert(warmupPlan)
        .select()
        .single()

      if (error) throw error

      // Update email account status
      await this.supabase
        .from('email_accounts')
        .update({ warmup_status: 'pending' })
        .eq('id', emailAccountId)

      // Send notification
      await this.sendNotification(userId, emailAccountId, {
        type: 'milestone',
        title: 'Warmup Plan Created',
        message: `${strategy.charAt(0).toUpperCase() + strategy.slice(1)} warmup plan created for your email account. Warmup will begin shortly.`,
        data: { warmup_plan_id: created.id, strategy }
      })

      return created

    } catch (error) {
      console.error('Error creating warmup plan:', error)
      throw error
    }
  }

  /**
   * Start warmup execution for a plan
   */
  async startWarmup(warmupPlanId: string): Promise<void> {
    try {
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('id', warmupPlanId)
        .single()

      if (error || !plan) throw new Error('Warmup plan not found')

      if (plan.status !== 'pending') {
        throw new Error(`Cannot start warmup in status: ${plan.status}`)
      }

      // Update plan status
      await this.supabase
        .from('warmup_plans')
        .update({
          status: 'active',
          current_week: 1,
          start_date: new Date().toISOString()
        })
        .eq('id', warmupPlanId)

      // Update email account status
      await this.supabase
        .from('email_accounts')
        .update({ warmup_status: 'in_progress' })
        .eq('id', plan.email_account_id)

      // Send notification
      await this.sendNotification(plan.user_id, plan.email_account_id, {
        type: 'milestone',
        title: 'Warmup Started',
        message: 'Email account warmup has begun. Monitor progress in your dashboard.',
        data: { warmup_plan_id: warmupPlanId, week: 1 }
      })

    } catch (error) {
      console.error('Error starting warmup:', error)
      throw error
    }
  }

  /**
   * Get warmup progress and status
   */
  async getWarmupProgress(emailAccountId: string): Promise<{
    plan: WarmupPlan
    schedule: WarmupSchedule[]
    currentWeekProgress: {
      week: number
      target: number
      sent: number
      remaining: number
      percentage: number
    }
    overallProgress: {
      percentage: number
      days_elapsed: number
      days_remaining: number
      on_track: boolean
    }
    recommendations: WarmupRecommendation[]
  }> {
    try {
      // Get active warmup plan
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('email_account_id', emailAccountId)
        .eq('status', 'active')
        .single()

      if (error || !plan) throw new Error('No active warmup plan found')

      // Get schedule for strategy
      const schedule = this.WARMUP_SCHEDULES[plan.strategy]

      // Calculate current week progress
      const currentWeekData = schedule[plan.current_week - 1]
      const todaysSent = await this.getTodaysActivity(plan.id)
      
      const currentWeekProgress = {
        week: plan.current_week,
        target: currentWeekData.daily_target,
        sent: todaysSent.emails_sent,
        remaining: Math.max(0, currentWeekData.daily_target - todaysSent.emails_sent),
        percentage: Math.min(100, (todaysSent.emails_sent / currentWeekData.daily_target) * 100)
      }

      // Calculate overall progress
      const startDate = new Date(plan.start_date)
      const now = new Date()
      const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const totalDays = plan.total_weeks * 7
      const daysRemaining = Math.max(0, totalDays - daysElapsed)
      
      const overallProgress = {
        percentage: Math.min(100, (daysElapsed / totalDays) * 100),
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        on_track: this.isOnTrack(plan, schedule, daysElapsed)
      }

      // Generate recommendations
      const recommendations = await this.generateRecommendations(plan, currentWeekProgress, overallProgress)

      return {
        plan,
        schedule,
        currentWeekProgress,
        overallProgress,
        recommendations
      }

    } catch (error) {
      console.error('Error getting warmup progress:', error)
      throw error
    }
  }

  /**
   * Update warmup metrics based on email activity
   */
  async updateWarmupMetrics(
    warmupPlanId: string,
    activity: {
      emails_sent: number
      emails_delivered: number
      emails_opened: number
      emails_replied: number
      emails_bounced: number
      spam_complaints: number
      content_type: string
      recipient_type: string
    }
  ): Promise<void> {
    try {
      // Get current plan
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('id', warmupPlanId)
        .single()

      if (error || !plan) throw new Error('Warmup plan not found')

      // Record activity
      await this.supabase
        .from('warmup_activities')
        .insert({
          warmup_plan_id: warmupPlanId,
          date: new Date().toISOString().split('T')[0],
          ...activity,
          success: this.evaluateActivitySuccess(activity, plan.settings),
          issues: this.identifyIssues(activity, plan.settings)
        })

      // Update plan metrics
      const updatedMetrics = this.calculateUpdatedMetrics(plan.metrics, activity)
      const healthScore = this.calculateHealthScore(updatedMetrics, plan.settings)
      const reputationScore = this.calculateReputationScore(updatedMetrics)

      await this.supabase
        .from('warmup_plans')
        .update({
          metrics: {
            ...updatedMetrics,
            health_score: healthScore,
            reputation_score: reputationScore,
            trend: this.calculateTrend(plan.metrics, updatedMetrics)
          },
          actual_sent_today: plan.actual_sent_today + activity.emails_sent,
          total_sent: plan.total_sent + activity.emails_sent
        })
        .eq('id', warmupPlanId)

      // Check for issues and auto-pause if needed
      if (plan.settings.auto_pause_on_issues) {
        await this.checkForIssuesAndPause(warmupPlanId, updatedMetrics, plan.settings)
      }

      // Check for week completion
      await this.checkWeekCompletion(warmupPlanId)

    } catch (error) {
      console.error('Error updating warmup metrics:', error)
      throw error
    }
  }

  /**
   * Pause warmup execution
   */
  async pauseWarmup(warmupPlanId: string, reason: string): Promise<void> {
    try {
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('id', warmupPlanId)
        .single()

      if (error || !plan) throw new Error('Warmup plan not found')

      await this.supabase
        .from('warmup_plans')
        .update({
          status: 'paused',
          pause_reason: reason
        })
        .eq('id', warmupPlanId)

      // Send notification
      await this.sendNotification(plan.user_id, plan.email_account_id, {
        type: 'pause',
        title: 'Warmup Paused',
        message: `Warmup has been paused: ${reason}`,
        data: { warmup_plan_id: warmupPlanId, reason }
      })

    } catch (error) {
      console.error('Error pausing warmup:', error)
      throw error
    }
  }

  /**
   * Resume warmup execution
   */
  async resumeWarmup(warmupPlanId: string): Promise<void> {
    try {
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('id', warmupPlanId)
        .single()

      if (error || !plan) throw new Error('Warmup plan not found')

      if (plan.status !== 'paused') {
        throw new Error(`Cannot resume warmup in status: ${plan.status}`)
      }

      await this.supabase
        .from('warmup_plans')
        .update({
          status: 'active',
          pause_reason: null
        })
        .eq('id', warmupPlanId)

      // Send notification
      await this.sendNotification(plan.user_id, plan.email_account_id, {
        type: 'milestone',
        title: 'Warmup Resumed',
        message: 'Email account warmup has been resumed.',
        data: { warmup_plan_id: warmupPlanId }
      })

    } catch (error) {
      console.error('Error resuming warmup:', error)
      throw error
    }
  }

  /**
   * Complete warmup process
   */
  async completeWarmup(warmupPlanId: string): Promise<void> {
    try {
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('id', warmupPlanId)
        .single()

      if (error || !plan) throw new Error('Warmup plan not found')

      await this.supabase
        .from('warmup_plans')
        .update({
          status: 'completed',
          actual_completion_date: new Date().toISOString()
        })
        .eq('id', warmupPlanId)

      // Update email account status
      await this.supabase
        .from('email_accounts')
        .update({ warmup_status: 'completed' })
        .eq('id', plan.email_account_id)

      // Send completion notification
      await this.sendNotification(plan.user_id, plan.email_account_id, {
        type: 'completion',
        title: 'Warmup Completed!',
        message: `Email account warmup completed successfully! Your account is now ready for full campaign sending.`,
        data: { 
          warmup_plan_id: warmupPlanId,
          final_metrics: plan.metrics,
          duration_days: Math.floor((new Date().getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24))
        }
      })

    } catch (error) {
      console.error('Error completing warmup:', error)
      throw error
    }
  }

  /**
   * Get warmup statistics for dashboard
   */
  async getWarmupStats(userId: string): Promise<{
    total_accounts: number
    warming_up: number
    completed: number
    paused: number
    failed: number
    average_completion_time: number
    success_rate: number
    accounts: Array<{
      email_account_id: string
      email: string
      status: string
      progress_percentage: number
      current_week: number
      total_weeks: number
      health_score: number
      issues: string[]
    }>
  }> {
    try {
      // Get all warmup plans for user
      const { data: plans, error } = await this.supabase
        .from('warmup_plans')
        .select(`
          *,
          email_accounts(email)
        `)
        .eq('user_id', userId)

      if (error) throw error

      const stats = {
        total_accounts: plans.length,
        warming_up: plans.filter(p => p.status === 'active').length,
        completed: plans.filter(p => p.status === 'completed').length,
        paused: plans.filter(p => p.status === 'paused').length,
        failed: plans.filter(p => p.status === 'failed').length,
        average_completion_time: 0,
        success_rate: 0,
        accounts: []
      }

      // Calculate average completion time
      const completedPlans = plans.filter(p => p.status === 'completed' && p.actual_completion_date)
      if (completedPlans.length > 0) {
        const totalDays = completedPlans.reduce((sum, plan) => {
          const start = new Date(plan.start_date)
          const end = new Date(plan.actual_completion_date)
          return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        }, 0)
        stats.average_completion_time = totalDays / completedPlans.length
      }

      // Calculate success rate
      const finishedPlans = plans.filter(p => ['completed', 'failed'].includes(p.status))
      if (finishedPlans.length > 0) {
        stats.success_rate = (stats.completed / finishedPlans.length) * 100
      }

      // Build account details
      stats.accounts = plans.map(plan => ({
        email_account_id: plan.email_account_id,
        email: plan.email_accounts.email,
        status: plan.status,
        progress_percentage: this.calculateProgressPercentage(plan),
        current_week: plan.current_week,
        total_weeks: plan.total_weeks,
        health_score: plan.metrics.health_score,
        issues: this.getCurrentIssues(plan)
      }))

      return stats

    } catch (error) {
      console.error('Error getting warmup stats:', error)
      throw error
    }
  }

  // Private helper methods

  private initializeMetrics(): WarmupMetrics {
    return {
      emails_sent: 0,
      emails_delivered: 0,
      emails_opened: 0,
      emails_replied: 0,
      emails_bounced: 0,
      spam_complaints: 0,
      unsubscribes: 0,
      delivery_rate: 0,
      open_rate: 0,
      reply_rate: 0,
      bounce_rate: 0,
      spam_rate: 0,
      reputation_score: 50,
      health_score: 100,
      trend: 'stable'
    }
  }

  private async getTodaysActivity(warmupPlanId: string): Promise<WarmupActivity> {
    const today = new Date().toISOString().split('T')[0]
    
    const { data: activity, error } = await this.supabase
      .from('warmup_activities')
      .select('*')
      .eq('warmup_plan_id', warmupPlanId)
      .eq('date', today)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return activity || {
      id: '',
      warmup_plan_id: warmupPlanId,
      date: today,
      emails_sent: 0,
      emails_delivered: 0,
      emails_opened: 0,
      emails_replied: 0,
      emails_bounced: 0,
      spam_complaints: 0,
      content_type: 'introduction',
      recipient_type: 'internal',
      success: true,
      issues: [],
      created_at: new Date().toISOString()
    }
  }

  private isOnTrack(plan: WarmupPlan, schedule: WarmupSchedule[], daysElapsed: number): boolean {
    const expectedWeek = Math.ceil(daysElapsed / 7)
    const expectedSent = schedule.slice(0, expectedWeek).reduce((sum, week) => sum + week.cumulative_target, 0)
    
    return plan.total_sent >= expectedSent * 0.8 // Allow 20% variance
  }

  private async generateRecommendations(
    plan: WarmupPlan,
    currentWeekProgress: any,
    overallProgress: any
  ): Promise<WarmupRecommendation[]> {
    const recommendations: WarmupRecommendation[] = []

    // Check if behind schedule
    if (!overallProgress.on_track) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        title: 'Behind Schedule',
        description: 'Your warmup is behind the expected pace.',
        action_required: true,
        suggested_actions: [
          'Increase daily sending volume',
          'Review and resolve any delivery issues',
          'Consider extending warmup duration'
        ],
        impact: 'May delay campaign readiness',
        timeline: 'Address within 2-3 days'
      })
    }

    // Check metrics
    if (plan.metrics.bounce_rate > plan.settings.max_bounce_rate) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        title: 'High Bounce Rate',
        description: `Bounce rate (${(plan.metrics.bounce_rate * 100).toFixed(1)}%) exceeds threshold.`,
        action_required: true,
        suggested_actions: [
          'Review and clean email list',
          'Verify email addresses before sending',
          'Check domain authentication settings'
        ],
        impact: 'Poor deliverability and reputation damage',
        timeline: 'Address immediately'
      })
    }

    if (plan.metrics.spam_rate > plan.settings.max_spam_rate) {
      recommendations.push({
        type: 'warning',
        priority: 'critical',
        title: 'High Spam Rate',
        description: `Spam complaint rate (${(plan.metrics.spam_rate * 100).toFixed(3)}%) is too high.`,
        action_required: true,
        suggested_actions: [
          'Review email content for spam triggers',
          'Reduce sending volume temporarily',
          'Improve email authentication',
          'Consider pausing warmup'
        ],
        impact: 'Severe reputation damage and deliverability issues',
        timeline: 'Address immediately'
      })
    }

    // Positive recommendations
    if (plan.metrics.health_score > 90) {
      recommendations.push({
        type: 'info',
        priority: 'low',
        title: 'Excellent Progress',
        description: 'Your warmup is performing exceptionally well.',
        action_required: false,
        suggested_actions: [
          'Continue current strategy',
          'Consider gradual volume increase'
        ],
        impact: 'Strong foundation for campaigns',
        timeline: 'No immediate action needed'
      })
    }

    return recommendations
  }

  private evaluateActivitySuccess(activity: any, settings: WarmupSettings): boolean {
    const deliveryRate = activity.emails_sent > 0 ? activity.emails_delivered / activity.emails_sent : 0
    const bounceRate = activity.emails_sent > 0 ? activity.emails_bounced / activity.emails_sent : 0
    const spamRate = activity.emails_sent > 0 ? activity.spam_complaints / activity.emails_sent : 0

    return deliveryRate >= 0.85 && 
           bounceRate <= settings.max_bounce_rate && 
           spamRate <= settings.max_spam_rate
  }

  private identifyIssues(activity: any, settings: WarmupSettings): string[] {
    const issues: string[] = []
    
    const deliveryRate = activity.emails_sent > 0 ? activity.emails_delivered / activity.emails_sent : 0
    const bounceRate = activity.emails_sent > 0 ? activity.emails_bounced / activity.emails_sent : 0
    const spamRate = activity.emails_sent > 0 ? activity.spam_complaints / activity.emails_sent : 0

    if (deliveryRate < 0.85) issues.push('Low delivery rate')
    if (bounceRate > settings.max_bounce_rate) issues.push('High bounce rate')
    if (spamRate > settings.max_spam_rate) issues.push('High spam rate')
    if (activity.emails_sent === 0) issues.push('No emails sent')

    return issues
  }

  private calculateUpdatedMetrics(currentMetrics: WarmupMetrics, activity: any): WarmupMetrics {
    const newTotals = {
      emails_sent: currentMetrics.emails_sent + activity.emails_sent,
      emails_delivered: currentMetrics.emails_delivered + activity.emails_delivered,
      emails_opened: currentMetrics.emails_opened + activity.emails_opened,
      emails_replied: currentMetrics.emails_replied + activity.emails_replied,
      emails_bounced: currentMetrics.emails_bounced + activity.emails_bounced,
      spam_complaints: currentMetrics.spam_complaints + activity.spam_complaints,
      unsubscribes: currentMetrics.unsubscribes
    }

    return {
      ...newTotals,
      delivery_rate: newTotals.emails_sent > 0 ? newTotals.emails_delivered / newTotals.emails_sent : 0,
      open_rate: newTotals.emails_delivered > 0 ? newTotals.emails_opened / newTotals.emails_delivered : 0,
      reply_rate: newTotals.emails_delivered > 0 ? newTotals.emails_replied / newTotals.emails_delivered : 0,
      bounce_rate: newTotals.emails_sent > 0 ? newTotals.emails_bounced / newTotals.emails_sent : 0,
      spam_rate: newTotals.emails_sent > 0 ? newTotals.spam_complaints / newTotals.emails_sent : 0,
      reputation_score: currentMetrics.reputation_score,
      health_score: currentMetrics.health_score,
      trend: currentMetrics.trend
    }
  }

  private calculateHealthScore(metrics: WarmupMetrics, settings: WarmupSettings): number {
    let score = 100

    // Penalize for poor metrics
    if (metrics.delivery_rate < 0.9) score -= (0.9 - metrics.delivery_rate) * 200
    if (metrics.bounce_rate > settings.max_bounce_rate) score -= (metrics.bounce_rate - settings.max_bounce_rate) * 1000
    if (metrics.spam_rate > settings.max_spam_rate) score -= (metrics.spam_rate - settings.max_spam_rate) * 5000

    // Reward for good engagement
    if (metrics.open_rate > settings.target_open_rate) score += (metrics.open_rate - settings.target_open_rate) * 50
    if (metrics.reply_rate > settings.target_reply_rate) score += (metrics.reply_rate - settings.target_reply_rate) * 100

    return Math.max(0, Math.min(100, score))
  }

  private calculateReputationScore(metrics: WarmupMetrics): number {
    // Simplified reputation scoring
    let score = 50 // Start neutral

    score += metrics.delivery_rate * 30
    score += metrics.open_rate * 20
    score += metrics.reply_rate * 100
    score -= metrics.bounce_rate * 200
    score -= metrics.spam_rate * 1000

    return Math.max(0, Math.min(100, score))
  }

  private calculateTrend(oldMetrics: WarmupMetrics, newMetrics: WarmupMetrics): 'improving' | 'stable' | 'declining' {
    const oldScore = oldMetrics.health_score
    const newScore = newMetrics.health_score

    if (newScore > oldScore + 2) return 'improving'
    if (newScore < oldScore - 2) return 'declining'
    return 'stable'
  }

  private async checkForIssuesAndPause(
    warmupPlanId: string,
    metrics: WarmupMetrics,
    settings: WarmupSettings
  ): Promise<void> {
    const criticalIssues = []

    if (metrics.bounce_rate > settings.max_bounce_rate * 1.5) {
      criticalIssues.push('Bounce rate critically high')
    }
    if (metrics.spam_rate > settings.max_spam_rate * 2) {
      criticalIssues.push('Spam rate critically high')
    }
    if (metrics.health_score < 30) {
      criticalIssues.push('Health score critically low')
    }

    if (criticalIssues.length > 0) {
      await this.pauseWarmup(warmupPlanId, `Auto-paused due to: ${criticalIssues.join(', ')}`)
    }
  }

  private async checkWeekCompletion(warmupPlanId: string): Promise<void> {
    const { data: plan, error } = await this.supabase
      .from('warmup_plans')
      .select('*')
      .eq('id', warmupPlanId)
      .single()

    if (error || !plan) return

    const startDate = new Date(plan.start_date)
    const now = new Date()
    const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const expectedWeek = Math.ceil(daysElapsed / 7)

    if (expectedWeek > plan.current_week && expectedWeek <= plan.total_weeks) {
      // Move to next week
      const schedule = this.WARMUP_SCHEDULES[plan.strategy]
      const nextWeekTarget = schedule[expectedWeek - 1].daily_target

      await this.supabase
        .from('warmup_plans')
        .update({
          current_week: expectedWeek,
          daily_target: nextWeekTarget,
          actual_sent_today: 0 // Reset daily counter
        })
        .eq('id', warmupPlanId)

      // Send milestone notification
      await this.sendNotification(plan.user_id, plan.email_account_id, {
        type: 'milestone',
        title: `Week ${expectedWeek} Started`,
        message: `Warmup progressed to week ${expectedWeek}. New daily target: ${nextWeekTarget} emails.`,
        data: { warmup_plan_id: warmupPlanId, week: expectedWeek, daily_target: nextWeekTarget }
      })
    } else if (expectedWeek > plan.total_weeks) {
      // Warmup should be completed
      await this.completeWarmup(warmupPlanId)
    }
  }

  private calculateProgressPercentage(plan: WarmupPlan): number {
    if (plan.status === 'completed') return 100
    if (plan.status === 'pending') return 0

    const startDate = new Date(plan.start_date)
    const now = new Date()
    const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalDays = plan.total_weeks * 7

    return Math.min(100, (daysElapsed / totalDays) * 100)
  }

  private getCurrentIssues(plan: WarmupPlan): string[] {
    const issues: string[] = []

    if (plan.status === 'paused') issues.push('Paused')
    if (plan.status === 'failed') issues.push('Failed')
    if (plan.metrics.bounce_rate > plan.settings.max_bounce_rate) issues.push('High bounce rate')
    if (plan.metrics.spam_rate > plan.settings.max_spam_rate) issues.push('High spam rate')
    if (plan.metrics.health_score < 50) issues.push('Low health score')

    return issues
  }

  /**
   * Check if warmup should progress to next week based on TIME ELAPSED (not milestones)
   * This is called periodically or after emails are sent
   * Progression is purely time-based: every 7 days = new week
   */
  async checkWarmupProgression(warmupPlanId: string): Promise<void> {
    try {
      const { data: plan, error } = await this.supabase
        .from('warmup_plans')
        .select('*')
        .eq('id', warmupPlanId)
        .single()

      if (error || !plan || plan.status !== 'active') return

      const startDate = new Date(plan.start_date)
      const now = new Date()
      const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

      // Calculate expected week based on days elapsed (1-based)
      // Week 1 = days 0-6, Week 2 = days 7-13, etc.
      const expectedWeek = Math.min(Math.floor(daysElapsed / 7) + 1, plan.total_weeks)

      // Check if we need to progress to a new week
      if (expectedWeek > plan.current_week && expectedWeek <= plan.total_weeks) {
        const schedule = this.WARMUP_SCHEDULES[plan.strategy]
        const currentWeekData = schedule[plan.current_week - 1]
        const nextWeekData = schedule[expectedWeek - 1]

        console.log(`📈 TIME-BASED Warmup progression: Week ${plan.current_week} → ${expectedWeek}`)
        console.log(`   Days elapsed: ${daysElapsed} days`)
        console.log(`   New daily limit: ${currentWeekData.daily_target} → ${nextWeekData.daily_target}`)

        // Update warmup plan to new week
        await this.supabase
          .from('warmup_plans')
          .update({
            current_week: expectedWeek,
            daily_target: nextWeekData.daily_target,
            actual_sent_today: 0 // Reset daily counter for new week
          })
          .eq('id', warmupPlanId)

        // Update email account limits
        await this.supabase
          .from('email_accounts')
          .update({
            warmup_current_week: expectedWeek,
            warmup_current_daily_limit: nextWeekData.daily_target
          })
          .eq('id', plan.email_account_id)

        // Send notification to user
        await this.sendNotification(plan.user_id, plan.email_account_id, {
          type: 'milestone',
          title: `🎉 Warmup Week ${expectedWeek} Started!`,
          message: `Your warmup has progressed to Week ${expectedWeek}. Your new daily limit is ${nextWeekData.daily_target} emails/day.`,
          data: {
            warmup_plan_id: warmupPlanId,
            previous_week: plan.current_week,
            new_week: expectedWeek,
            previous_limit: currentWeekData.daily_target,
            new_limit: nextWeekData.daily_target,
            days_elapsed: daysElapsed
          }
        })

        console.log(`✅ Warmup progressed successfully to Week ${expectedWeek}`)
      }

      // Check if warmup should be completed (after final week)
      else if (expectedWeek > plan.total_weeks) {
        console.log(`🎉 Warmup complete! Plan ${warmupPlanId} completed ${plan.total_weeks} weeks`)
        await this.completeWarmup(warmupPlanId)
      }
    } catch (error) {
      console.error('Error checking warmup progression:', error)
      // Don't throw - this is a background check that shouldn't block email sending
    }
  }

  private async sendNotification(
    userId: string,
    emailAccountId: string,
    notification: Omit<WarmupNotification, 'id' | 'user_id' | 'email_account_id' | 'read' | 'created_at'>
  ): Promise<void> {
    try {
      await this.supabase
        .from('warmup_notifications')
        .insert({
          user_id: userId,
          email_account_id: emailAccountId,
          read: false,
          created_at: new Date().toISOString(),
          ...notification
        })

      // Also send via notification service if available
      if (this.notificationService) {
        await this.notificationService.send(userId, notification)
      }

    } catch (error) {
      console.error('Error sending notification:', error)
    }
  }
}

// Export utility functions
export const WarmupUtils = {
  /**
   * Get recommended strategy based on account characteristics
   */
  getRecommendedStrategy(
    accountAge: number,
    domainAge: number,
    hasAuthentication: boolean,
    urgency: 'low' | 'medium' | 'high'
  ): 'conservative' | 'moderate' | 'aggressive' {
    // Conservative for new domains or accounts without proper authentication
    if (domainAge < 30 || !hasAuthentication) {
      return 'conservative'
    }

    // Aggressive for urgent needs with established domains
    if (urgency === 'high' && domainAge > 180 && accountAge > 7) {
      return 'aggressive'
    }

    // Moderate for most cases
    return 'moderate'
  },

  /**
   * Calculate estimated completion time
   */
  calculateEstimatedCompletion(
    strategy: 'conservative' | 'moderate' | 'aggressive',
    currentProgress: number
  ): { days: number; weeks: number } {
    const totalWeeks = {
      conservative: 4,
      moderate: 3,
      aggressive: 2
    }[strategy]

    const totalDays = totalWeeks * 7
    const remainingDays = Math.ceil(totalDays * (1 - currentProgress / 100))

    return {
      days: remainingDays,
      weeks: Math.ceil(remainingDays / 7)
    }
  },

  /**
   * Validate warmup settings
   */
  validateWarmupSettings(settings: Partial<WarmupSettings>): { valid: boolean; errors: string[] } {
    try {
      warmupSettingsSchema.parse(settings)
      return { valid: true, errors: [] }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        }
      }
      return {
        valid: false,
        errors: ['Invalid warmup settings format']
      }
    }
  }
}