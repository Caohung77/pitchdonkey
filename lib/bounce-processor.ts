/**
 * Bounce Processor
 *
 * Enhanced bounce processing system that:
 * 1. Parses bounce emails using DSN/NDR parsing
 * 2. Correlates bounces with sent emails using VERP and Message-ID
 * 3. Updates contact engagement status automatically
 * 4. Updates campaign statistics
 */

import { createServerSupabaseClient } from './supabase-server'
import { parseBounceEmail, parseVERPAddress, type BounceInfo } from './bounce-email-parser'
import { recalculateContactEngagement } from './contact-engagement'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export interface BounceProcessingResult {
  success: boolean
  bounceDetected: boolean
  contactId: string | null
  campaignId: string | null
  bounceType: 'hard' | 'soft' | 'complaint' | 'transient' | 'unknown' | null
  contactStatusUpdated: boolean
  engagementRecalculated: boolean
  error: string | null
}

export class BounceProcessor {
  private supabase: SupabaseClient<Database>

  constructor(supabase?: SupabaseClient<Database>) {
    this.supabase = supabase || createServerSupabaseClient()
  }

  /**
   * Process an incoming email to detect and handle bounces
   */
  async processIncomingEmail(emailId: string): Promise<BounceProcessingResult> {
    const result: BounceProcessingResult = {
      success: false,
      bounceDetected: false,
      contactId: null,
      campaignId: null,
      bounceType: null,
      contactStatusUpdated: false,
      engagementRecalculated: false,
      error: null
    }

    try {
      // Fetch the incoming email
      const { data: email, error: emailError } = await this.supabase
        .from('incoming_emails')
        .select('*')
        .eq('id', emailId)
        .single()

      if (emailError || !email) {
        result.error = `Failed to fetch email: ${emailError?.message || 'Not found'}`
        return result
      }

      // Parse the email to detect bounce
      const parseResult = await parseBounceEmail({
        subject: email.subject,
        from_address: email.from_address,
        text_content: email.text_content,
        html_content: email.html_content,
        in_reply_to: email.in_reply_to,
        headers: undefined // We don't have headers parsed yet, but bounce-parser handles this
      })

      if (!parseResult.isBounce || !parseResult.bounceInfo) {
        result.success = true
        result.bounceDetected = false
        return result
      }

      result.bounceDetected = true
      result.bounceType = parseResult.bounceInfo.bounceType

      console.log(`📧 Bounce detected for email ${emailId}:`, {
        bounceType: parseResult.bounceInfo.bounceType,
        category: parseResult.bounceInfo.bounceCategory,
        recipient: parseResult.bounceInfo.originalRecipient,
        statusCode: parseResult.bounceInfo.statusCode
      })

      // Find the original email and contact
      const correlation = await this.correlateBouncewithSentEmail(email, parseResult.bounceInfo)

      if (!correlation.contactId) {
        console.warn(`⚠️ Could not correlate bounce with contact. Bounce info:`, {
          originalRecipient: parseResult.bounceInfo.originalRecipient,
          originalMessageId: parseResult.bounceInfo.originalMessageId,
          returnPath: parseResult.bounceInfo.returnPath
        })
        result.error = 'Could not correlate bounce with sent email'
        result.success = true // Still mark as success since we detected the bounce
        return result
      }

      result.contactId = correlation.contactId
      result.campaignId = correlation.campaignId

      console.log(`✅ Bounce correlated with contact ${correlation.contactId}`)

      // Update email_tracking with bounce information
      if (correlation.trackingRecordId) {
        await this.updateEmailTracking(correlation.trackingRecordId, parseResult.bounceInfo)
      }

      // Update contact status based on bounce type
      const statusUpdated = await this.updateContactStatus(
        correlation.contactId,
        parseResult.bounceInfo
      )
      result.contactStatusUpdated = statusUpdated

      // Recalculate contact engagement
      if (statusUpdated) {
        try {
          await recalculateContactEngagement(this.supabase, correlation.contactId)
          result.engagementRecalculated = true
          console.log(`✅ Engagement recalculated for contact ${correlation.contactId}`)
        } catch (engagementError) {
          console.error('❌ Failed to recalculate engagement:', engagementError)
        }
      }

      // Update campaign statistics
      if (correlation.campaignId) {
        await this.updateCampaignStatistics(correlation.campaignId, parseResult.bounceInfo.bounceType)
      }

      // Create email_reply record for tracking
      await this.createBounceReplyRecord(email, parseResult.bounceInfo, correlation)

      result.success = true
      return result

    } catch (error) {
      console.error('❌ Error processing bounce:', error)
      result.error = error instanceof Error ? error.message : 'Unknown error'
      return result
    }
  }

