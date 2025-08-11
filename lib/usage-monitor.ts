import { z } from 'zod'
import { subscriptionManager } from './subscription'

// Usage monitoring interfaces
export interface UsageAlert {
  id: string
  userId: string
  metric: string
  threshold: number
  currentUsage: number
  alertType: 'warning' | 'limit_reached' | 'limit_exceeded'
  isActive: boolean
  createdAt: string
  acknowledgedAt?: string
}

export interface UsageRestriction {
  userId: string
  feature: string
  isRestricted: boolean
  reason: string
  restrictedAt: string
  canPurchaseAddon?: boolean
}

export interface UsageNotification {
  id: string
  userId: string
  type: 'usage_warning' | 'limit_reached' | 'limit_exceeded' | 'addon_available'
  title: string
  message: string
  actionUrl?: string
  isRead: boolean
  createdAt: string
}

export interface AddonPurchase {
  id: string
  userId: string
  addonType: 'emails' | 'contacts' | 'campaigns' | 'templates'
  quantity: number
  price: number
  stripePaymentIntentId: string
  status: 'pending' | 'completed' | 'failed'
  expiresAt: string
  createdAt: string
}

export interface UsageReport {
  userId: string
  period: string
  planName: string
  metrics: {
    emailsSent: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
    contactsStored: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
    campaignsActive: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
    templatesCreated: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
    automationsActive: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
    teamMembers: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
    apiCalls: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
    customDomains: {
      used: number
      limit: number
      percentage: number
      trend: number
    }
  }
  restrictions: UsageRestriction[]
  alerts: UsageAlert[]
  recommendations: string[]
  generatedAt: string
}

// Validation schemas
const usageAlertSchema = z.object({
  metric: z.string().min(1),
  threshold: z.number().min(0).max(100),
  alertType: z.enum(['warning', 'limit_reached', 'limit_exceeded'])
})

const addonPurchaseSchema = z.object({
  addonType: z.enum(['emails', 'contacts', 'campaigns', 'templates']),
  quantity: z.number().min(1),
  paymentMethodId: z.string().min(1)
})

/**
 * Usage monitoring and enforcement system
 */
export class UsageMonitor {
  private supabase: any
  private redis: any

  constructor(supabaseClient?: any, redisClient?: any) {
    this.supabase = supabaseClient
    this.redis = redisClient
  }

  /**
   * Track usage for a specific metric
   */
  async trackUsage(
    userId: string,
    metric: keyof Omit<any, 'userId' | 'planId' | 'period' | 'lastUpdated'>,
    increment: number = 1
  ): Promise<void> {
    try {
      // Update usage in subscription manager
      await subscriptionManager.updateUsage()

      // Check if limits are exceeded after update
      // TODO: Implement proper limit checking when subscription manager is complete
      // const limitCheck = await subscriptionManager.checkLimits()
      // if (!limitCheck.withinLimits) {
      //   await this.handleLimitExceeded(userId, limitCheck.exceededLimits)
      // }

      // Check for warning thresholds
      // TODO: Implement when subscription manager is complete
      // await this.checkWarningThresholds(userId, limitCheck.usage, limitCheck.limits)

      // Cache current usage for quick access
      // TODO: Implement when subscription manager is complete
      // await this.cacheUsageData(userId, limitCheck.usage)

    } catch (error) {
      console.error('Error tracking usage:', error)
      throw error
    }
  }

  /**
   * Get current usage status for user
   */
  async getUsageStatus(userId: string): Promise<{
    usage: any
    limits: any
    restrictions: UsageRestriction[]
    alerts: UsageAlert[]
    withinLimits: boolean
  }> {
    try {
      // Try to get from cache first
      const cachedUsage = await this.getCachedUsageData(userId)
      
      // TODO: Implement when subscription manager is complete
      // let limitCheck
      // if (cachedUsage) {
      //   limitCheck = await subscriptionManager.checkLimits()
      // } else {
      //   limitCheck = await subscriptionManager.checkLimits()
      //   await this.cacheUsageData(userId, limitCheck.usage)
      // }

      // Get active restrictions
      const restrictions = await this.getActiveRestrictions(userId)

      // Get active alerts
      const alerts = await this.getActiveAlerts(userId)

      // TODO: Return proper data when subscription manager is complete
      return {
        usage: {},
        limits: {},
        restrictions,
        alerts,
        withinLimits: true
      }

    } catch (error) {
      console.error('Error getting usage status:', error)
      throw error
    }
  }

