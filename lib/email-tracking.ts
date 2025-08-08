import { z } from 'zod'

// Email tracking interfaces
export interface TrackingPixel {
  id: string
  messageId: string
  recipientEmail: string
  campaignId?: string
  contactId?: string
  createdAt: string
  opened: boolean
  openedAt?: string
  openCount: number
  lastOpenedAt?: string
  userAgent?: string
  ipAddress?: string
  location?: {
    country?: string
    region?: string
    city?: string
  }
}

export interface ClickTracking {
  id: string
  messageId: string
  recipientEmail: string
  originalUrl: string
  trackingUrl: string
  campaignId?: string
  contactId?: string
  createdAt: string
  clicked: boolean
  clickedAt?: string
  clickCount: number
  lastClickedAt?: string
  userAgent?: string
  ipAddress?: string
  location?: {
    country?: string
    region?: string
    city?: string
  }
}

export interface UnsubscribeToken {
  id: string
  token: string
  recipientEmail: string
  campaignId?: string
  contactId?: string
  createdAt: string
  used: boolean
  usedAt?: string
  ipAddress?: string
  userAgent?: string
}

export interface BounceEvent {
  id: string
  messageId: string
  recipientEmail: string
  bounceType: 'hard' | 'soft' | 'complaint'
  bounceSubType?: string
  bounceReason: string
  diagnosticCode?: string
  timestamp: string
  providerId: string
  processed: boolean
  campaignId?: string
  contactId?: string
}

export interface EmailAnalytics {
  messageId: string
  recipientEmail: string
  campaignId?: string
  contactId?: string
  sent: boolean
  sentAt?: string
  delivered: boolean
  deliveredAt?: string
  opened: boolean
  openedAt?: string
  openCount: number
  clicked: boolean
  clickedAt?: string
  clickCount: number
  bounced: boolean
  bouncedAt?: string
  bounceType?: string
  complained: boolean
  complainedAt?: string
  unsubscribed: boolean
  unsubscribedAt?: string
  replied: boolean
  repliedAt?: string
}

export interface TrackingStats {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  totalUnsubscribed: number
  totalReplied: number
  deliveryRate: number
  openRate: number
  clickRate: number
  bounceRate: number
  complaintRate: number
  unsubscribeRate: number
  replyRate: number
  engagementScore: number
}

// Validation schemas
const trackingPixelSchema = z.object({
  messageId: z.string(),
  recipientEmail: z.string().email(),
  campaignId: z.string().optional(),
  contactId: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
})

const clickTrackingSchema = z.object({
  messageId: z.string(),
  recipientEmail: z.string().email(),
  originalUrl: z.string().url(),
  campaignId: z.string().optional(),
  contactId: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
})

const unsubscribeSchema = z.object({
  token: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
})

/**
 * Email tracking and analytics system
 */
export class EmailTracker {
  private supabase: any
  private redis: any

  constructor(supabaseClient?: any, redisClient?: any) {
    this.supabase = supabaseClient
    this.redis = redisClient
  }

  /**
   * Generate tracking pixel for email
   */
  async generateTrackingPixel(
    messageId: string,
    recipientEmail: string,
    campaignId?: string,
    contactId?: string
  ): Promise<TrackingPixel> {
    try {
      const pixelId = this.generateTrackingId()
      
      const trackingPixel: TrackingPixel = {
        id: pixelId,
        messageId,
        recipientEmail,
        campaignId,
        contactId,
        createdAt: new Date().toISOString(),
        opened: false,
        openCount: 0
      }

      // Store tracking pixel in database
      await this.supabase
        .from('tracking_pixels')
        .insert({
          id: trackingPixel.id,
          message_id: trackingPixel.messageId,
          recipient_email: trackingPixel.recipientEmail,
          campaign_id: trackingPixel.campaignId,
          contact_id: trackingPixel.contactId,
          created_at: trackingPixel.createdAt,
          opened: trackingPixel.opened,
          open_count: trackingPixel.openCount
        })

      return trackingPixel

    } catch (error) {
      console.error('Error generating tracking pixel:', error)
      throw error
    }
  }

