import { z } from 'zod'

// Rate limiting interfaces
export interface RateLimitConfig {
  id: string
  user_id: string
  email_account_id: string
  daily_limit: number
  hourly_limit: number
  domain_daily_limit: number
  warmup_mode: boolean
  warmup_daily_limit?: number
  burst_limit: number
  cooldown_period_minutes: number
  retry_config: RetryConfig
  created_at: string
  updated_at: string
}

export interface RetryConfig {
  max_attempts: number
  backoff_strategy: 'exponential' | 'linear' | 'fixed'
  base_delay_ms: number
  max_delay_ms: number
  retryable_errors: string[]
  jitter: boolean
}

export interface RateLimitUsage {
  email_account_id: string
  date: string // YYYY-MM-DD
  hour: number // 0-23
  emails_sent: number
  domains_targeted: Record<string, number> // domain -> count
  last_send_at: string
  burst_count: number
  burst_window_start: string
  created_at: string
  updated_at: string
}

export interface SendingQuota {
  account_id: string
  daily_remaining: number
  hourly_remaining: number
  domain_limits: Record<string, number> // domain -> remaining
  next_available_slot: string
  is_available: boolean
  burst_available: number
  cooldown_until?: string
  warmup_limit?: number
}

export interface DistributionStrategy {
  type: 'round_robin' | 'least_used' | 'weighted' | 'priority'
  weights?: Record<string, number> // account_id -> weight
  priorities?: Record<string, number> // account_id -> priority
  exclude_accounts?: string[]
  prefer_accounts?: string[]
}

export interface SendRequest {
  id: string
  user_id: string
  campaign_id: string
  contact_id: string
  recipient_email: string
  recipient_domain: string
  priority: 'low' | 'normal' | 'high'
  scheduled_at: string
  retry_count: number
  max_retries: number
  last_error?: string
  created_at: string
  updated_at: string
}

export interface SendResult {
  success: boolean
  account_used?: string
  scheduled_for?: string
  error?: string
  retry_after?: number
  quota_exceeded?: boolean
  domain_limit_exceeded?: boolean
}

// Validation schemas
const retryConfigSchema = z.object({
  max_attempts: z.number().min(1).max(10),
  backoff_strategy: z.enum(['exponential', 'linear', 'fixed']),
  base_delay_ms: z.number().min(1000).max(300000), // 1s to 5min
  max_delay_ms: z.number().min(5000).max(3600000), // 5s to 1hr
  retryable_errors: z.array(z.string()),
  jitter: z.boolean()
})

const rateLimitConfigSchema = z.object({
  daily_limit: z.number().min(1).max(1000),
  hourly_limit: z.number().min(1).max(100),
  domain_daily_limit: z.number().min(1).max(50),
  warmup_mode: z.boolean(),
  warmup_daily_limit: z.number().min(1).max(100).optional(),
  burst_limit: z.number().min(1).max(20),
  cooldown_period_minutes: z.number().min(1).max(60),
  retry_config: retryConfigSchema
})

/**
 * Rate limiting and distribution engine
 */
export class RateLimiter {
  private supabase: any
  private redis: any
  private usageCache: Map<string, RateLimitUsage> = new Map()
  private quotaCache: Map<string, SendingQuota> = new Map()

  // Default rate limits by account status
  private readonly DEFAULT_LIMITS = {
    new_account: {
      daily_limit: 25,
      hourly_limit: 5,
      domain_daily_limit: 3,
      warmup_daily_limit: 15,
      burst_limit: 3,
      cooldown_period_minutes: 15
    },
    warming_up: {
      daily_limit: 40,
      hourly_limit: 8,
      domain_daily_limit: 5,
      warmup_daily_limit: 30,
      burst_limit: 5,
      cooldown_period_minutes: 10
    },
    warmed_up: {
      daily_limit: 50,
      hourly_limit: 12,
      domain_daily_limit: 10,
      burst_limit: 8,
      cooldown_period_minutes: 5
    }
  }