  /**
   * Correlate bounce with the original sent email
   */
  private async correlateBouncewithSentEmail(
    bounceEmail: any,
    bounceInfo: BounceInfo
  ): Promise<{
    contactId: string | null
    campaignId: string | null
    trackingRecordId: string | null
    originalMessageId: string | null
  }> {
    const result = {
      contactId: null as string | null,
      campaignId: null as string | null,
      trackingRecordId: null as string | null,
      originalMessageId: null as string | null
    }

    // Method 1: Try VERP matching (most reliable)
    if (bounceInfo.returnPath || bounceEmail.to_address) {
      const verpAddress = bounceInfo.returnPath || bounceEmail.to_address
      const verpParsed = parseVERPAddress(verpAddress)

      if (verpParsed.campaignId && verpParsed.contactEmail) {
        console.log(`🔍 VERP match found: campaign=${verpParsed.campaignId}, email=${verpParsed.contactEmail}`)

        // Find contact by email
        const { data: contact } = await this.supabase
          .from('contacts')
          .select('id, user_id')
          .eq('email', verpParsed.contactEmail)
          .eq('user_id', bounceEmail.user_id)
          .single()

        if (contact) {
          result.contactId = contact.id
          result.campaignId = verpParsed.campaignId

          // Find tracking record
          const { data: tracking } = await this.supabase
            .from('email_tracking')
            .select('id, message_id')
            .eq('campaign_id', verpParsed.campaignId)
            .eq('contact_id', contact.id)
            .eq('user_id', bounceEmail.user_id)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single()

          if (tracking) {
            result.trackingRecordId = tracking.id
            result.originalMessageId = tracking.message_id
          }

          return result
        }
      }
    }

    // Method 2: Try Message-ID matching
    if (bounceInfo.originalMessageId || bounceEmail.in_reply_to) {
      const messageId = bounceInfo.originalMessageId || bounceEmail.in_reply_to

      console.log(`🔍 Trying Message-ID match: ${messageId}`)

      const { data: tracking } = await this.supabase
        .from('email_tracking')
        .select('id, contact_id, campaign_id, message_id')
        .eq('message_id', messageId)
        .eq('user_id', bounceEmail.user_id)
        .single()

      if (tracking) {
        result.contactId = tracking.contact_id
        result.campaignId = tracking.campaign_id
        result.trackingRecordId = tracking.id
        result.originalMessageId = tracking.message_id
        console.log(`✅ Message-ID match found: contact=${tracking.contact_id}`)
        return result
      }
    }

    // Method 3: Try matching by original recipient email address
    if (bounceInfo.originalRecipient) {
      console.log(`🔍 Trying recipient email match: ${bounceInfo.originalRecipient}`)

      const { data: contact } = await this.supabase
        .from('contacts')
        .select('id')
        .eq('email', bounceInfo.originalRecipient)
        .eq('user_id', bounceEmail.user_id)
        .single()

      if (contact) {
        result.contactId = contact.id

        // Try to find the most recent campaign for this contact
        const { data: tracking } = await this.supabase
          .from('email_tracking')
          .select('id, campaign_id, message_id')
          .eq('contact_id', contact.id)
          .eq('user_id', bounceEmail.user_id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single()

        if (tracking) {
          result.campaignId = tracking.campaign_id
          result.trackingRecordId = tracking.id
          result.originalMessageId = tracking.message_id
        }

        console.log(`✅ Recipient email match found: contact=${contact.id}`)
        return result
      }
    }

    console.warn(`⚠️ Could not correlate bounce with any sent email`)
    return result
  }

  /**
   * Update email_tracking record with bounce information
   */
  private async updateEmailTracking(trackingId: string, bounceInfo: BounceInfo): Promise<void> {
    const now = new Date().toISOString()

    const updates: any = {
      status: 'bounced',
      bounced_at: now,
      bounce_type: bounceInfo.bounceType,
      bounce_reason: bounceInfo.diagnosticCode || `${bounceInfo.bounceCategory}: ${bounceInfo.statusCode || 'unknown'}`,
      updated_at: now
    }

    const { error } = await this.supabase
      .from('email_tracking')
      .update(updates)
      .eq('id', trackingId)

    if (error) {
      console.error('❌ Failed to update email_tracking:', error)
      throw new Error(`Failed to update email_tracking: ${error.message}`)
    }

    console.log(`✅ Updated email_tracking record ${trackingId} with bounce info`)
  }

  /**
   * Update contact status based on bounce type
   */
  private async updateContactStatus(contactId: string, bounceInfo: BounceInfo): Promise<boolean> {
    const now = new Date().toISOString()

    // Determine action based on bounce type
    let shouldUpdateStatus = false
    const updates: any = {
      updated_at: now
    }

    if (bounceInfo.bounceType === 'hard' || bounceInfo.bounceType === 'complaint') {
      // Hard bounce or complaint - immediately mark as bad
      updates.engagement_status = 'bad'
      updates.engagement_updated_at = now
      shouldUpdateStatus = true

      console.log(`🚫 Marking contact ${contactId} as BAD (hard bounce/complaint)`)

    } else if (bounceInfo.bounceType === 'soft') {
      // Soft bounce - increment bounce counter, let engagement system handle status
      // The engagement system will handle marking as bad if bounce count gets too high
      updates.engagement_bounce_count = this.supabase.raw('COALESCE(engagement_bounce_count, 0) + 1')
      shouldUpdateStatus = true

      console.log(`⚠️ Incrementing bounce count for contact ${contactId} (soft bounce)`)
    }

    if (!shouldUpdateStatus) {
      return false
    }

    const { error } = await this.supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)

    if (error) {
      console.error('❌ Failed to update contact status:', error)
      return false
    }

    console.log(`✅ Updated contact ${contactId} status`)
    return true
  }