  /**
   * Track email open event
   */
  async trackOpen(
    pixelId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ success: boolean; firstOpen: boolean }> {
    try {

      // Get tracking pixel data
      const { data: pixel, error } = await this.supabase
        .from('tracking_pixels')
        .select('*')
        .eq('id', pixelId)
        .single()

      if (error || !pixel) {
        return { success: false, firstOpen: false }
      }

      const isFirstOpen = !pixel.opened
      const now = new Date().toISOString()

      // Update tracking pixel
      await this.supabase
        .from('tracking_pixels')
        .update({
          opened: true,
          opened_at: pixel.opened_at || now,
          open_count: pixel.open_count + 1,
          last_opened_at: now,
          user_agent: userAgent,
          ip_address: ipAddress
        })
        .eq('id', pixelId)

      // Store open event
      await this.supabase
        .from('email_events')
        .insert({
          id: this.generateEventId(),
          message_id: pixel.message_id,
          type: 'opened',
          timestamp: now,
          recipient_email: pixel.recipient_email,
          provider_id: 'tracking',
          event_data: {
            pixelId,
            userAgent,
            ipAddress,
            isFirstOpen
          },
          campaign_id: pixel.campaign_id,
          contact_id: pixel.contact_id
        })

      // Update contact engagement if first open
      if (isFirstOpen && pixel.contact_id) {
        await this.updateContactEngagement(pixel.contact_id, 'opened', now)
      }

      // Update campaign stats
      if (pixel.campaign_id) {
        await this.updateCampaignStats(pixel.campaign_id, 'opened', isFirstOpen)
      }

      return { success: true, firstOpen: isFirstOpen }

    } catch (error) {
      console.error('Error tracking email open:', error)
      return { success: false, firstOpen: false }
    }
  }

  /**
   * Generate click tracking URL
   */
  async generateClickTrackingUrl(
    messageId: string,
    recipientEmail: string,
    originalUrl: string,
    campaignId?: string,
    contactId?: string
  ): Promise<string> {
    try {
      const clickId = this.generateTrackingId()
      
      const clickTracking: ClickTracking = {
        id: clickId,
        messageId,
        recipientEmail,
        originalUrl,
        trackingUrl: `${process.env.TRACKING_DOMAIN}/click/${clickId}`,
        campaignId,
        contactId,
        createdAt: new Date().toISOString(),
        clicked: false,
        clickCount: 0
      }

      // Store click tracking in database
      await this.supabase
        .from('click_tracking')
        .insert({
          id: clickTracking.id,
          message_id: clickTracking.messageId,
          recipient_email: clickTracking.recipientEmail,
          original_url: clickTracking.originalUrl,
          tracking_url: clickTracking.trackingUrl,
          campaign_id: clickTracking.campaignId,
          contact_id: clickTracking.contactId,
          created_at: clickTracking.createdAt,
          clicked: clickTracking.clicked,
          click_count: clickTracking.clickCount
        })

      return clickTracking.trackingUrl

    } catch (error) {
      console.error('Error generating click tracking URL:', error)
      throw error
    }
  }

  /**
   * Track email click event
   */
  async trackClick(
    clickId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ success: boolean; redirectUrl: string; firstClick: boolean }> {
    try {
      // Get click tracking data
      const { data: click, error } = await this.supabase
        .from('click_tracking')
        .select('*')
        .eq('id', clickId)
        .single()

      if (error || !click) {
        return { success: false, redirectUrl: '', firstClick: false }
      }

      const isFirstClick = !click.clicked
      const now = new Date().toISOString()

      // Update click tracking
      await this.supabase
        .from('click_tracking')
        .update({
          clicked: true,
          clicked_at: click.clicked_at || now,
          click_count: click.click_count + 1,
          last_clicked_at: now,
          user_agent: userAgent,
          ip_address: ipAddress
        })
        .eq('id', clickId)

      // Store click event
      await this.supabase
        .from('email_events')
        .insert({
          id: this.generateEventId(),
          message_id: click.message_id,
          type: 'clicked',
          timestamp: now,
          recipient_email: click.recipient_email,
          provider_id: 'tracking',
          event_data: {
            clickId,
            originalUrl: click.original_url,
            userAgent,
            ipAddress,
            isFirstClick
          },
          campaign_id: click.campaign_id,
          contact_id: click.contact_id
        })

      // Update contact engagement if first click
      if (isFirstClick && click.contact_id) {
        await this.updateContactEngagement(click.contact_id, 'clicked', now)
      }

      // Update campaign stats
      if (click.campaign_id) {
        await this.updateCampaignStats(click.campaign_id, 'clicked', isFirstClick)
      }

      return { 
        success: true, 
        redirectUrl: click.original_url, 
        firstClick: isFirstClick 
      }

    } catch (error) {
      console.error('Error tracking email click:', error)
      return { success: false, redirectUrl: '', firstClick: false }
    }
  }