  // Default retry configuration
  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    max_attempts: 3,
    backoff_strategy: 'exponential',
    base_delay_ms: 5000, // 5 seconds
    max_delay_ms: 300000, // 5 minutes
    retryable_errors: [
      'RATE_LIMIT_EXCEEDED',
      'TEMPORARY_FAILURE',
      'CONNECTION_ERROR',
      'TIMEOUT',
      'SERVER_ERROR'
    ],
    jitter: true
  }

  constructor(supabaseClient?: any, redisClient?: any) {
    this.supabase = supabaseClient
    this.redis = redisClient
  }

  /**
   * Check if sending is allowed for a specific account and domain
   */
  async checkSendingQuota(
    accountId: string,
    recipientDomain: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<SendingQuota> {
    try {
      const cacheKey = `quota:${accountId}:${recipientDomain}`
      
      // Check cache first
      if (this.quotaCache.has(cacheKey)) {
        const cached = this.quotaCache.get(cacheKey)!
        if (this.isCacheValid(cached)) {
          return cached
        }
      }

      // Get account configuration
      const config = await this.getRateLimitConfig(accountId)
      if (!config) {
        throw new Error(`Rate limit config not found for account ${accountId}`)
      }

      // Get current usage
      const usage = await this.getCurrentUsage(accountId)
      
      // Calculate quotas
      const quota = await this.calculateQuota(config, usage, recipientDomain, priority)
      
      // Cache the result
      this.quotaCache.set(cacheKey, quota)
      
      return quota

    } catch (error) {
      console.error('Error checking sending quota:', error)
      
      // Return conservative fallback
      return {
        account_id: accountId,
        daily_remaining: 0,
        hourly_remaining: 0,
        domain_limits: { [recipientDomain]: 0 },
        next_available_slot: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        is_available: false,
        burst_available: 0
      }
    }
  }

  /**
   * Select best email account for sending based on distribution strategy
   */
  async selectEmailAccount(
    userId: string,
    recipientDomain: string,
    strategy: DistributionStrategy = { type: 'least_used' },
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<{ accountId: string; scheduledFor?: string } | null> {
    try {
      // Get available accounts for user
      const accounts = await this.getAvailableAccounts(userId, strategy.exclude_accounts)
      if (accounts.length === 0) {
        return null
      }

      // Check quotas for all accounts
      const accountQuotas = await Promise.all(
        accounts.map(async (account) => ({
          account,
          quota: await this.checkSendingQuota(account.id, recipientDomain, priority)
        }))
      )

      // Filter available accounts
      const availableAccounts = accountQuotas.filter(({ quota }) => quota.is_available)
      
      if (availableAccounts.length === 0) {
        // Find the earliest available slot
        const nextAvailable = accountQuotas.reduce((earliest, current) => {
          const currentTime = new Date(current.quota.next_available_slot).getTime()
          const earliestTime = new Date(earliest.quota.next_available_slot).getTime()
          return currentTime < earliestTime ? current : earliest
        })

        return {
          accountId: nextAvailable.account.id,
          scheduledFor: nextAvailable.quota.next_available_slot
        }
      }

      // Apply distribution strategy
      const selectedAccount = this.applyDistributionStrategy(availableAccounts, strategy)
      
      return {
        accountId: selectedAccount.account.id
      }

    } catch (error) {
      console.error('Error selecting email account:', error)
      return null
    }
  }

  /**
   * Record email send and update usage tracking
   */
  async recordSend(
    accountId: string,
    recipientDomain: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const now = new Date()
      const dateKey = now.toISOString().split('T')[0]
      const hour = now.getHours()

      // Update usage in database
      await this.updateUsageTracking(accountId, dateKey, hour, recipientDomain, success)

      // Update cache
      const cacheKey = `usage:${accountId}:${dateKey}`
      if (this.usageCache.has(cacheKey)) {
        const usage = this.usageCache.get(cacheKey)!
        usage.emails_sent += 1
        usage.domains_targeted[recipientDomain] = (usage.domains_targeted[recipientDomain] || 0) + 1
        usage.last_send_at = now.toISOString()
        usage.updated_at = now.toISOString()
      }

      // Clear quota cache to force recalculation
      this.clearQuotaCache(accountId)

      // Log send attempt
      await this.logSendAttempt(accountId, recipientDomain, success, error)

    } catch (error) {
      console.error('Error recording send:', error)
    }
  }

  /**
   * Implement retry logic for failed sends
   */
  async scheduleRetry(
    sendRequest: SendRequest,
    error: string,
    retryConfig?: RetryConfig
  ): Promise<{ shouldRetry: boolean; retryAt?: string; finalFailure?: boolean }> {
    try {
      const config = retryConfig || this.DEFAULT_RETRY_CONFIG

      // Check if error is retryable
      if (!this.isRetryableError(error, config.retryable_errors)) {
        return { shouldRetry: false, finalFailure: true }
      }

      // Check if max retries exceeded
      if (sendRequest.retry_count >= config.max_attempts) {
        return { shouldRetry: false, finalFailure: true }
      }

      // Calculate retry delay
      const delay = this.calculateRetryDelay(
        sendRequest.retry_count,
        config.backoff_strategy,
        config.base_delay_ms,
        config.max_delay_ms,
        config.jitter
      )

      const retryAt = new Date(Date.now() + delay).toISOString()

      // Update send request
      await this.updateSendRequest(sendRequest.id, {
        retry_count: sendRequest.retry_count + 1,
        last_error: error,
        scheduled_at: retryAt
      })

      return { shouldRetry: true, retryAt }

    } catch (error) {
      console.error('Error scheduling retry:', error)
      return { shouldRetry: false, finalFailure: true }
    }
  }

  /**
   * Get rate limit statistics for monitoring
   */
  async getRateLimitStats(
    userId: string,
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{
    accounts: Array<{
      account_id: string
      email: string
      usage_percentage: number
      emails_sent: number
      limit: number
      domains_targeted: number
      avg_success_rate: number
    }>
    total_usage: {
      emails_sent: number
      success_rate: number
      domains_targeted: number
      rate_limit_hits: number
    }
  }> {
    try {
      const accounts = await this.getUserAccounts(userId)
      const stats = []

      for (const account of accounts) {
        const usage = await this.getUsageStats(account.id, timeRange)
        const config = await this.getRateLimitConfig(account.id)
        
        stats.push({
          account_id: account.id,
          email: account.email,
          usage_percentage: config ? (usage.emails_sent / config.daily_limit) * 100 : 0,
          emails_sent: usage.emails_sent,
          limit: config?.daily_limit || 0,
          domains_targeted: usage.domains_targeted,
          avg_success_rate: usage.success_rate
        })
      }

      const totalStats = stats.reduce(
        (acc, stat) => ({
          emails_sent: acc.emails_sent + stat.emails_sent,
          success_rate: acc.success_rate + stat.avg_success_rate,
          domains_targeted: acc.domains_targeted + stat.domains_targeted,
          rate_limit_hits: acc.rate_limit_hits
        }),
        { emails_sent: 0, success_rate: 0, domains_targeted: 0, rate_limit_hits: 0 }
      )

      totalStats.success_rate = totalStats.success_rate / stats.length

      return {
        accounts: stats,
        total_usage: totalStats
      }

    } catch (error) {
      console.error('Error getting rate limit stats:', error)
      throw error
    }
  }

  /**
   * Update rate limit configuration for an account
   */
  async updateRateLimitConfig(
    accountId: string,
    updates: Partial<RateLimitConfig>
  ): Promise<RateLimitConfig> {
    try {
      // Validate updates
      const validatedUpdates = rateLimitConfigSchema.partial().parse(updates)

      // Update in database
      const { data: updated, error } = await this.supabase
        .from('rate_limit_configs')
        .update({
          ...validatedUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('email_account_id', accountId)
        .select()
        .single()

      if (error) throw error

      // Clear caches
      this.clearAccountCaches(accountId)

      return updated

    } catch (error) {
      console.error('Error updating rate limit config:', error)
      throw error
    }
  }

  // Private helper methods

  private async getRateLimitConfig(accountId: string): Promise<RateLimitConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('rate_limit_configs')
        .select('*')
        .eq('email_account_id', accountId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      // Create default config if none exists
      if (!data) {
        return await this.createDefaultConfig(accountId)
      }

      return data

    } catch (error) {
      console.error('Error getting rate limit config:', error)
      return null
    }
  }

  private async createDefaultConfig(accountId: string): Promise<RateLimitConfig> {
    try {
      // Get account info to determine appropriate limits
      const { data: account } = await this.supabase
        .from('email_accounts')
        .select('warmup_status, created_at')
        .eq('id', accountId)
        .single()

      const accountAge = account ? 
        (Date.now() - new Date(account.created_at).getTime()) / (1000 * 60 * 60 * 24) : 0

      let limits
      if (account?.warmup_status === 'completed' && accountAge > 30) {
        limits = this.DEFAULT_LIMITS.warmed_up
      } else if (account?.warmup_status === 'in_progress' || accountAge > 7) {
        limits = this.DEFAULT_LIMITS.warming_up
      } else {
        limits = this.DEFAULT_LIMITS.new_account
      }

      const config: Omit<RateLimitConfig, 'id' | 'created_at' | 'updated_at'> = {
        user_id: account?.user_id || '',
        email_account_id: accountId,
        ...limits,
        warmup_mode: account?.warmup_status !== 'completed',
        retry_config: this.DEFAULT_RETRY_CONFIG
      }

      const { data: created, error } = await this.supabase
        .from('rate_limit_configs')
        .insert(config)
        .select()
        .single()

      if (error) throw error
      return created

    } catch (error) {
      console.error('Error creating default config:', error)
      throw error
    }
  }

  private async getCurrentUsage(accountId: string): Promise<RateLimitUsage> {
    const now = new Date()
    const dateKey = now.toISOString().split('T')[0]
    const hour = now.getHours()
    const cacheKey = `usage:${accountId}:${dateKey}`

    // Check cache first
    if (this.usageCache.has(cacheKey)) {
      return this.usageCache.get(cacheKey)!
    }

    try {
      const { data, error } = await this.supabase
        .from('rate_limit_usage')
        .select('*')
        .eq('email_account_id', accountId)
        .eq('date', dateKey)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      const usage: RateLimitUsage = data || {
        email_account_id: accountId,
        date: dateKey,
        hour,
        emails_sent: 0,
        domains_targeted: {},
        last_send_at: now.toISOString(),
        burst_count: 0,
        burst_window_start: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }

      this.usageCache.set(cacheKey, usage)
      return usage

    } catch (error) {
      console.error('Error getting current usage:', error)
      
      // Return empty usage on error
      return {
        email_account_id: accountId,
        date: dateKey,
        hour,
        emails_sent: 0,
        domains_targeted: {},
        last_send_at: now.toISOString(),
        burst_count: 0,
        burst_window_start: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }
    }
  }

  private async calculateQuota(
    config: RateLimitConfig,
    usage: RateLimitUsage,
    recipientDomain: string,
    priority: 'low' | 'normal' | 'high'
  ): Promise<SendingQuota> {
    const now = new Date()
    const currentHour = now.getHours()

    // Calculate daily remaining
    const effectiveLimit = config.warmup_mode && config.warmup_daily_limit 
      ? Math.min(config.daily_limit, config.warmup_daily_limit)
      : config.daily_limit

    const dailyRemaining = Math.max(0, effectiveLimit - usage.emails_sent)

    // Calculate hourly remaining
    const hourlyUsage = await this.getHourlyUsage(config.email_account_id, currentHour)
    const hourlyRemaining = Math.max(0, config.hourly_limit - hourlyUsage)

    // Calculate domain remaining
    const domainUsage = usage.domains_targeted[recipientDomain] || 0
    const domainRemaining = Math.max(0, config.domain_daily_limit - domainUsage)

    // Check burst limits
    const burstAvailable = this.calculateBurstAvailable(config, usage, now)

    // Check cooldown
    const cooldownUntil = this.calculateCooldownEnd(config, usage, now)

    // Determine availability
    const isAvailable = dailyRemaining > 0 && 
                       hourlyRemaining > 0 && 
                       domainRemaining > 0 && 
                       burstAvailable > 0 && 
                       !cooldownUntil

    // Calculate next available slot
    let nextAvailableSlot = now.toISOString()
    if (!isAvailable) {
      nextAvailableSlot = this.calculateNextAvailableSlot(
        config, usage, now, dailyRemaining, hourlyRemaining, domainRemaining, cooldownUntil
      )
    }

    return {
      account_id: config.email_account_id,
      daily_remaining: dailyRemaining,
      hourly_remaining: hourlyRemaining,
      domain_limits: { [recipientDomain]: domainRemaining },
      next_available_slot: nextAvailableSlot,
      is_available: isAvailable,
      burst_available: burstAvailable,
      cooldown_until: cooldownUntil?.toISOString(),
      warmup_limit: config.warmup_daily_limit
    }
  }

  private calculateBurstAvailable(
    config: RateLimitConfig,
    usage: RateLimitUsage,
    now: Date
  ): number {
    const burstWindowMs = 10 * 60 * 1000 // 10 minutes
    const burstWindowStart = new Date(usage.burst_window_start)
    
    // Reset burst window if expired
    if (now.getTime() - burstWindowStart.getTime() > burstWindowMs) {
      return config.burst_limit
    }

    return Math.max(0, config.burst_limit - usage.burst_count)
  }

  private calculateCooldownEnd(
    config: RateLimitConfig,
    usage: RateLimitUsage,
    now: Date
  ): Date | null {
    if (usage.burst_count >= config.burst_limit) {
      const cooldownEnd = new Date(
        new Date(usage.last_send_at).getTime() + 
        config.cooldown_period_minutes * 60 * 1000
      )
      
      return cooldownEnd > now ? cooldownEnd : null
    }
    
    return null
  }

  private calculateNextAvailableSlot(
    config: RateLimitConfig,
    usage: RateLimitUsage,
    now: Date,
    dailyRemaining: number,
    hourlyRemaining: number,
    domainRemaining: number,
    cooldownUntil: Date | null
  ): string {
    const slots = []

    // Add cooldown end time
    if (cooldownUntil) {
      slots.push(cooldownUntil)
    }

    // Add next hour if hourly limit exceeded
    if (hourlyRemaining <= 0) {
      const nextHour = new Date(now)
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
      slots.push(nextHour)
    }

    // Add next day if daily limit exceeded
    if (dailyRemaining <= 0) {
      const nextDay = new Date(now)
      nextDay.setDate(nextDay.getDate() + 1)
      nextDay.setHours(9, 0, 0, 0) // Start at 9 AM
      slots.push(nextDay)
    }

    // Add next day if domain limit exceeded
    if (domainRemaining <= 0) {
      const nextDay = new Date(now)
      nextDay.setDate(nextDay.getDate() + 1)
      nextDay.setHours(9, 0, 0, 0)
      slots.push(nextDay)
    }

    // Return earliest available slot
    const earliestSlot = slots.reduce((earliest, current) => 
      current < earliest ? current : earliest, 
      new Date(now.getTime() + 60 * 60 * 1000) // Default to 1 hour later
    )

    return earliestSlot.toISOString()
  }

  private async getAvailableAccounts(
    userId: string,
    excludeAccounts?: string[]
  ): Promise<Array<{ id: string; email: string; warmup_status: string }>> {
    try {
      let query = this.supabase
        .from('email_accounts')
        .select('id, email, warmup_status')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (excludeAccounts && excludeAccounts.length > 0) {
        query = query.not('id', 'in', `(${excludeAccounts.join(',')})`)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []

    } catch (error) {
      console.error('Error getting available accounts:', error)
      return []
    }
  }

  private applyDistributionStrategy(
    availableAccounts: Array<{ account: any; quota: SendingQuota }>,
    strategy: DistributionStrategy
  ): { account: any; quota: SendingQuota } {
    switch (strategy.type) {
      case 'round_robin':
        return this.roundRobinSelection(availableAccounts)
      
      case 'least_used':
        return this.leastUsedSelection(availableAccounts)
      
      case 'weighted':
        return this.weightedSelection(availableAccounts, strategy.weights || {})
      
      case 'priority':
        return this.prioritySelection(availableAccounts, strategy.priorities || {})
      
      default:
        return availableAccounts[0]
    }
  }

  private roundRobinSelection(
    accounts: Array<{ account: any; quota: SendingQuota }>
  ): { account: any; quota: SendingQuota } {
    // Simple round-robin based on account ID hash
    const index = Date.now() % accounts.length
    return accounts[index]
  }

  private leastUsedSelection(
    accounts: Array<{ account: any; quota: SendingQuota }>
  ): { account: any; quota: SendingQuota } {
    // Select account with most remaining daily quota
    return accounts.reduce((best, current) => 
      current.quota.daily_remaining > best.quota.daily_remaining ? current : best
    )
  }

  private weightedSelection(
    accounts: Array<{ account: any; quota: SendingQuota }>,
    weights: Record<string, number>
  ): { account: any; quota: SendingQuota } {
    // Weighted random selection
    const totalWeight = accounts.reduce((sum, { account }) => 
      sum + (weights[account.id] || 1), 0
    )
    
    let random = Math.random() * totalWeight
    
    for (const accountData of accounts) {
      const weight = weights[accountData.account.id] || 1
      random -= weight
      if (random <= 0) {
        return accountData
      }
    }
    
    return accounts[0]
  }

  private prioritySelection(
    accounts: Array<{ account: any; quota: SendingQuota }>,
    priorities: Record<string, number>
  ): { account: any; quota: SendingQuota } {
    // Select highest priority account
    return accounts.reduce((best, current) => {
      const currentPriority = priorities[current.account.id] || 0
      const bestPriority = priorities[best.account.id] || 0
      return currentPriority > bestPriority ? current : best
    })
  }

  private async getHourlyUsage(accountId: string, hour: number): Promise<number> {
    try {
      const dateKey = new Date().toISOString().split('T')[0]
      
      const { data, error } = await this.supabase
        .from('rate_limit_usage')
        .select('emails_sent')
        .eq('email_account_id', accountId)
        .eq('date', dateKey)
        .eq('hour', hour)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data?.emails_sent || 0

    } catch (error) {
      console.error('Error getting hourly usage:', error)
      return 0
    }
  }

  private async updateUsageTracking(
    accountId: string,
    date: string,
    hour: number,
    domain: string,
    success: boolean
  ): Promise<void> {
    try {
      const now = new Date().toISOString()

      // Upsert usage record
      const { error } = await this.supabase
        .from('rate_limit_usage')
        .upsert({
          email_account_id: accountId,
          date,
          hour,
          emails_sent: 1,
          domains_targeted: { [domain]: 1 },
          last_send_at: now,
          burst_count: 1,
          burst_window_start: now,
          updated_at: now
        }, {
          onConflict: 'email_account_id,date,hour',
          ignoreDuplicates: false
        })

      if (error) throw error

    } catch (error) {
      console.error('Error updating usage tracking:', error)
    }
  }

  private isRetryableError(error: string, retryableErrors: string[]): boolean {
    return retryableErrors.some(retryableError => 
      error.toUpperCase().includes(retryableError.toUpperCase())
    )
  }

  private calculateRetryDelay(
    retryCount: number,
    strategy: 'exponential' | 'linear' | 'fixed',
    baseDelay: number,
    maxDelay: number,
    jitter: boolean
  ): number {
    let delay: number

    switch (strategy) {
      case 'exponential':
        delay = baseDelay * Math.pow(2, retryCount)
        break
      case 'linear':
        delay = baseDelay * (retryCount + 1)
        break
      case 'fixed':
      default:
        delay = baseDelay
        break
    }

    // Apply jitter
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }

    return Math.min(delay, maxDelay)
  }

  private async updateSendRequest(
    requestId: string,
    updates: Partial<SendRequest>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('send_requests')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

    } catch (error) {
      console.error('Error updating send request:', error)
    }
  }

  private async logSendAttempt(
    accountId: string,
    domain: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('send_logs')
        .insert({
          email_account_id: accountId,
          recipient_domain: domain,
          success,
          error_message: error,
          timestamp: new Date().toISOString()
        })

    } catch (error) {
      console.error('Error logging send attempt:', error)
    }
  }

  private async getUserAccounts(userId: string): Promise<Array<{ id: string; email: string }>> {
    try {
      const { data, error } = await this.supabase
        .from('email_accounts')
        .select('id, email')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) throw error
      return data || []

    } catch (error) {
      console.error('Error getting user accounts:', error)
      return []
    }
  }

  private async getUsageStats(
    accountId: string,
    timeRange: 'hour' | 'day' | 'week'
  ): Promise<{
    emails_sent: number
    domains_targeted: number
    success_rate: number
  }> {
    try {
      // This would need to be implemented based on your specific database schema
      // For now, return mock data
      return {
        emails_sent: 0,
        domains_targeted: 0,
        success_rate: 0
      }

    } catch (error) {
      console.error('Error getting usage stats:', error)
      return {
        emails_sent: 0,
        domains_targeted: 0,
        success_rate: 0
      }
    }
  }

  private isCacheValid(quota: SendingQuota): boolean {
    // Cache is valid for 5 minutes
    const cacheAge = Date.now() - new Date(quota.next_available_slot).getTime()
    return cacheAge < 5 * 60 * 1000
  }

  private clearQuotaCache(accountId: string): void {
    const keysToDelete = []
    for (const key of Array.from(this.quotaCache.keys())) {
      if (key.startsWith(`quota:${accountId}:`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.quotaCache.delete(key))
  }

  private clearAccountCaches(accountId: string): void {
    this.clearQuotaCache(accountId)
    
    const usageKeysToDelete = []
    for (const key of Array.from(this.usageCache.keys())) {
      if (key.startsWith(`usage:${accountId}:`)) {
        usageKeysToDelete.push(key)
      }
    }
    usageKeysToDelete.forEach(key => this.usageCache.delete(key))
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.usageCache.clear()
    this.quotaCache.clear()
  }
}

// Export utility functions
export const RateLimitUtils = {
  /**
   * Calculate optimal sending rate for gradual ramp-up
   */
  calculateRampUpRate(
    accountAge: number, // days
    currentVolume: number,
    targetVolume: number,
    strategy: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): number {
    const strategies = {
      conservative: { rampFactor: 1.1, maxIncrease: 5 },
      moderate: { rampFactor: 1.2, maxIncrease: 10 },
      aggressive: { rampFactor: 1.3, maxIncrease: 15 }
    }

    const { rampFactor, maxIncrease } = strategies[strategy]
    
    if (accountAge < 7) {
      // Very conservative for first week
      return Math.min(currentVolume + 2, 20)
    } else if (accountAge < 14) {
      // Gradual increase for second week
      return Math.min(currentVolume * 1.1, 35)
    } else if (accountAge < 30) {
      // Normal ramp-up
      const increase = Math.min(currentVolume * (rampFactor - 1), maxIncrease)
      return Math.min(currentVolume + increase, targetVolume)
    } else {
      // Mature account
      return targetVolume
    }
  },

  /**
   * Check if domain is high-risk for rate limiting
   */
  isHighRiskDomain(domain: string): boolean {
    const highRiskDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com'
    ]
    
    return highRiskDomains.includes(domain.toLowerCase())
  },

  /**
   * Get recommended limits based on account characteristics
   */
  getRecommendedLimits(
    accountAge: number,
    warmupStatus: string,
    historicalPerformance?: {
      deliveryRate: number
      bounceRate: number
      spamComplaints: number
    }
  ): {
    dailyLimit: number
    hourlyLimit: number
    domainLimit: number
  } {
    let baseLimits = {
      dailyLimit: 25,
      hourlyLimit: 5,
      domainLimit: 3
    }

    // Adjust based on account age
    if (accountAge > 30 && warmupStatus === 'completed') {
      baseLimits = {
        dailyLimit: 50,
        hourlyLimit: 12,
        domainLimit: 10
      }
    } else if (accountAge > 14) {
      baseLimits = {
        dailyLimit: 40,
        hourlyLimit: 8,
        domainLimit: 5
      }
    }

    // Adjust based on performance
    if (historicalPerformance) {
      const { deliveryRate, bounceRate, spamComplaints } = historicalPerformance
      
      if (deliveryRate > 0.95 && bounceRate < 0.02 && spamComplaints < 0.001) {
        // Excellent performance - increase limits
        baseLimits.dailyLimit = Math.floor(baseLimits.dailyLimit * 1.2)
        baseLimits.hourlyLimit = Math.floor(baseLimits.hourlyLimit * 1.2)
        baseLimits.domainLimit = Math.floor(baseLimits.domainLimit * 1.2)
      } else if (deliveryRate < 0.85 || bounceRate > 0.05 || spamComplaints > 0.005) {
        // Poor performance - decrease limits
        baseLimits.dailyLimit = Math.floor(baseLimits.dailyLimit * 0.7)
        baseLimits.hourlyLimit = Math.floor(baseLimits.hourlyLimit * 0.7)
        baseLimits.domainLimit = Math.floor(baseLimits.domainLimit * 0.7)
      }
    }

    return baseLimits
  }
}