  /**
   * Update campaign statistics with bounce information
   */
  private async updateCampaignStatistics(
    campaignId: string,
    bounceType: string
  ): Promise<void> {
    // Increment bounce counter
    const { error } = await this.supabase
      .from('campaigns')
      .update({
        emails_bounced: this.supabase.raw('COALESCE(emails_bounced, 0) + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    if (error) {
      console.error('❌ Failed to update campaign statistics:', error)
    } else {
      console.log(`✅ Updated campaign ${campaignId} bounce statistics`)
    }
  }

  /**
   * Create email_reply record for bounce tracking
   */
  private async createBounceReplyRecord(
    email: any,
    bounceInfo: BounceInfo,
    correlation: any
  ): Promise<void> {
    const replyData = {
      user_id: email.user_id,
      incoming_email_id: email.id,
      campaign_id: correlation.campaignId,
      contact_id: correlation.contactId,
      original_message_id: correlation.originalMessageId,
      reply_type: 'bounce',
      reply_subtype: bounceInfo.bounceCategory,
      bounce_type: bounceInfo.bounceType,
      bounce_code: bounceInfo.statusCode,
      bounce_reason: bounceInfo.diagnosticCode || `${bounceInfo.bounceCategory}: ${bounceInfo.enhancedStatusCode || bounceInfo.statusCode || 'unknown'}`,
      confidence_score: 1.0, // High confidence for bounce detection
      requires_human_review: false,
      action_taken: 'contact_status_updated',
      action_taken_at: new Date().toISOString()
    }

    const { error } = await this.supabase
      .from('email_replies')
      .insert(replyData)

    if (error) {
      console.error('❌ Failed to create bounce reply record:', error)
    } else {
      console.log(`✅ Created bounce reply record for email ${email.id}`)
    }
  }

  /**
   * Get bounce statistics for a user
   */
  async getBounceStatistics(userId: string, dateFrom?: string): Promise<{
    total: number
    hard: number
    soft: number
    complaint: number
    byCategory: Record<string, number>
    recentBounces: Array<{
      contactEmail: string
      bounceType: string
      bounceCategory: string
      bouncedAt: string
      campaignName: string | null
    }>
  }> {
    let query = this.supabase
      .from('email_replies')
      .select(`
        *,
        contacts!email_replies_contact_id_fkey(email),
        campaigns!email_replies_campaign_id_fkey(name)
      `)
      .eq('user_id', userId)
      .eq('reply_type', 'bounce')
      .order('created_at', { ascending: false })

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    const { data: bounces, error } = await query

    if (error) {
      console.error('❌ Error fetching bounce statistics:', error)
      return {
        total: 0,
        hard: 0,
        soft: 0,
        complaint: 0,
        byCategory: {},
        recentBounces: []
      }
    }

    const stats = {
      total: bounces?.length || 0,
      hard: 0,
      soft: 0,
      complaint: 0,
      byCategory: {} as Record<string, number>,
      recentBounces: [] as Array<{
        contactEmail: string
        bounceType: string
        bounceCategory: string
        bouncedAt: string
        campaignName: string | null
      }>
    }

    bounces?.forEach((bounce: any) => {
      // Count by bounce type
      if (bounce.bounce_type === 'hard') stats.hard++
      else if (bounce.bounce_type === 'soft') stats.soft++
      else if (bounce.bounce_type === 'complaint') stats.complaint++

      // Count by category
      const category = bounce.reply_subtype || 'unknown'
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1

      // Add to recent bounces (limit to 50)
      if (stats.recentBounces.length < 50) {
        stats.recentBounces.push({
          contactEmail: bounce.contacts?.email || 'unknown',
          bounceType: bounce.bounce_type || 'unknown',
          bounceCategory: category,
          bouncedAt: bounce.created_at,
          campaignName: bounce.campaigns?.name || null
        })
      }
    })

    return stats
  }
}

// Export singleton instance
export const bounceProcessor = new BounceProcessor()

// Export factory function for dependency injection
export function createBounceProcessor(supabase?: SupabaseClient<Database>): BounceProcessor {
  return new BounceProcessor(supabase)
}