  /**
   * Generate unsubscribe token
   */
  async generateUnsubscribeToken(
    recipientEmail: string,
    campaignId?: string,
    contactId?: string
  ): Promise<UnsubscribeToken> {
    try {
      const token = this.generateUnsubscribeTokenString()
      
      const unsubscribeToken: UnsubscribeToken = {
        id: this.generateTrackingId(),
        token,
        recipientEmail,
        campaignId,
        contactId,
        createdAt: new Date().toISOString(),
        used: false
      }

      // Store unsubscribe token in database
      await this.supabase
        .from('unsubscribe_tokens')
        .insert({
          id: unsubscribeToken.id,
          token: unsubscribeToken.token,
          recipient_email: unsubscribeToken.recipientEmail,
          campaign_id: unsubscribeToken.campaignId,
          contact_id: unsubscribeToken.contactId,
          created_at: unsubscribeToken.createdAt,
          used: unsubscribeToken.used
        })

      return unsubscribeToken

    } catch (error) {
      console.error('Error generating unsubscribe token:', error)
      throw error
    }
  }

  /**
   * Process unsubscribe request
   */
  async processUnsubscribe(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; email?: string; alreadyUnsubscribed: boolean }> {
    try {
      // Validate input
      const validatedData = unsubscribeSchema.parse({
        token,
        ipAddress,
        userAgent
      })

      // Get unsubscribe token data
      const { data: unsubToken, error } = await this.supabase
        .from('unsubscribe_tokens')
        .select('*')
        .eq('token', token)
        .single()

      if (error || !unsubToken) {
        return { success: false, alreadyUnsubscribed: false }
      }

      const alreadyUnsubscribed = unsubToken.used
      const now = new Date().toISOString()

      // Mark token as used
      if (!alreadyUnsubscribed) {
        await this.supabase
          .from('unsubscribe_tokens')
          .update({
            used: true,
            used_at: now,
            ip_address: ipAddress,
            user_agent: userAgent
          })
          .eq('token', token)

        // Update contact status
        await this.supabase
          .from('contacts')
          .update({
            email_status: 'unsubscribed',
            unsubscribed_at: now
          })
          .eq('email', unsubToken.recipient_email)

        // Store unsubscribe event
        await this.supabase
          .from('email_events')
          .insert({
            id: this.generateEventId(),
            message_id: unsubToken.message_id || 'unsubscribe',
            type: 'unsubscribed',
            timestamp: now,
            recipient_email: unsubToken.recipient_email,
            provider_id: 'tracking',
            event_data: {
              token,
              ipAddress,
              userAgent
            },
            campaign_id: unsubToken.campaign_id,
            contact_id: unsubToken.contact_id
          })

        // Update contact engagement
        if (unsubToken.contact_id) {
          await this.updateContactEngagement(unsubToken.contact_id, 'unsubscribed', now)
        }

        // Update campaign stats
        if (unsubToken.campaign_id) {
          await this.updateCampaignStats(unsubToken.campaign_id, 'unsubscribed', true)
        }
      }

      return { 
        success: true, 
        email: unsubToken.recipient_email,
        alreadyUnsubscribed 
      }

    } catch (error) {
      console.error('Error processing unsubscribe:', error)
      return { success: false, alreadyUnsubscribed: false }
    }
  }