  /**
   * Check if user can perform an action
   */
  async canPerformAction(
    userId: string,
    action: 'send_email' | 'add_contact' | 'create_campaign' | 'create_template' | 'create_automation' | 'add_team_member' | 'api_call' | 'add_domain'
  ): Promise<{
    allowed: boolean
    reason?: string
    canPurchaseAddon?: boolean
    addonType?: string
  }> {
    try {
      const status = await this.getUsageStatus(userId)

      // Check for active restrictions
      const restriction = status.restrictions.find(r => 
        r.feature === action && r.isRestricted
      )

      if (restriction) {
        return {
          allowed: false,
          reason: restriction.reason,
          canPurchaseAddon: restriction.canPurchaseAddon,
          addonType: this.getAddonTypeForAction(action)
        }
      }

      // Check specific limits
      const metricMap = {
        'send_email': 'emailsSent',
        'add_contact': 'contactsCount',
        'create_campaign': 'campaignsCount',
        'create_template': 'templatesCount',
        'create_automation': 'automationsCount',
        'add_team_member': 'teamMembersCount',
        'api_call': 'apiCallsCount',
        'add_domain': 'customDomainsCount'
      }

      const metric = metricMap[action]
      if (!metric) {
        return { allowed: true }
      }

      const currentUsage = status.usage[metric]
      const limit = status.limits[metric]

      // -1 means unlimited
      if (limit === -1) {
        return { allowed: true }
      }

      if (currentUsage >= limit) {
        return {
          allowed: false,
          reason: `You've reached your ${action.replace('_', ' ')} limit of ${limit}`,
          canPurchaseAddon: this.canPurchaseAddonForAction(action),
          addonType: this.getAddonTypeForAction(action)
        }
      }

      return { allowed: true }

    } catch (error) {
      console.error('Error checking action permission:', error)
      throw error
    }
  }

  /**
   * Create usage alert
   */
  async createAlert(
    userId: string,
    metric: string,
    threshold: number,
    currentUsage: number,
    alertType: 'warning' | 'limit_reached' | 'limit_exceeded'
  ): Promise<UsageAlert> {
    try {
      const alertData = {
        user_id: userId,
        metric,
        threshold,
        current_usage: currentUsage,
        alert_type: alertType,
        is_active: true
      }

      const { data: alert, error } = await this.supabase
        .from('usage_alerts')
        .insert(alertData)
        .select()
        .single()

      if (error) throw error

      // Create notification
      await this.createNotification(userId, alertType, metric, currentUsage, threshold)

      return alert

    } catch (error) {
      console.error('Error creating usage alert:', error)
      throw error
    }
  }

