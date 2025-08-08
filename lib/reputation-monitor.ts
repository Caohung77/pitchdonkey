import { z } from 'zod'

// Reputation monitoring interfaces
export interface ReputationScore {
  domain: string
  ipAddress?: string
  overallScore: number // 0-100, higher is better
  lastUpdated: string
  factors: {
    deliverabilityScore: number
    bounceRate: number
    complaintRate: number
    unsubscribeRate: number
    engagementRate: number
    blacklistStatus: number
    domainAge: number
    volumeConsistency: number
  }
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  alerts: ReputationAlert[]
  recommendations: string[]
}

export interface ReputationAlert {
  id: string
  type: 'blacklist' | 'bounce_rate' | 'complaint_rate' | 'volume_spike' | 'engagement_drop'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: string
  timestamp: string
  resolved: boolean
  resolvedAt?: string
  actions: string[]
}

export interface BlacklistCheck {
  domain: string
  ipAddress?: string
  blacklists: BlacklistResult[]
  overallStatus: 'clean' | 'listed' | 'unknown'
  lastChecked: string
  nextCheck: string
}

export interface BlacklistResult {
  name: string
  url: string
  listed: boolean
  details?: string
  severity: 'low' | 'medium' | 'high'
  impact: string
}

export interface BounceRateMetrics {
  domain: string
  timeRange: string
  totalSent: number
  totalBounces: number
  hardBounces: number
  softBounces: number
  bounceRate: number
  hardBounceRate: number
  softBounceRate: number
  trend: 'improving' | 'stable' | 'declining'
  threshold: {
    warning: number
    critical: number
  }
  status: 'healthy' | 'warning' | 'critical'
}

export interface ComplaintMetrics {
  domain: string
  timeRange: string
  totalSent: number
  totalComplaints: number
  complaintRate: number
  complaintSources: Array<{
    source: string
    count: number
    rate: number
  }>
  trend: 'improving' | 'stable' | 'declining'
  threshold: {
    warning: number
    critical: number
  }
  status: 'healthy' | 'warning' | 'critical'
}

export interface ListCleaningResult {
  totalProcessed: number
  cleaned: number
  bounced: number
  complained: number
  unsubscribed: number
  inactive: number
  duplicates: number
  invalid: number
  recommendations: string[]
}

// Validation schemas
const domainSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)
const ipSchema = z.string().ip()

/**
 * Reputation monitoring and protection system
 */
export class ReputationMonitor {
  private supabase: any
  private redis: any
  private blacklistProviders: BlacklistProvider[]

  constructor(supabaseClient?: any, redisClient?: any) {
    this.supabase = supabaseClient
    this.redis = redisClient
    this.initializeBlacklistProviders()
  }

