import { z } from 'zod'

// Analytics interfaces
export interface CampaignAnalytics {
  campaignId: string
  campaignName: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  dateRange: {
    startDate: string
    endDate: string
  }
  metrics: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    replied: number
    bounced: number
    unsubscribed: number
    complained: number
  }
  rates: {
    deliveryRate: number
    openRate: number
    clickRate: number
    replyRate: number
    bounceRate: number
    unsubscribeRate: number
    complaintRate: number
  }
  engagement: {
    score: number
    trend: 'up' | 'down' | 'stable'
    topPerformingEmails: Array<{
      emailId: string
      subject: string
      openRate: number
      clickRate: number
    }>
  }
  abTests: Array<{
    testId: string
    variant: string
    performance: number
    isWinner: boolean
  }>
  revenue: {
    attributed: number
    conversions: number
    conversionRate: number
  }
}

export interface ContactAnalytics {
  contactId: string
  email: string
  engagementScore: number
  lifecycle: {
    firstContact: string
    lastActivity: string
    totalEmails: number
    totalOpens: number
    totalClicks: number
    totalReplies: number
  }
  behavior: {
    avgTimeToOpen: number // in minutes
    avgTimeToClick: number // in minutes
    preferredSendTime: string
    deviceTypes: Array<{
      type: string
      percentage: number
    }>
  }
  segmentation: {
    tags: string[]
    lists: string[]
    customFields: Record<string, any>
  }
  predictive: {
    churnRisk: number // 0-1
    conversionProbability: number // 0-1
    nextBestAction: string
  }
}

export interface DomainAnalytics {
  domain: string
  reputation: {
    score: number
    trend: 'improving' | 'stable' | 'declining'
    factors: Record<string, number>
  }
  performance: {
    deliveryRate: number
    openRate: number
    clickRate: number
    bounceRate: number
    complaintRate: number
  }
  volume: {
    dailyAverage: number
    weeklyTrend: number[]
    monthlyTotal: number
  }
  issues: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    description: string
    recommendation: string
  }>
}

export interface TimeSeriesData {
  timestamp: string
  metrics: Record<string, number>
}

export interface AnalyticsReport {
  id: string
  type: 'campaign' | 'contact' | 'domain' | 'overview'
  title: string
  description: string
  dateRange: {
    startDate: string
    endDate: string
  }
  data: any
  charts: Array<{
    type: 'line' | 'bar' | 'pie' | 'area'
    title: string
    data: any
    config: Record<string, any>
  }>
  insights: string[]
  recommendations: string[]
  createdAt: string
  format: 'json' | 'csv' | 'pdf'
}

export interface EngagementTrend {
  period: string
  opens: number
  clicks: number
  replies: number
  unsubscribes: number
  bounces: number
  engagementScore: number
}

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
})

const analyticsQuerySchema = z.object({
  campaignIds: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
  domains: z.array(z.string()).optional(),
  dateRange: dateRangeSchema,
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  metrics: z.array(z.string()).optional()
})

/**
 * Analytics data collection and processing system
 */
export class Analytics {
  private supabase: any
  private redis: any

  constructor(supabaseClient?: any, redisClient?: any) {
    this.supabase = supabaseClient
    this.redis = redisClient
  }