  /**
   * Get active alerts for user
   */
  async getActiveAlerts(userId: string): Promise<UsageAlert[]> {
    try {
      const { data: alerts, error } = await this.supabase
        .from('usage_alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      return alerts || []

    } catch (error) {
      console.error('Error getting active alerts:', error)
      throw error
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(userId: string, alertId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('usage_alerts')
        .update({
          is_active: false,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .eq('user_id', userId)

      if (error) throw error

    } catch (error) {
      console.error('Error acknowledging alert:', error)
      throw error
    }
  }

  /**
   * Create usage restriction
   */
  async createRestriction(
    userId: string,
    feature: string,
    reason: string,
    canPurchaseAddon: boolean = false
  ): Promise<UsageRestriction> {
    try {
      const restrictionData = {
        user_id: userId,
        feature,
        is_restricted: true,
        reason,
        can_purchase_addon: canPurchaseAddon,
        restricted_at: new Date().toISOString()
      }

      const { data: restriction, error } = await this.supabase
        .from('usage_restrictions')
        .upsert(restrictionData, { onConflict: 'user_id,feature' })
        .select()
        .single()

      if (error) throw error

      // Cache restriction for quick access
      await this.cacheRestriction(userId, feature, true)

      return restriction

    } catch (error) {
      console.error('Error creating usage restriction:', error)
      throw error
    }
  }

  /**
   * Remove usage restriction
   */
  async removeRestriction(userId: string, feature: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('usage_restrictions')
        .update({
          is_restricted: false,
          removed_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('feature', feature)

      if (error) throw error

      // Remove from cache
      await this.cacheRestriction(userId, feature, false)

    } catch (error) {
      console.error('Error removing usage restriction:', error)
      throw error
    }
  }

  /**
   * Get active restrictions for user
   */
  async getActiveRestrictions(userId: string): Promise<UsageRestriction[]> {
    try {
      const { data: restrictions, error } = await this.supabase
        .from('usage_restrictions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_restricted', true)

      if (error) throw error

      return restrictions || []

    } catch (error) {
      console.error('Error getting active restrictions:', error)
      throw error
    }
  }

  /**
   * Purchase addon
   */
  async purchaseAddon(
    userId: string,
    addonType: 'emails' | 'contacts' | 'campaigns' | 'templates',
    quantity: number,
    paymentMethodId: string
  ): Promise<AddonPurchase> {
    try {
      // Validate input
      const validatedData = addonPurchaseSchema.parse({
        addonType,
        quantity,
        paymentMethodId
      })

      // Get addon pricing
      const addonPrice = this.getAddonPrice(addonType, quantity)

      // Create Stripe payment intent
      // TODO: Implement when subscription manager is complete
      // const subscription = await subscriptionManager.getUserSubscription()
      // if (!subscription) {
      //   throw new Error('No active subscription found')
      // }

      // For now, we'll create a simple addon purchase record
      // In a real implementation, you'd integrate with Stripe for one-time payments
      const addonData = {
        user_id: userId,
        addon_type: addonType,
        quantity,
        price: addonPrice,
        stripe_payment_intent_id: `pi_addon_${Date.now()}`, // Mock for now
        status: 'completed',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }

      const { data: addon, error } = await this.supabase
        .from('addon_purchases')
        .insert(addonData)
        .select()
        .single()

      if (error) throw error

      // Apply addon to user's limits
      await this.applyAddon(userId, addonType, quantity)

      return addon

    } catch (error) {
      console.error('Error purchasing addon:', error)
      throw error
    }
  }

  /**
   * Generate detailed usage report
   */
  async generateUsageReport(userId: string, period?: string): Promise<UsageReport> {
    try {
      const currentPeriod = period || new Date().toISOString().slice(0, 7)
      const previousPeriod = this.getPreviousPeriod(currentPeriod)

      // Get current usage and limits
      // TODO: Implement when subscription manager is complete
      // const limitCheck = await subscriptionManager.checkLimits()
      
      // Get previous period usage for trend calculation
      // TODO: Implement when subscription manager is complete
      // const previousUsage = await subscriptionManager.getUsageMetrics()

      // Get subscription details
      // TODO: Implement when subscription manager is complete
      // const subscription = await subscriptionManager.getUserSubscription()
      
      // TODO: Implement when subscription manager is complete
      // const { data: plan, error: planError } = await this.supabase
      //   .from('subscription_plans')
      //   .select('name')
      //   .eq('id', subscription?.planId)
      //   .single()
      // if (planError) throw planError

      // Calculate trends and percentages
      // TODO: Implement when subscription manager is complete
      // const metrics = this.calculateMetrics(limitCheck.usage, limitCheck.limits, previousUsage)

      // Get restrictions and alerts
      const [restrictions, alerts] = await Promise.all([
        this.getActiveRestrictions(userId),
        this.getActiveAlerts(userId)
      ])

      // Generate recommendations
      // TODO: Implement when subscription manager is complete
      // const recommendations = this.generateRecommendations(metrics, restrictions)
      const recommendations: string[] = []

      const report: UsageReport = {
        userId,
        period: currentPeriod,
        planName: 'Unknown', // TODO: Get from subscription manager
        metrics: {
          emailsSent: { used: 0, limit: 0, percentage: 0, trend: 0 },
          contactsStored: { used: 0, limit: 0, percentage: 0, trend: 0 },
          campaignsActive: { used: 0, limit: 0, percentage: 0, trend: 0 },
          templatesCreated: { used: 0, limit: 0, percentage: 0, trend: 0 },
          automationsActive: { used: 0, limit: 0, percentage: 0, trend: 0 },
          teamMembers: { used: 0, limit: 0, percentage: 0, trend: 0 },
          apiCalls: { used: 0, limit: 0, percentage: 0, trend: 0 },
          customDomains: { used: 0, limit: 0, percentage: 0, trend: 0 }
        }, // TODO: Get from subscription manager
        restrictions,
        alerts,
        recommendations,
        generatedAt: new Date().toISOString()
      }

      return report

    } catch (error) {
      console.error('Error generating usage report:', error)
      throw error
    }
  }

  /**
   * Get usage notifications
   */
  async getNotifications(userId: string, limit: number = 10): Promise<UsageNotification[]> {
    try {
      const { data: notifications, error } = await this.supabase
        .from('usage_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return notifications || []

    } catch (error) {
      console.error('Error getting notifications:', error)
      throw error
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('usage_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)

      if (error) throw error

    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  // Private helper methods

  private async handleLimitExceeded(userId: string, exceededLimits: string[]): Promise<void> {
    for (const limit of exceededLimits) {
      const feature = this.getFeatureForLimit(limit)
      const reason = `You've exceeded your ${limit} limit`
      
      await this.createRestriction(userId, feature, reason, this.canPurchaseAddonForLimit(limit))
      await this.createAlert(userId, limit, 100, 100, 'limit_exceeded')
    }
  }

  private async checkWarningThresholds(userId: string, usage: any, limits: any): Promise<void> {
    const warningThreshold = 80 // 80% warning
    const criticalThreshold = 95 // 95% critical

    for (const [metric, currentUsage] of Object.entries(usage)) {
      const limit = limits[metric]
      
      if (limit === -1 || typeof currentUsage !== 'number') continue

      const percentage = (currentUsage / limit) * 100

      if (percentage >= criticalThreshold) {
        await this.createAlert(userId, metric, criticalThreshold, currentUsage, 'limit_reached')
      } else if (percentage >= warningThreshold) {
        await this.createAlert(userId, metric, warningThreshold, currentUsage, 'warning')
      }
    }
  }

  private async cacheUsageData(userId: string, usage: any): Promise<void> {
    if (!this.redis) return

    try {
      const cacheKey = `usage:${userId}`
      await this.redis.setex(cacheKey, 300, JSON.stringify(usage)) // Cache for 5 minutes
    } catch (error) {
      console.error('Error caching usage data:', error)
    }
  }

  private async getCachedUsageData(userId: string): Promise<any | null> {
    if (!this.redis) return null

    try {
      const cacheKey = `usage:${userId}`
      const cached = await this.redis.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Error getting cached usage data:', error)
      return null
    }
  }

  private async cacheRestriction(userId: string, feature: string, isRestricted: boolean): Promise<void> {
    if (!this.redis) return

    try {
      const cacheKey = `restriction:${userId}:${feature}`
      if (isRestricted) {
        await this.redis.setex(cacheKey, 3600, 'true') // Cache for 1 hour
      } else {
        await this.redis.del(cacheKey)
      }
    } catch (error) {
      console.error('Error caching restriction:', error)
    }
  }

  private async createNotification(
    userId: string,
    alertType: string,
    metric: string,
    currentUsage: number,
    threshold: number
  ): Promise<void> {
    try {
      const notificationData = this.getNotificationData(alertType, metric, currentUsage, threshold)
      
      const { error } = await this.supabase
        .from('usage_notifications')
        .insert({
          user_id: userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          action_url: notificationData.actionUrl,
          is_read: false
        })

      if (error) throw error

    } catch (error) {
      console.error('Error creating notification:', error)
    }
  }

  private getNotificationData(alertType: string, metric: string, currentUsage: number, threshold: number) {
    const metricName = metric.replace(/([A-Z])/g, ' $1').toLowerCase()
    
    switch (alertType) {
      case 'warning':
        return {
          type: 'usage_warning',
          title: `Usage Warning: ${metricName}`,
          message: `You've used ${threshold}% of your ${metricName} limit (${currentUsage} used)`,
          actionUrl: '/dashboard/billing'
        }
      case 'limit_reached':
        return {
          type: 'limit_reached',
          title: `Limit Almost Reached: ${metricName}`,
          message: `You've used ${threshold}% of your ${metricName} limit (${currentUsage} used)`,
          actionUrl: '/dashboard/billing'
        }
      case 'limit_exceeded':
        return {
          type: 'limit_exceeded',
          title: `Limit Exceeded: ${metricName}`,
          message: `You've exceeded your ${metricName} limit. Some features may be restricted.`,
          actionUrl: '/dashboard/billing'
        }
      default:
        return {
          type: 'usage_warning',
          title: 'Usage Alert',
          message: `Usage alert for ${metricName}`,
          actionUrl: '/dashboard/billing'
        }
    }
  }

  private getFeatureForLimit(limit: string): string {
    const featureMap = {
      'emailsPerMonth': 'send_email',
      'contactsLimit': 'add_contact',
      'campaignsLimit': 'create_campaign',
      'templatesLimit': 'create_template',
      'automationsLimit': 'create_automation',
      'teamMembersLimit': 'add_team_member',
      'apiCallsPerMonth': 'api_call',
      'customDomains': 'add_domain'
    }
    return featureMap[limit] || limit
  }

  private canPurchaseAddonForLimit(limit: string): boolean {
    const addonAvailable = ['emailsPerMonth', 'contactsLimit', 'campaignsLimit', 'templatesLimit']
    return addonAvailable.includes(limit)
  }

  private canPurchaseAddonForAction(action: string): boolean {
    const addonActions = ['send_email', 'add_contact', 'create_campaign', 'create_template']
    return addonActions.includes(action)
  }

  private getAddonTypeForAction(action: string): string {
    const addonMap = {
      'send_email': 'emails',
      'add_contact': 'contacts',
      'create_campaign': 'campaigns',
      'create_template': 'templates'
    }
    return addonMap[action] || 'emails'
  }

  private getAddonPrice(addonType: string, quantity: number): number {
    const pricing = {
      'emails': 0.01, // $0.01 per email
      'contacts': 0.05, // $0.05 per contact
      'campaigns': 500, // $5.00 per campaign
      'templates': 200 // $2.00 per template
    }
    return Math.round((pricing[addonType] || 0.01) * quantity * 100) // Convert to cents
  }

  private async applyAddon(userId: string, addonType: string, quantity: number): Promise<void> {
    // This would update the user's temporary limits
    // For now, we'll just log it
    console.log(`Applied addon: ${addonType} x${quantity} for user ${userId}`)
  }

  private getPreviousPeriod(period: string): string {
    const [year, month] = period.split('-').map(Number)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    return `${prevYear}-${prevMonth.toString().padStart(2, '0')}`
  }

  private calculateMetrics(currentUsage: any, limits: any, previousUsage: any) {
    const metrics = {}
    
    for (const [key, current] of Object.entries(currentUsage)) {
      const limit = limits[key]
      const previous = previousUsage[key] || 0
      
      if (typeof current === 'number') {
        const percentage = limit === -1 ? 0 : (current / limit) * 100
        const trend = current - previous
        
        metrics[key] = {
          used: current,
          limit: limit === -1 ? 'Unlimited' : limit,
          percentage: Math.round(percentage),
          trend
        }
      }
    }
    
    return metrics
  }

  private generateRecommendations(metrics: any, restrictions: UsageRestriction[]): string[] {
    const recommendations = []
    
    // Check for high usage
    for (const [key, metric] of Object.entries(metrics)) {
      if (metric.percentage > 80) {
        recommendations.push(`Consider upgrading your plan - you're using ${metric.percentage}% of your ${key} limit`)
      }
    }
    
    // Check for restrictions
    if (restrictions.length > 0) {
      recommendations.push('Some features are currently restricted due to usage limits')
    }
    
    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push('Your usage is within normal limits')
    }
    
    return recommendations
  }
}

// Export default instance
export const usageMonitor = new UsageMonitor()