  /**
   * Get comprehensive reputation score for domain
   */
  async getReputationScore(domain: string, ipAddress?: string): Promise<ReputationScore> {
    try {
      // Validate domain
      domainSchema.parse(domain)
      if (ipAddress) {
        ipSchema.parse(ipAddress)
      }

      // Get cached score if available and recent
      const cacheKey = `reputation:${domain}:${ipAddress || 'no-ip'}`
      const cached = await this.getCachedScore(cacheKey)
      if (cached) {
        return cached
      }

      // Calculate reputation factors
      const deliverabilityScore = await this.calculateDeliverabilityScore(domain)
      const bounceMetrics = await this.getBounceRateMetrics(domain, '30d')
      const complaintMetrics = await this.getComplaintMetrics(domain, '30d')
      const unsubscribeRate = await this.calculateUnsubscribeRate(domain)
      const engagementRate = await this.calculateEngagementRate(domain)
      const blacklistStatus = await this.checkBlacklistStatus(domain, ipAddress)
      const domainAge = await this.calculateDomainAge(domain)
      const volumeConsistency = await this.calculateVolumeConsistency(domain)

      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        deliverabilityScore * 0.25 +
        (100 - bounceMetrics.bounceRate * 100) * 0.20 +
        (100 - complaintMetrics.complaintRate * 1000) * 0.15 +
        (100 - unsubscribeRate * 100) * 0.10 +
        engagementRate * 0.15 +
        blacklistStatus * 0.10 +
        domainAge * 0.03 +
        volumeConsistency * 0.02
      )

      // Determine status
      const status = this.determineReputationStatus(overallScore)

      // Generate alerts
      const alerts = await this.generateReputationAlerts(domain, {
        bounceRate: bounceMetrics.bounceRate,
        complaintRate: complaintMetrics.complaintRate,
        unsubscribeRate,
        engagementRate,
        blacklistStatus,
        overallScore
      })

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        bounceRate: bounceMetrics.bounceRate,
        complaintRate: complaintMetrics.complaintRate,
        unsubscribeRate,
        engagementRate,
        blacklistStatus,
        overallScore
      })

      const reputationScore: ReputationScore = {
        domain,
        ipAddress,
        overallScore,
        lastUpdated: new Date().toISOString(),
        factors: {
          deliverabilityScore,
          bounceRate: bounceMetrics.bounceRate,
          complaintRate: complaintMetrics.complaintRate,
          unsubscribeRate,
          engagementRate,
          blacklistStatus,
          domainAge,
          volumeConsistency
        },
        status,
        alerts,
        recommendations
      }

      // Cache the result
      await this.cacheScore(cacheKey, reputationScore)

      // Store in database
      await this.storeReputationScore(reputationScore)

      return reputationScore

    } catch (error) {
      console.error('Error getting reputation score:', error)
      throw error
    }
  }

  /**
   * Check domain and IP against blacklists
   */
  async checkBlacklists(domain: string, ipAddress?: string): Promise<BlacklistCheck> {
    try {
      domainSchema.parse(domain)
      if (ipAddress) {
        ipSchema.parse(ipAddress)
      }

      const blacklists: BlacklistResult[] = []
      let overallStatus: 'clean' | 'listed' | 'unknown' = 'clean'

      // Check each blacklist provider
      for (const provider of this.blacklistProviders) {
        try {
          const result = await this.checkSingleBlacklist(provider, domain, ipAddress)
          blacklists.push(result)

          if (result.listed) {
            overallStatus = 'listed'
          }
        } catch (error) {
          console.error(`Error checking blacklist ${provider.name}:`, error)
          blacklists.push({
            name: provider.name,
            url: provider.url,
            listed: false,
            details: 'Check failed',
            severity: 'low',
            impact: 'Unable to verify status'
          })
          if (overallStatus === 'clean') {
            overallStatus = 'unknown'
          }
        }
      }

      const blacklistCheck: BlacklistCheck = {
        domain,
        ipAddress,
        blacklists,
        overallStatus,
        lastChecked: new Date().toISOString(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }

      // Store result
      await this.storeBlacklistCheck(blacklistCheck)

      return blacklistCheck

    } catch (error) {
      console.error('Error checking blacklists:', error)
      throw error
    }
  }

  /**
   * Get bounce rate metrics
   */
  async getBounceRateMetrics(domain: string, timeRange: string = '30d'): Promise<BounceRateMetrics> {
    try {
      const startDate = this.getStartDate(timeRange)

      // Get bounce statistics from database
      const { data: bounceStats, error } = await this.supabase
        .from('email_events')
        .select('type, event_data')
        .eq('type', 'bounced')
        .gte('timestamp', startDate)
        .like('recipient_email', `%@${domain}`)

      if (error) throw error

      // Get total sent emails
      const { data: sentStats, error: sentError } = await this.supabase
        .from('email_sends')
        .select('success')
        .gte('created_at', startDate)
        .like('recipient_email', `%@${domain}`)

      if (sentError) throw sentError

      const totalSent = sentStats?.length || 0
      const totalBounces = bounceStats?.length || 0
      const hardBounces = bounceStats?.filter(b => b.event_data?.bounceType === 'hard').length || 0
      const softBounces = bounceStats?.filter(b => b.event_data?.bounceType === 'soft').length || 0

      const bounceRate = totalSent > 0 ? totalBounces / totalSent : 0
      const hardBounceRate = totalSent > 0 ? hardBounces / totalSent : 0
      const softBounceRate = totalSent > 0 ? softBounces / totalSent : 0

      // Calculate trend (compare with previous period)
      const trend = await this.calculateBounceRateTrend(domain, timeRange)

      // Define thresholds
      const threshold = {
        warning: 0.05, // 5%
        critical: 0.10 // 10%
      }

      const status = bounceRate >= threshold.critical ? 'critical' :
                    bounceRate >= threshold.warning ? 'warning' : 'healthy'

      return {
        domain,
        timeRange,
        totalSent,
        totalBounces,
        hardBounces,
        softBounces,
        bounceRate,
        hardBounceRate,
        softBounceRate,
        trend,
        threshold,
        status
      }

    } catch (error) {
      console.error('Error getting bounce rate metrics:', error)
      throw error
    }
  }

  /**
   * Get complaint metrics
   */
  async getComplaintMetrics(domain: string, timeRange: string = '30d'): Promise<ComplaintMetrics> {
    try {
      const startDate = this.getStartDate(timeRange)

      // Get complaint statistics
      const { data: complaintStats, error } = await this.supabase
        .from('email_events')
        .select('type, event_data, provider_id')
        .eq('type', 'complained')
        .gte('timestamp', startDate)
        .like('recipient_email', `%@${domain}`)

      if (error) throw error

      // Get total sent emails
      const { data: sentStats, error: sentError } = await this.supabase
        .from('email_sends')
        .select('success')
        .gte('created_at', startDate)
        .like('recipient_email', `%@${domain}`)

      if (sentError) throw sentError

      const totalSent = sentStats?.length || 0
      const totalComplaints = complaintStats?.length || 0
      const complaintRate = totalSent > 0 ? totalComplaints / totalSent : 0

      // Group complaints by source
      const complaintSources = this.groupComplaintsBySource(complaintStats || [])

      // Calculate trend
      const trend = await this.calculateComplaintRateTrend(domain, timeRange)

      // Define thresholds
      const threshold = {
        warning: 0.001, // 0.1%
        critical: 0.003 // 0.3%
      }

      const status = complaintRate >= threshold.critical ? 'critical' :
                    complaintRate >= threshold.warning ? 'warning' : 'healthy'

      return {
        domain,
        timeRange,
        totalSent,
        totalComplaints,
        complaintRate,
        complaintSources,
        trend,
        threshold,
        status
      }

    } catch (error) {
      console.error('Error getting complaint metrics:', error)
      throw error
    }
  }

  /**
   * Perform automated list cleaning
   */
  async cleanEmailList(listId?: string): Promise<ListCleaningResult> {
    try {
      let query = this.supabase
        .from('contacts')
        .select('id, email, email_status, last_opened_at, last_clicked_at, created_at')

      if (listId) {
        query = query.eq('list_id', listId)
      }

      const { data: contacts, error } = await query

      if (error) throw error

      let totalProcessed = 0
      let cleaned = 0
      let bounced = 0
      let complained = 0
      let unsubscribed = 0
      let inactive = 0
      let duplicates = 0
      let invalid = 0

      const emailsSeen = new Set<string>()
      const contactsToClean: string[] = []

      for (const contact of contacts || []) {
        totalProcessed++

        // Check for duplicates
        if (emailsSeen.has(contact.email)) {
          duplicates++
          contactsToClean.push(contact.id)
          continue
        }
        emailsSeen.add(contact.email)

        // Check email validity
        if (!this.isValidEmail(contact.email)) {
          invalid++
          contactsToClean.push(contact.id)
          continue
        }

        // Check status-based cleaning
        switch (contact.email_status) {
          case 'bounced':
            bounced++
            contactsToClean.push(contact.id)
            break
          case 'complained':
            complained++
            contactsToClean.push(contact.id)
            break
          case 'unsubscribed':
            unsubscribed++
            contactsToClean.push(contact.id)
            break
          default:
            // Check for inactive contacts (no engagement in 6 months)
            const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
            const lastActivity = contact.last_opened_at || contact.last_clicked_at || contact.created_at
            
            if (new Date(lastActivity) < sixMonthsAgo) {
              inactive++
              contactsToClean.push(contact.id)
            }
            break
        }
      }

      cleaned = contactsToClean.length

      // Perform the cleaning (mark as inactive instead of deleting)
      if (contactsToClean.length > 0) {
        await this.supabase
          .from('contacts')
          .update({ is_active: false, cleaned_at: new Date().toISOString() })
          .in('id', contactsToClean)
      }

      // Generate recommendations
      const recommendations = this.generateCleaningRecommendations({
        totalProcessed,
        cleaned,
        bounced,
        complained,
        unsubscribed,
        inactive,
        duplicates,
        invalid
      })

      const result: ListCleaningResult = {
        totalProcessed,
        cleaned,
        bounced,
        complained,
        unsubscribed,
        inactive,
        duplicates,
        invalid,
        recommendations
      }

      // Store cleaning result
      await this.storeCleaningResult(result, listId)

      return result

    } catch (error) {
      console.error('Error cleaning email list:', error)
      throw error
    }
  }

  /**
   * Monitor reputation and send alerts
   */
  async monitorReputation(): Promise<void> {
    try {
      // Get all domains to monitor
      const { data: domains, error } = await this.supabase
        .from('email_accounts')
        .select('domain')
        .eq('is_active', true)

      if (error) throw error

      const uniqueDomains = Array.from(new Set(domains?.map(d => d.domain) || []))

      for (const domain of uniqueDomains) {
        try {
          // Get reputation score
          const reputation = await this.getReputationScore(domain as string)

          // Check for critical alerts
          const criticalAlerts = reputation.alerts.filter(a => a.severity === 'critical')
          
          if (criticalAlerts.length > 0) {
            await this.sendReputationAlert(domain as string, criticalAlerts)
          }

          // Check blacklists
          await this.checkBlacklists(domain as string)

        } catch (error) {
          console.error(`Error monitoring reputation for ${domain}:`, error)
        }
      }

    } catch (error) {
      console.error('Error in reputation monitoring:', error)
    }
  }

  // Private helper methods

  private initializeBlacklistProviders(): void {
    this.blacklistProviders = [
      {
        name: 'Spamhaus SBL',
        url: 'https://www.spamhaus.org/sbl/',
        dnsQuery: 'sbl.spamhaus.org',
        type: 'ip',
        severity: 'high',
        impact: 'Major ISPs block emails'
      },
      {
        name: 'Spamhaus CSS',
        url: 'https://www.spamhaus.org/css/',
        dnsQuery: 'css.spamhaus.org',
        type: 'ip',
        severity: 'high',
        impact: 'Major ISPs block emails'
      },
      {
        name: 'Spamhaus DBL',
        url: 'https://www.spamhaus.org/dbl/',
        dnsQuery: 'dbl.spamhaus.org',
        type: 'domain',
        severity: 'high',
        impact: 'Domain reputation damage'
      },
      {
        name: 'Barracuda',
        url: 'http://www.barracudacentral.org/rbl',
        dnsQuery: 'b.barracudacentral.org',
        type: 'ip',
        severity: 'medium',
        impact: 'Some ISPs may block'
      },
      {
        name: 'SURBL',
        url: 'http://www.surbl.org/',
        dnsQuery: 'multi.surbl.org',
        type: 'domain',
        severity: 'medium',
        impact: 'URL reputation issues'
      }
    ]
  }

  private async getCachedScore(cacheKey: string): Promise<ReputationScore | null> {
    try {
      if (!this.redis) return null

      const cached = await this.redis.get(cacheKey)
      if (!cached) return null

      const score = JSON.parse(cached)
      
      // Check if cache is still valid (1 hour)
      const cacheAge = Date.now() - new Date(score.lastUpdated).getTime()
      if (cacheAge > 60 * 60 * 1000) {
        await this.redis.del(cacheKey)
        return null
      }

      return score
    } catch (error) {
      console.error('Error getting cached score:', error)
      return null
    }
  }

  private async cacheScore(cacheKey: string, score: ReputationScore): Promise<void> {
    try {
      if (!this.redis) return

      await this.redis.setex(cacheKey, 3600, JSON.stringify(score)) // 1 hour cache
    } catch (error) {
      console.error('Error caching score:', error)
    }
  }

  private async calculateDeliverabilityScore(domain: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Get delivery statistics
      const { data: stats, error } = await this.supabase
        .from('email_sends')
        .select('success')
        .gte('created_at', thirtyDaysAgo)
        .like('recipient_email', `%@${domain}`)

      if (error) throw error

      const total = stats?.length || 0
      const successful = stats?.filter(s => s.success).length || 0

      return total > 0 ? (successful / total) * 100 : 85 // Default to 85 if no data
    } catch (error) {
      console.error('Error calculating deliverability score:', error)
      return 85
    }
  }

  private async calculateUnsubscribeRate(domain: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: sent, error: sentError } = await this.supabase
        .from('email_sends')
        .select('id')
        .gte('created_at', thirtyDaysAgo)
        .like('recipient_email', `%@${domain}`)

      if (sentError) throw sentError

      const { data: unsubscribes, error: unsubError } = await this.supabase
        .from('email_events')
        .select('id')
        .eq('type', 'unsubscribed')
        .gte('timestamp', thirtyDaysAgo)
        .like('recipient_email', `%@${domain}`)

      if (unsubError) throw unsubError

      const totalSent = sent?.length || 0
      const totalUnsubscribes = unsubscribes?.length || 0

      return totalSent > 0 ? totalUnsubscribes / totalSent : 0
    } catch (error) {
      console.error('Error calculating unsubscribe rate:', error)
      return 0
    }
  }

  private async calculateEngagementRate(domain: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: sent, error: sentError } = await this.supabase
        .from('email_sends')
        .select('id')
        .gte('created_at', thirtyDaysAgo)
        .like('recipient_email', `%@${domain}`)

      if (sentError) throw sentError

      const { data: engagements, error: engageError } = await this.supabase
        .from('email_events')
        .select('id')
        .in('type', ['opened', 'clicked', 'replied'])
        .gte('timestamp', thirtyDaysAgo)
        .like('recipient_email', `%@${domain}`)

      if (engageError) throw engageError

      const totalSent = sent?.length || 0
      const totalEngagements = engagements?.length || 0

      return totalSent > 0 ? (totalEngagements / totalSent) * 100 : 0
    } catch (error) {
      console.error('Error calculating engagement rate:', error)
      return 0
    }
  }

  private async checkBlacklistStatus(domain: string, ipAddress?: string): Promise<number> {
    try {
      const blacklistCheck = await this.checkBlacklists(domain, ipAddress)
      
      if (blacklistCheck.overallStatus === 'clean') {
        return 100
      } else if (blacklistCheck.overallStatus === 'listed') {
        // Calculate severity impact
        const highSeverityLists = blacklistCheck.blacklists.filter(b => b.listed && b.severity === 'high').length
        const mediumSeverityLists = blacklistCheck.blacklists.filter(b => b.listed && b.severity === 'medium').length
        
        let score = 100
        score -= highSeverityLists * 40
        score -= mediumSeverityLists * 20
        
        return Math.max(score, 0)
      } else {
        return 70 // Unknown status
      }
    } catch (error) {
      console.error('Error checking blacklist status:', error)
      return 70
    }
  }

  private async calculateDomainAge(domain: string): Promise<number> {
    // Simplified domain age calculation
    // In a real implementation, you would query WHOIS data
    return 80 // Default score
  }

  private async calculateVolumeConsistency(domain: string): Promise<number> {
    try {
      // Calculate volume consistency over the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const dailyVolumes: number[] = []

      for (let i = 0; i < 30; i++) {
        const dayStart = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000)
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

        const { data: dayStats, error } = await this.supabase
          .from('email_sends')
          .select('id')
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString())
          .like('recipient_email', `%@${domain}`)

        if (error) throw error

        dailyVolumes.push(dayStats?.length || 0)
      }

      // Calculate coefficient of variation (lower is more consistent)
      const mean = dailyVolumes.reduce((sum, vol) => sum + vol, 0) / dailyVolumes.length
      const variance = dailyVolumes.reduce((sum, vol) => sum + Math.pow(vol - mean, 2), 0) / dailyVolumes.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = mean > 0 ? stdDev / mean : 0

      // Convert to score (0-100, higher is better)
      return Math.max(0, 100 - coefficientOfVariation * 100)
    } catch (error) {
      console.error('Error calculating volume consistency:', error)
      return 80
    }
  }

  private determineReputationStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 90) return 'excellent'
    if (score >= 75) return 'good'
    if (score >= 60) return 'fair'
    if (score >= 40) return 'poor'
    return 'critical'
  }

  private async generateReputationAlerts(domain: string, metrics: any): Promise<ReputationAlert[]> {
    const alerts: ReputationAlert[] = []

    // Bounce rate alerts
    if (metrics.bounceRate > 0.10) {
      alerts.push({
        id: `bounce-${domain}-${Date.now()}`,
        type: 'bounce_rate',
        severity: 'critical',
        message: `Critical bounce rate: ${(metrics.bounceRate * 100).toFixed(2)}%`,
        details: 'Bounce rate exceeds 10%, immediate action required',
        timestamp: new Date().toISOString(),
        resolved: false,
        actions: [
          'Review and clean email list',
          'Check email content for spam triggers',
          'Verify domain authentication'
        ]
      })
    } else if (metrics.bounceRate > 0.05) {
      alerts.push({
        id: `bounce-${domain}-${Date.now()}`,
        type: 'bounce_rate',
        severity: 'high',
        message: `High bounce rate: ${(metrics.bounceRate * 100).toFixed(2)}%`,
        details: 'Bounce rate exceeds 5%, action recommended',
        timestamp: new Date().toISOString(),
        resolved: false,
        actions: [
          'Clean email list',
          'Review email content'
        ]
      })
    }

    // Complaint rate alerts
    if (metrics.complaintRate > 0.003) {
      alerts.push({
        id: `complaint-${domain}-${Date.now()}`,
        type: 'complaint_rate',
        severity: 'critical',
        message: `Critical complaint rate: ${(metrics.complaintRate * 100).toFixed(3)}%`,
        details: 'Complaint rate exceeds 0.3%, immediate action required',
        timestamp: new Date().toISOString(),
        resolved: false,
        actions: [
          'Review email content and targeting',
          'Implement double opt-in',
          'Improve unsubscribe process'
        ]
      })
    }

    // Blacklist alerts
    if (metrics.blacklistStatus < 80) {
      alerts.push({
        id: `blacklist-${domain}-${Date.now()}`,
        type: 'blacklist',
        severity: 'high',
        message: 'Domain or IP found on blacklists',
        details: 'Blacklist status affecting deliverability',
        timestamp: new Date().toISOString(),
        resolved: false,
        actions: [
          'Request delisting from blacklists',
          'Review sending practices',
          'Monitor reputation closely'
        ]
      })
    }

    return alerts
  }

  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = []

    if (metrics.bounceRate > 0.05) {
      recommendations.push('Implement regular list cleaning to remove bounced addresses')
    }

    if (metrics.complaintRate > 0.001) {
      recommendations.push('Review email content and improve targeting to reduce complaints')
    }

    if (metrics.engagementRate < 20) {
      recommendations.push('Improve email content and personalization to increase engagement')
    }

    if (metrics.blacklistStatus < 90) {
      recommendations.push('Monitor blacklist status and request delisting if necessary')
    }

    if (metrics.overallScore < 70) {
      recommendations.push('Consider implementing a dedicated IP warming strategy')
    }

    return recommendations
  }

  private async checkSingleBlacklist(
    provider: BlacklistProvider,
    domain: string,
    ipAddress?: string
  ): Promise<BlacklistResult> {
    // Simplified blacklist check - in production, you would use DNS queries
    // For now, return mock results
    const isListed = Math.random() < 0.1 // 10% chance of being listed

    return {
      name: provider.name,
      url: provider.url,
      listed: isListed,
      details: isListed ? 'Listed on blacklist' : 'Not listed',
      severity: provider.severity as 'low' | 'medium' | 'high',
      impact: provider.impact
    }
  }

  private getStartDate(timeRange: string): string {
    const now = new Date()
    switch (timeRange) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  private async calculateBounceRateTrend(domain: string, timeRange: string): Promise<'improving' | 'stable' | 'declining'> {
    // Simplified trend calculation
    return 'stable'
  }

  private async calculateComplaintRateTrend(domain: string, timeRange: string): Promise<'improving' | 'stable' | 'declining'> {
    // Simplified trend calculation
    return 'stable'
  }

  private groupComplaintsBySource(complaints: any[]): Array<{ source: string; count: number; rate: number }> {
    const sources: Record<string, number> = {}
    
    for (const complaint of complaints) {
      const source = complaint.provider_id || 'unknown'
      sources[source] = (sources[source] || 0) + 1
    }

    const total = complaints.length
    return Object.entries(sources).map(([source, count]) => ({
      source,
      count,
      rate: total > 0 ? count / total : 0
    }))
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  private generateCleaningRecommendations(stats: any): string[] {
    const recommendations: string[] = []

    if (stats.bounced > 0) {
      recommendations.push(`Removed ${stats.bounced} bounced addresses to improve deliverability`)
    }

    if (stats.complained > 0) {
      recommendations.push(`Removed ${stats.complained} addresses that filed complaints`)
    }

    if (stats.inactive > 0) {
      recommendations.push(`Removed ${stats.inactive} inactive contacts (no engagement in 6+ months)`)
    }

    if (stats.duplicates > 0) {
      recommendations.push(`Removed ${stats.duplicates} duplicate email addresses`)
    }

    if (stats.invalid > 0) {
      recommendations.push(`Removed ${stats.invalid} invalid email addresses`)
    }

    const cleaningRate = stats.totalProcessed > 0 ? (stats.cleaned / stats.totalProcessed) * 100 : 0
    
    if (cleaningRate > 20) {
      recommendations.push('Consider implementing double opt-in to improve list quality')
    }

    if (cleaningRate > 10) {
      recommendations.push('Schedule regular list cleaning (monthly recommended)')
    }

    return recommendations
  }

  private async storeReputationScore(score: ReputationScore): Promise<void> {
    try {
      await this.supabase
        .from('reputation_scores')
        .upsert({
          domain: score.domain,
          ip_address: score.ipAddress,
          overall_score: score.overallScore,
          factors: score.factors,
          status: score.status,
          alerts: score.alerts,
          recommendations: score.recommendations,
          last_updated: score.lastUpdated
        })
    } catch (error) {
      console.error('Error storing reputation score:', error)
    }
  }

  private async storeBlacklistCheck(check: BlacklistCheck): Promise<void> {
    try {
      await this.supabase
        .from('blacklist_checks')
        .upsert({
          domain: check.domain,
          ip_address: check.ipAddress,
          blacklists: check.blacklists,
          overall_status: check.overallStatus,
          last_checked: check.lastChecked,
          next_check: check.nextCheck
        })
    } catch (error) {
      console.error('Error storing blacklist check:', error)
    }
  }

  private async storeCleaningResult(result: ListCleaningResult, listId?: string): Promise<void> {
    try {
      await this.supabase
        .from('list_cleaning_results')
        .insert({
          list_id: listId,
          total_processed: result.totalProcessed,
          cleaned: result.cleaned,
          bounced: result.bounced,
          complained: result.complained,
          unsubscribed: result.unsubscribed,
          inactive: result.inactive,
          duplicates: result.duplicates,
          invalid: result.invalid,
          recommendations: result.recommendations,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error storing cleaning result:', error)
    }
  }

  private async sendReputationAlert(domain: string, alerts: ReputationAlert[]): Promise<void> {
    try {
      // In a real implementation, this would send notifications via email, Slack, etc.
      console.log(`REPUTATION ALERT for ${domain}:`, alerts)
      
      // Store alerts in database for dashboard display
      for (const alert of alerts) {
        await this.supabase
          .from('reputation_alerts')
          .insert({
            domain,
            alert_type: alert.type,
            severity: alert.severity,
            message: alert.message,
            details: alert.details,
            actions: alert.actions,
            created_at: alert.timestamp
          })
      }
    } catch (error) {
      console.error('Error sending reputation alert:', error)
    }
  }
}

// Blacklist provider interface
interface BlacklistProvider {
  name: string
  url: string
  dnsQuery: string
  type: 'ip' | 'domain'
  severity: string
  impact: string
}

// Export default instance
export const reputationMonitor = new ReputationMonitor()