  /**
   * Get comprehensive campaign analytics
   */
  async getCampaignAnalytics(
    campaignId: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<CampaignAnalytics> {
    try {
      // Get campaign details
      const { data: campaign, error: campaignError } = await this.supabase
        .from('campaigns')
        .select('id, name, status, created_at')
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign) {
        throw new Error('Campaign not found')
      }

      // Set default date range if not provided
      const range = dateRange || {
        startDate: campaign.created_at,
        endDate: new Date().toISOString()
      }

      // Get email sends for the campaign
      const { data: sends, error: sendsError } = await this.supabase
        .from('email_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .gte('created_at', range.startDate)
        .lte('created_at', range.endDate)

      if (sendsError) throw sendsError

      // Get email events for the campaign
      const { data: events, error: eventsError } = await this.supabase
        .from('email_events')
        .select('*')
        .eq('campaign_id', campaignId)
        .gte('timestamp', range.startDate)
        .lte('timestamp', range.endDate)

      if (eventsError) throw eventsError

      // Calculate basic metrics
      const metrics = this.calculateCampaignMetrics(sends || [], events || [])
      const rates = this.calculateCampaignRates(metrics)

      // Calculate engagement score and trend
      const engagement = await this.calculateEngagementMetrics(campaignId, range)

      // Get A/B test results
      const abTests = await this.getABTestResults(campaignId)

      // Calculate revenue attribution (simplified)
      const revenue = await this.calculateRevenueAttribution(campaignId, range)

      return {
        campaignId,
        campaignName: campaign.name,
        status: campaign.status,
        dateRange: range,
        metrics,
        rates,
        engagement,
        abTests,
        revenue
      }

    } catch (error) {
      console.error('Error getting campaign analytics:', error)
      throw error
    }
  }

  /**
   * Get contact analytics and engagement data
   */
  async getContactAnalytics(contactId: string): Promise<ContactAnalytics> {
    try {
      // Get contact details
      const { data: contact, error: contactError } = await this.supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single()

      if (contactError || !contact) {
        throw new Error('Contact not found')
      }

      // Get contact's email history
      const { data: sends, error: sendsError } = await this.supabase
        .from('email_sends')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true })

      if (sendsError) throw sendsError

      // Get contact's engagement events
      const { data: events, error: eventsError } = await this.supabase
        .from('email_events')
        .select('*')
        .eq('contact_id', contactId)
        .order('timestamp', { ascending: true })

      if (eventsError) throw eventsError

      // Calculate lifecycle metrics
      const lifecycle = this.calculateContactLifecycle(sends || [], events || [])

      // Calculate behavior patterns
      const behavior = this.calculateContactBehavior(events || [])

      // Get segmentation data
      const segmentation = {
        tags: contact.tags || [],
        lists: [contact.list_id].filter(Boolean),
        customFields: contact.custom_fields || {}
      }

      // Calculate engagement score
      const engagementScore = this.calculateContactEngagementScore(lifecycle, behavior)

      // Calculate predictive metrics
      const predictive = this.calculatePredictiveMetrics(lifecycle, behavior, engagementScore)

      return {
        contactId,
        email: contact.email,
        engagementScore,
        lifecycle,
        behavior,
        segmentation,
        predictive
      }

    } catch (error) {
      console.error('Error getting contact analytics:', error)
      throw error
    }
  }

  /**
   * Get domain performance analytics
   */
  async getDomainAnalytics(domain: string): Promise<DomainAnalytics> {
    try {
      // Get reputation data
      const { data: reputation, error: repError } = await this.supabase
        .from('reputation_scores')
        .select('*')
        .eq('domain', domain)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()

      // Get performance metrics for the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: sends, error: sendsError } = await this.supabase
        .from('email_sends')
        .select('*')
        .like('recipient_email', `%@${domain}`)
        .gte('created_at', thirtyDaysAgo)

      if (sendsError) throw sendsError

      const { data: events, error: eventsError } = await this.supabase
        .from('email_events')
        .select('*')
        .like('recipient_email', `%@${domain}`)
        .gte('timestamp', thirtyDaysAgo)

      if (eventsError) throw eventsError

      // Calculate performance metrics
      const performance = this.calculateDomainPerformance(sends || [], events || [])

      // Calculate volume metrics
      const volume = this.calculateDomainVolume(sends || [])

      // Get reputation trend
      const trend = await this.calculateReputationTrend(domain)

      // Identify issues
      const issues = this.identifyDomainIssues(performance, reputation?.factors || {})

      return {
        domain,
        reputation: {
          score: reputation?.overall_score || 0,
          trend,
          factors: reputation?.factors || {}
        },
        performance,
        volume,
        issues
      }

    } catch (error) {
      console.error('Error getting domain analytics:', error)
      throw error
    }
  }

  /**
   * Get time series data for metrics
   */
  async getTimeSeriesData(
    query: {
      campaignIds?: string[]
      contactIds?: string[]
      domains?: string[]
      dateRange: { startDate: string; endDate: string }
      groupBy?: 'day' | 'week' | 'month'
      metrics?: string[]
    }
  ): Promise<TimeSeriesData[]> {
    try {
      // Validate query
      const validatedQuery = analyticsQuerySchema.parse(query)

      const timeSeriesData: TimeSeriesData[] = []
      const { startDate, endDate } = validatedQuery.dateRange
      const groupBy = validatedQuery.groupBy

      // Generate time periods
      const periods = this.generateTimePeriods(startDate, endDate, groupBy)

      for (const period of periods) {
        const periodStart = period.start
        const periodEnd = period.end

        // Build query conditions
        let sendsQuery = this.supabase
          .from('email_sends')
          .select('*')
          .gte('created_at', periodStart)
          .lt('created_at', periodEnd)

        let eventsQuery = this.supabase
          .from('email_events')
          .select('*')
          .gte('timestamp', periodStart)
          .lt('timestamp', periodEnd)

        // Apply filters
        if (validatedQuery.campaignIds?.length) {
          sendsQuery = sendsQuery.in('campaign_id', validatedQuery.campaignIds)
          eventsQuery = eventsQuery.in('campaign_id', validatedQuery.campaignIds)
        }

        if (validatedQuery.contactIds?.length) {
          sendsQuery = sendsQuery.in('contact_id', validatedQuery.contactIds)
          eventsQuery = eventsQuery.in('contact_id', validatedQuery.contactIds)
        }

        if (validatedQuery.domains?.length) {
          const domainFilters = validatedQuery.domains.map(d => `%@${d}`)
          // Note: This is a simplified approach - in production you'd use a more efficient query
          sendsQuery = sendsQuery.or(domainFilters.map(f => `recipient_email.like.${f}`).join(','))
          eventsQuery = eventsQuery.or(domainFilters.map(f => `recipient_email.like.${f}`).join(','))
        }

        // Execute queries
        const [{ data: sends }, { data: events }] = await Promise.all([
          sendsQuery,
          eventsQuery
        ])

        // Calculate metrics for this period
        const metrics = this.calculatePeriodMetrics(sends || [], events || [], validatedQuery.metrics)

        timeSeriesData.push({
          timestamp: period.start,
          metrics
        })
      }

      return timeSeriesData

    } catch (error) {
      console.error('Error getting time series data:', error)
      throw error
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(
    type: 'campaign' | 'contact' | 'domain' | 'overview',
    options: {
      id?: string
      dateRange: { startDate: string; endDate: string }
      format?: 'json' | 'csv' | 'pdf'
      includeCharts?: boolean
    }
  ): Promise<AnalyticsReport> {
    try {
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const format = options.format || 'json'

      let data: any
      let charts: any[] = []
      let insights: string[] = []
      let recommendations: string[] = []

      switch (type) {
        case 'campaign':
          if (!options.id) throw new Error('Campaign ID required for campaign report')
          data = await this.getCampaignAnalytics(options.id, options.dateRange)
          charts = this.generateCampaignCharts(data)
          insights = this.generateCampaignInsights(data)
          recommendations = this.generateCampaignRecommendations(data)
          break

        case 'contact':
          if (!options.id) throw new Error('Contact ID required for contact report')
          data = await this.getContactAnalytics(options.id)
          charts = this.generateContactCharts(data)
          insights = this.generateContactInsights(data)
          recommendations = this.generateContactRecommendations(data)
          break

        case 'domain':
          if (!options.id) throw new Error('Domain required for domain report')
          data = await this.getDomainAnalytics(options.id)
          charts = this.generateDomainCharts(data)
          insights = this.generateDomainInsights(data)
          recommendations = this.generateDomainRecommendations(data)
          break

        case 'overview':
          data = await this.getOverviewAnalytics(options.dateRange)
          charts = this.generateOverviewCharts(data)
          insights = this.generateOverviewInsights(data)
          recommendations = this.generateOverviewRecommendations(data)
          break
      }

      const report: AnalyticsReport = {
        id: reportId,
        type,
        title: this.getReportTitle(type, options.id),
        description: this.getReportDescription(type, options.dateRange),
        dateRange: options.dateRange,
        data,
        charts: options.includeCharts !== false ? charts : [],
        insights,
        recommendations,
        createdAt: new Date().toISOString(),
        format
      }

      // Store report
      await this.storeReport(report)

      // Export in requested format
      if (format === 'csv') {
        await this.exportToCSV(report)
      } else if (format === 'pdf') {
        await this.exportToPDF(report)
      }

      return report

    } catch (error) {
      console.error('Error generating report:', error)
      throw error
    }
  }

  /**
   * Calculate real-time metrics
   */
  async getRealTimeMetrics(): Promise<{
    emailsSentToday: number
    emailsSentThisHour: number
    currentOpenRate: number
    currentClickRate: number
    activeCampaigns: number
    topPerformingCampaign: {
      id: string
      name: string
      openRate: number
    } | null
    recentActivity: Array<{
      type: string
      description: string
      timestamp: string
    }>
  }> {
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const hourStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

      // Get emails sent today and this hour
      const [
        { data: todaySends },
        { data: hourSends },
        { data: todayEvents },
        { data: activeCampaigns }
      ] = await Promise.all([
        this.supabase
          .from('email_sends')
          .select('id')
          .gte('created_at', todayStart),
        this.supabase
          .from('email_sends')
          .select('id')
          .gte('created_at', hourStart),
        this.supabase
          .from('email_events')
          .select('type')
          .gte('timestamp', todayStart),
        this.supabase
          .from('campaigns')
          .select('id, name')
          .eq('status', 'active')
      ])

      // Calculate current rates
      const emailsSentToday = todaySends?.length || 0
      const opens = todayEvents?.filter(e => e.type === 'opened').length || 0
      const clicks = todayEvents?.filter(e => e.type === 'clicked').length || 0

      const currentOpenRate = emailsSentToday > 0 ? opens / emailsSentToday : 0
      const currentClickRate = emailsSentToday > 0 ? clicks / emailsSentToday : 0

      // Get top performing campaign
      const topPerformingCampaign = await this.getTopPerformingCampaign()

      // Get recent activity
      const recentActivity = await this.getRecentActivity()

      return {
        emailsSentToday,
        emailsSentThisHour: hourSends?.length || 0,
        currentOpenRate,
        currentClickRate,
        activeCampaigns: activeCampaigns?.length || 0,
        topPerformingCampaign,
        recentActivity
      }

    } catch (error) {
      console.error('Error getting real-time metrics:', error)
      throw error
    }
  }

  // Private helper methods

  private calculateCampaignMetrics(sends: any[], events: any[]) {
    const sent = sends.length
    const delivered = sends.filter(s => s.success).length
    const opened = events.filter(e => e.type === 'opened').length
    const clicked = events.filter(e => e.type === 'clicked').length
    const replied = events.filter(e => e.type === 'replied').length
    const bounced = events.filter(e => e.type === 'bounced').length
    const unsubscribed = events.filter(e => e.type === 'unsubscribed').length
    const complained = events.filter(e => e.type === 'complained').length

    return {
      sent,
      delivered,
      opened,
      clicked,
      replied,
      bounced,
      unsubscribed,
      complained
    }
  }

  private calculateCampaignRates(metrics: any) {
    const { sent, delivered, opened, clicked, replied, bounced, unsubscribed, complained } = metrics

    return {
      deliveryRate: sent > 0 ? delivered / sent : 0,
      openRate: delivered > 0 ? opened / delivered : 0,
      clickRate: delivered > 0 ? clicked / delivered : 0,
      replyRate: delivered > 0 ? replied / delivered : 0,
      bounceRate: sent > 0 ? bounced / sent : 0,
      unsubscribeRate: sent > 0 ? unsubscribed / sent : 0,
      complaintRate: sent > 0 ? complained / sent : 0
    }
  }

  private async calculateEngagementMetrics(campaignId: string, dateRange: any) {
    // Get historical data for trend calculation
    const previousPeriod = {
      startDate: new Date(new Date(dateRange.startDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: dateRange.startDate
    }

    const [currentData, previousData] = await Promise.all([
      this.getCampaignBasicMetrics(campaignId, dateRange),
      this.getCampaignBasicMetrics(campaignId, previousPeriod)
    ])

    // Calculate engagement score (weighted average of open and click rates)
    const score = (currentData.openRate * 0.6 + currentData.clickRate * 0.4) * 100

    // Determine trend
    const previousScore = (previousData.openRate * 0.6 + previousData.clickRate * 0.4) * 100
    let trend: 'up' | 'down' | 'stable' = 'stable'
    
    if (score > previousScore * 1.05) trend = 'up'
    else if (score < previousScore * 0.95) trend = 'down'

    // Get top performing emails
    const topPerformingEmails = await this.getTopPerformingEmails(campaignId)

    return {
      score: Math.round(score),
      trend,
      topPerformingEmails
    }
  }

  private async getCampaignBasicMetrics(campaignId: string, dateRange: any) {
    const { data: sends } = await this.supabase
      .from('email_sends')
      .select('success')
      .eq('campaign_id', campaignId)
      .gte('created_at', dateRange.startDate)
      .lte('created_at', dateRange.endDate)

    const { data: events } = await this.supabase
      .from('email_events')
      .select('type')
      .eq('campaign_id', campaignId)
      .gte('timestamp', dateRange.startDate)
      .lte('timestamp', dateRange.endDate)

    const delivered = sends?.filter(s => s.success).length || 0
    const opened = events?.filter(e => e.type === 'opened').length || 0
    const clicked = events?.filter(e => e.type === 'clicked').length || 0

    return {
      openRate: delivered > 0 ? opened / delivered : 0,
      clickRate: delivered > 0 ? clicked / delivered : 0
    }
  }

  private async getTopPerformingEmails(campaignId: string) {
    // Simplified implementation - in production you'd have email-level tracking
    return [
      {
        emailId: 'email_1',
        subject: 'Welcome to our newsletter',
        openRate: 0.45,
        clickRate: 0.12
      }
    ]
  }

  private async getABTestResults(campaignId: string) {
    const { data: abTests } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('campaign_id', campaignId)

    return (abTests || []).map(test => ({
      testId: test.id,
      variant: test.variant_name,
      performance: test.performance_score,
      isWinner: test.is_winner
    }))
  }

  private async calculateRevenueAttribution(campaignId: string, dateRange: any) {
    // Simplified revenue attribution
    return {
      attributed: 0,
      conversions: 0,
      conversionRate: 0
    }
  }

  private calculateContactLifecycle(sends: any[], events: any[]) {
    const firstContact = sends.length > 0 ? sends[0].created_at : null
    const lastActivity = events.length > 0 ? events[events.length - 1].timestamp : null

    return {
      firstContact,
      lastActivity,
      totalEmails: sends.length,
      totalOpens: events.filter(e => e.type === 'opened').length,
      totalClicks: events.filter(e => e.type === 'clicked').length,
      totalReplies: events.filter(e => e.type === 'replied').length
    }
  }

  private calculateContactBehavior(events: any[]) {
    // Calculate average time to open and click
    const openEvents = events.filter(e => e.type === 'opened')
    const clickEvents = events.filter(e => e.type === 'clicked')

    // Simplified calculation - in production you'd track send times
    const avgTimeToOpen = 60 // minutes
    const avgTimeToClick = 120 // minutes

    return {
      avgTimeToOpen,
      avgTimeToClick,
      preferredSendTime: '09:00',
      deviceTypes: [
        { type: 'desktop', percentage: 60 },
        { type: 'mobile', percentage: 35 },
        { type: 'tablet', percentage: 5 }
      ]
    }
  }

  private calculateContactEngagementScore(lifecycle: any, behavior: any): number {
    const { totalEmails, totalOpens, totalClicks, totalReplies } = lifecycle

    if (totalEmails === 0) return 0

    const openRate = totalOpens / totalEmails
    const clickRate = totalClicks / totalEmails
    const replyRate = totalReplies / totalEmails

    // Weighted engagement score
    return Math.round((openRate * 30 + clickRate * 50 + replyRate * 20) * 100)
  }

  private calculatePredictiveMetrics(lifecycle: any, behavior: any, engagementScore: number) {
    // Simplified predictive metrics
    const churnRisk = engagementScore < 20 ? 0.8 : engagementScore < 50 ? 0.4 : 0.1
    const conversionProbability = engagementScore > 70 ? 0.3 : engagementScore > 40 ? 0.15 : 0.05

    let nextBestAction = 'Continue regular engagement'
    if (churnRisk > 0.6) nextBestAction = 'Send re-engagement campaign'
    else if (conversionProbability > 0.2) nextBestAction = 'Send conversion-focused content'

    return {
      churnRisk,
      conversionProbability,
      nextBestAction
    }
  }

  private calculateDomainPerformance(sends: any[], events: any[]) {
    const metrics = this.calculateCampaignMetrics(sends, events)
    return this.calculateCampaignRates(metrics)
  }

  private calculateDomainVolume(sends: any[]) {
    const dailyAverage = sends.length / 30 // Last 30 days
    const weeklyTrend = [0, 0, 0, 0] // Simplified
    const monthlyTotal = sends.length

    return {
      dailyAverage,
      weeklyTrend,
      monthlyTotal
    }
  }

  private async calculateReputationTrend(domain: string): Promise<'improving' | 'stable' | 'declining'> {
    // Simplified trend calculation
    return 'stable'
  }

  private identifyDomainIssues(performance: any, factors: any) {
    const issues = []

    if (performance.bounceRate > 0.05) {
      issues.push({
        type: 'bounce_rate',
        severity: 'high' as const,
        description: 'High bounce rate detected',
        recommendation: 'Clean email list and verify addresses'
      })
    }

    if (performance.complaintRate > 0.001) {
      issues.push({
        type: 'complaint_rate',
        severity: 'medium' as const,
        description: 'Elevated complaint rate',
        recommendation: 'Review email content and targeting'
      })
    }

    return issues
  }

  private generateTimePeriods(startDate: string, endDate: string, groupBy: string) {
    const periods = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    let current = new Date(start)
    while (current < end) {
      const periodStart = new Date(current)
      let periodEnd: Date

      switch (groupBy) {
        case 'day':
          periodEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000)
          break
        case 'week':
          periodEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate())
          break
        default:
          periodEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000)
      }

      if (periodEnd > end) periodEnd = end

      periods.push({
        start: periodStart.toISOString(),
        end: periodEnd.toISOString()
      })

      current = periodEnd
    }

    return periods
  }

  private calculatePeriodMetrics(sends: any[], events: any[], requestedMetrics?: string[]) {
    const allMetrics = this.calculateCampaignMetrics(sends, events)
    const allRates = this.calculateCampaignRates(allMetrics)

    const combined = { ...allMetrics, ...allRates }

    if (requestedMetrics) {
      const filtered: Record<string, number> = {}
      for (const metric of requestedMetrics) {
        if (combined[metric] !== undefined) {
          filtered[metric] = combined[metric]
        }
      }
      return filtered
    }

    return combined
  }

  private generateCampaignCharts(data: CampaignAnalytics) {
    return [
      {
        type: 'bar' as const,
        title: 'Email Performance Metrics',
        data: {
          labels: ['Sent', 'Delivered', 'Opened', 'Clicked', 'Replied'],
          values: [
            data.metrics.sent,
            data.metrics.delivered,
            data.metrics.opened,
            data.metrics.clicked,
            data.metrics.replied
          ]
        },
        config: {
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
        }
      },
      {
        type: 'line' as const,
        title: 'Engagement Trend',
        data: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          datasets: [
            {
              label: 'Open Rate',
              values: [0.25, 0.28, 0.32, 0.30]
            },
            {
              label: 'Click Rate',
              values: [0.05, 0.06, 0.08, 0.07]
            }
          ]
        },
        config: {}
      }
    ]
  }

  private generateCampaignInsights(data: CampaignAnalytics): string[] {
    const insights = []

    if (data.rates.openRate > 0.25) {
      insights.push('Excellent open rate - your subject lines are performing well')
    }

    if (data.rates.clickRate > 0.05) {
      insights.push('Strong click-through rate indicates engaging content')
    }

    if (data.engagement.trend === 'up') {
      insights.push('Engagement is trending upward - keep up the good work')
    }

    return insights
  }

  private generateCampaignRecommendations(data: CampaignAnalytics): string[] {
    const recommendations = []

    if (data.rates.openRate < 0.20) {
      recommendations.push('Consider A/B testing different subject lines to improve open rates')
    }

    if (data.rates.clickRate < 0.03) {
      recommendations.push('Review email content and call-to-action placement to increase clicks')
    }

    if (data.rates.bounceRate > 0.05) {
      recommendations.push('Clean your email list to reduce bounce rates')
    }

    return recommendations
  }

  private generateContactCharts(data: ContactAnalytics) {
    return [
      {
        type: 'pie' as const,
        title: 'Engagement Distribution',
        data: {
          labels: ['Opens', 'Clicks', 'Replies'],
          values: [
            data.lifecycle.totalOpens,
            data.lifecycle.totalClicks,
            data.lifecycle.totalReplies
          ]
        },
        config: {}
      }
    ]
  }

  private generateContactInsights(data: ContactAnalytics): string[] {
    const insights = []

    if (data.engagementScore > 70) {
      insights.push('Highly engaged contact - excellent prospect for conversion')
    }

    if (data.predictive.churnRisk > 0.6) {
      insights.push('High churn risk - consider re-engagement campaign')
    }

    return insights
  }

  private generateContactRecommendations(data: ContactAnalytics): string[] {
    return [data.predictive.nextBestAction]
  }

  private generateDomainCharts(data: DomainAnalytics) {
    return []
  }

  private generateDomainInsights(data: DomainAnalytics): string[] {
    return []
  }

  private generateDomainRecommendations(data: DomainAnalytics): string[] {
    return data.issues.map(issue => issue.recommendation)
  }

  private generateOverviewCharts(data: any) {
    return []
  }

  private generateOverviewInsights(data: any): string[] {
    return []
  }

  private generateOverviewRecommendations(data: any): string[] {
    return []
  }

  private async getOverviewAnalytics(dateRange: any) {
    // Simplified overview analytics
    return {
      totalCampaigns: 0,
      totalContacts: 0,
      totalEmailsSent: 0,
      averageOpenRate: 0,
      averageClickRate: 0
    }
  }

  private getReportTitle(type: string, id?: string): string {
    switch (type) {
      case 'campaign':
        return `Campaign Analytics Report${id ? ` - ${id}` : ''}`
      case 'contact':
        return `Contact Analytics Report${id ? ` - ${id}` : ''}`
      case 'domain':
        return `Domain Analytics Report${id ? ` - ${id}` : ''}`
      case 'overview':
        return 'Overview Analytics Report'
      default:
        return 'Analytics Report'
    }
  }

  private getReportDescription(type: string, dateRange: any): string {
    return `Analytics report for ${dateRange.startDate} to ${dateRange.endDate}`
  }

  private async getTopPerformingCampaign() {
    const { data: campaigns } = await this.supabase
      .from('campaigns')
      .select('id, name')
      .eq('status', 'active')
      .limit(1)

    if (!campaigns?.length) return null

    // Simplified - would calculate actual performance
    return {
      id: campaigns[0].id,
      name: campaigns[0].name,
      openRate: 0.35
    }
  }

  private async getRecentActivity() {
    return [
      {
        type: 'campaign_started',
        description: 'New campaign "Welcome Series" started',
        timestamp: new Date().toISOString()
      }
    ]
  }

  private async storeReport(report: AnalyticsReport): Promise<void> {
    try {
      await this.supabase
        .from('analytics_reports')
        .insert({
          id: report.id,
          type: report.type,
          title: report.title,
          description: report.description,
          date_range: report.dateRange,
          data: report.data,
          charts: report.charts,
          insights: report.insights,
          recommendations: report.recommendations,
          format: report.format,
          created_at: report.createdAt
        })
    } catch (error) {
      console.error('Error storing report:', error)
    }
  }

  private async exportToCSV(report: AnalyticsReport): Promise<void> {
    // Simplified CSV export
    console.log('Exporting to CSV:', report.id)
  }

  private async exportToPDF(report: AnalyticsReport): Promise<void> {
    // Simplified PDF export
    console.log('Exporting to PDF:', report.id)
  }
}

// Export default instance
export const analytics = new Analytics()