  /**
   * Process bounce event
   */
  async processBounce(
    messageId: string,
    recipientEmail: string,
    bounceType: 'hard' | 'soft' | 'complaint',
    bounceReason: string,
    providerId: string,
    bounceSubType?: string,
    diagnosticCode?: string,
    campaignId?: string,
    contactId?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString()

      // Store bounce event
      const bounceEvent: BounceEvent = {
        id: this.generateEventId(),
        messageId,
        recipientEmail,
        bounceType,
        bounceSubType,
        bounceReason,
        diagnosticCode,
        timestamp: now,
        providerId,
        processed: false,
        campaignId,
        contactId
      }

      await this.supabase
        .from('bounce_events')
        .insert({
          id: bounceEvent.id,
          message_id: bounceEvent.messageId,
          recipient_email: bounceEvent.recipientEmail,
          bounce_type: bounceEvent.bounceType,
          bounce_sub_type: bounceEvent.bounceSubType,
          bounce_reason: bounceEvent.bounceReason,
          diagnostic_code: bounceEvent.diagnosticCode,
          timestamp: bounceEvent.timestamp,
          provider_id: bounceEvent.providerId,
          processed: bounceEvent.processed,
          campaign_id: bounceEvent.campaignId,
          contact_id: bounceEvent.contactId
        })

      // Store email event
      await this.supabase
        .from('email_events')
        .insert({
          id: this.generateEventId(),
          message_id: messageId,
          type: 'bounced',
          timestamp: now,
          recipient_email: recipientEmail,
          provider_id: providerId,
          event_data: {
            bounceType,
            bounceSubType,
            bounceReason,
            diagnosticCode
          },
          campaign_id: campaignId,
          contact_id: contactId
        })

      // Update contact status for hard bounces
      if (bounceType === 'hard') {
        await this.supabase
          .from('contacts')
          .update({
            email_status: 'bounced',
            bounced_at: now
          })
          .eq('email', recipientEmail)

        // Update contact engagement
        if (contactId) {
          await this.updateContactEngagement(contactId, 'bounced', now)
        }
      }

      // Update campaign stats
      if (campaignId) {
        await this.updateCampaignStats(campaignId, 'bounced', true)
      }

      // Mark bounce as processed
      await this.supabase
        .from('bounce_events')
        .update({ processed: true })
        .eq('id', bounceEvent.id)

    } catch (error) {
      console.error('Error processing bounce:', error)
      throw error
    }
  }

  /**
   * Get email analytics for a message
   */
  async getEmailAnalytics(messageId: string): Promise<EmailAnalytics | null> {
    try {
      // Get send record
      const { data: sendRecord, error: sendError } = await this.supabase
        .from('email_sends')
        .select('*')
        .eq('message_id', messageId)
        .single()

      if (sendError || !sendRecord) {
        return null
      }

      // Get all events for this message
      const { data: events, error: eventsError } = await this.supabase
        .from('email_events')
        .select('*')
        .eq('message_id', messageId)
        .order('timestamp', { ascending: true })

      if (eventsError) {
        console.error('Error fetching events:', eventsError)
      }

      // Get tracking data
      const { data: pixel } = await this.supabase
        .from('tracking_pixels')
        .select('*')
        .eq('message_id', messageId)
        .single()

      const { data: clicks } = await this.supabase
        .from('click_tracking')
        .select('*')
        .eq('message_id', messageId)

      // Build analytics object
      const analytics: EmailAnalytics = {
        messageId,
        recipientEmail: sendRecord.recipient_email,
        campaignId: sendRecord.campaign_id,
        contactId: sendRecord.contact_id,
        sent: true,
        sentAt: sendRecord.created_at,
        delivered: sendRecord.success,
        deliveredAt: sendRecord.delivered_at,
        opened: pixel?.opened || false,
        openedAt: pixel?.opened_at,
        openCount: pixel?.open_count || 0,
        clicked: clicks?.some(c => c.clicked) || false,
        clickedAt: clicks?.find(c => c.clicked)?.clicked_at,
        clickCount: clicks?.reduce((sum, c) => sum + c.click_count, 0) || 0,
        bounced: false,
        complained: false,
        unsubscribed: false,
        replied: false
      }

      // Process events
      for (const event of events || []) {
        switch (event.type) {
          case 'delivered':
            analytics.delivered = true
            analytics.deliveredAt = event.timestamp
            break
          case 'bounced':
            analytics.bounced = true
            analytics.bouncedAt = event.timestamp
            analytics.bounceType = event.event_data?.bounceType
            break
          case 'complained':
            analytics.complained = true
            analytics.complainedAt = event.timestamp
            break
          case 'unsubscribed':
            analytics.unsubscribed = true
            analytics.unsubscribedAt = event.timestamp
            break
          case 'replied':
            analytics.replied = true
            analytics.repliedAt = event.timestamp
            break
        }
      }

      return analytics

    } catch (error) {
      console.error('Error getting email analytics:', error)
      return null
    }
  }

  /**
   * Get tracking statistics for a campaign
   */
  async getCampaignTrackingStats(campaignId: string): Promise<TrackingStats> {
    try {
      // Get all sends for campaign
      const { data: sends, error: sendsError } = await this.supabase
        .from('email_sends')
        .select('*')
        .eq('campaign_id', campaignId)

      if (sendsError) throw sendsError

      // Get all events for campaign
      const { data: events, error: eventsError } = await this.supabase
        .from('email_events')
        .select('*')
        .eq('campaign_id', campaignId)

      if (eventsError) throw eventsError

      // Calculate statistics
      const totalSent = sends?.length || 0
      const totalDelivered = events?.filter(e => e.type === 'delivered').length || 0
      const totalOpened = events?.filter(e => e.type === 'opened').length || 0
      const totalClicked = events?.filter(e => e.type === 'clicked').length || 0
      const totalBounced = events?.filter(e => e.type === 'bounced').length || 0
      const totalComplained = events?.filter(e => e.type === 'complained').length || 0
      const totalUnsubscribed = events?.filter(e => e.type === 'unsubscribed').length || 0
      const totalReplied = events?.filter(e => e.type === 'replied').length || 0

      const stats: TrackingStats = {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalComplained,
        totalUnsubscribed,
        totalReplied,
        deliveryRate: totalSent > 0 ? totalDelivered / totalSent : 0,
        openRate: totalDelivered > 0 ? totalOpened / totalDelivered : 0,
        clickRate: totalDelivered > 0 ? totalClicked / totalDelivered : 0,
        bounceRate: totalSent > 0 ? totalBounced / totalSent : 0,
        complaintRate: totalSent > 0 ? totalComplained / totalSent : 0,
        unsubscribeRate: totalSent > 0 ? totalUnsubscribed / totalSent : 0,
        replyRate: totalDelivered > 0 ? totalReplied / totalDelivered : 0,
        engagementScore: 0
      }

      // Calculate engagement score (weighted average)
      stats.engagementScore = (
        stats.openRate * 0.3 +
        stats.clickRate * 0.4 +
        stats.replyRate * 0.3
      )

      return stats

    } catch (error) {
      console.error('Error getting campaign tracking stats:', error)
      throw error
    }
  }

  /**
   * Clean bounced and unsubscribed contacts from lists
   */
  async cleanContactList(listId?: string): Promise<{
    cleaned: number
    bounced: number
    unsubscribed: number
    complained: number
  }> {
    try {
      let query = this.supabase
        .from('contacts')
        .select('id, email, email_status')

      if (listId) {
        query = query.eq('list_id', listId)
      }

      const { data: contacts, error } = await query

      if (error) throw error

      let cleaned = 0
      let bounced = 0
      let unsubscribed = 0
      let complained = 0

      for (const contact of contacts || []) {
        if (contact.email_status === 'bounced') {
          bounced++
          cleaned++
        } else if (contact.email_status === 'unsubscribed') {
          unsubscribed++
          cleaned++
        } else if (contact.email_status === 'complained') {
          complained++
          cleaned++
        }
      }

      // Mark cleaned contacts as inactive
      if (cleaned > 0) {
        const cleanStatuses = ['bounced', 'unsubscribed', 'complained']
        let updateQuery = this.supabase
          .from('contacts')
          .update({ is_active: false })
          .in('email_status', cleanStatuses)

        if (listId) {
          updateQuery = updateQuery.eq('list_id', listId)
        }

        await updateQuery
      }

      return { cleaned, bounced, unsubscribed, complained }

    } catch (error) {
      console.error('Error cleaning contact list:', error)
      throw error
    }
  }

  // Private helper methods

  private async updateContactEngagement(
    contactId: string,
    eventType: string,
    timestamp: string
  ): Promise<void> {
    try {
      const updates: any = {}

      switch (eventType) {
        case 'opened':
          updates.last_opened_at = timestamp
          break
        case 'clicked':
          updates.last_clicked_at = timestamp
          break
        case 'bounced':
          updates.bounced_at = timestamp
          updates.email_status = 'bounced'
          break
        case 'unsubscribed':
          updates.unsubscribed_at = timestamp
          updates.email_status = 'unsubscribed'
          break
        case 'replied':
          updates.last_replied_at = timestamp
          break
      }

      if (Object.keys(updates).length > 0) {
        await this.supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId)
      }

    } catch (error) {
      console.error('Error updating contact engagement:', error)
    }
  }

  private async updateCampaignStats(
    campaignId: string,
    eventType: string,
    isFirst: boolean
  ): Promise<void> {
    try {
      // Get current campaign stats
      const { data: campaign, error } = await this.supabase
        .from('campaigns')
        .select('stats')
        .eq('id', campaignId)
        .single()

      if (error || !campaign) return

      const stats = campaign.stats || {}

      // Update stats based on event type
      switch (eventType) {
        case 'opened':
          if (isFirst) {
            stats.unique_opens = (stats.unique_opens || 0) + 1
          }
          stats.total_opens = (stats.total_opens || 0) + 1
          break
        case 'clicked':
          if (isFirst) {
            stats.unique_clicks = (stats.unique_clicks || 0) + 1
          }
          stats.total_clicks = (stats.total_clicks || 0) + 1
          break
        case 'bounced':
          stats.bounces = (stats.bounces || 0) + 1
          break
        case 'unsubscribed':
          stats.unsubscribes = (stats.unsubscribes || 0) + 1
          break
        case 'replied':
          stats.replies = (stats.replies || 0) + 1
          break
      }

      // Update campaign
      await this.supabase
        .from('campaigns')
        .update({ stats })
        .eq('id', campaignId)

    } catch (error) {
      console.error('Error updating campaign stats:', error)
    }
  }

  private generateTrackingId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateUnsubscribeTokenString(): string {
    return `unsub_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`
  }

  /**
   * Get real-time tracking data for dashboard
   */
  async getRealTimeTrackingData(timeRange: 'hour' | 'day' = 'hour'): Promise<{
    recentOpens: number
    recentClicks: number
    recentBounces: number
    recentUnsubscribes: number
    topPerformingCampaigns: Array<{
      campaignId: string
      campaignName: string
      opens: number
      clicks: number
      engagementRate: number
    }>
  }> {
    try {
      const startTime = timeRange === 'hour' 
        ? new Date(Date.now() - 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      // Get recent events
      const { data: events, error } = await this.supabase
        .from('email_events')
        .select('type, campaign_id')
        .gte('timestamp', startTime)

      if (error) throw error

      const recentOpens = events?.filter(e => e.type === 'opened').length || 0
      const recentClicks = events?.filter(e => e.type === 'clicked').length || 0
      const recentBounces = events?.filter(e => e.type === 'bounced').length || 0
      const recentUnsubscribes = events?.filter(e => e.type === 'unsubscribed').length || 0

      // Get top performing campaigns
      const campaignEvents = events?.filter(e => e.campaign_id) || []
      const campaignGroups = this.groupBy(campaignEvents, 'campaign_id')
      
      const topPerformingCampaigns = await Promise.all(
        Object.entries(campaignGroups)
          .slice(0, 5)
          .map(async ([campaignId, events]) => {
            const { data: campaign } = await this.supabase
              .from('campaigns')
              .select('name')
              .eq('id', campaignId)
              .single()

            const opens = events.filter((e: any) => e.type === 'opened').length
            const clicks = events.filter((e: any) => e.type === 'clicked').length
            const total = events.length

            return {
              campaignId,
              campaignName: campaign?.name || 'Unknown Campaign',
              opens,
              clicks,
              engagementRate: total > 0 ? (opens + clicks) / total : 0
            }
          })
      )

      return {
        recentOpens,
        recentClicks,
        recentBounces,
        recentUnsubscribes,
        topPerformingCampaigns: topPerformingCampaigns.sort(
          (a, b) => b.engagementRate - a.engagementRate
        )
      }

    } catch (error) {
      console.error('Error getting real-time tracking data:', error)
      throw error
    }
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key])
      groups[group] = groups[group] || []
      groups[group].push(item)
      return groups
    }, {} as Record<string, T[]>)
  }
}

// Export default instance
export const emailTracker = new EmailTracker()