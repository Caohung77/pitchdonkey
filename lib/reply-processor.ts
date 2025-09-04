import { createServerSupabaseClient } from './supabase-server'
import { emailClassifier, EmailClassificationResult } from './email-classifier'

export interface ReplyProcessingResult {
  processed: number
  successful: number
  failed: number
  errors: string[]
}

export interface ReplyAction {
  action: string
  timestamp: string
  details?: any
}

/**
 * Reply processing pipeline that classifies emails and takes appropriate actions
 */
export class ReplyProcessor {
  private supabase: any

  constructor() {
    this.supabase = createServerSupabaseClient()
  }

  /**
   * Process all unclassified emails for a user
   */
  async processUnclassifiedEmails(userId: string, limit: number = 100): Promise<ReplyProcessingResult> {
    const result: ReplyProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    }

    try {
      // Get unclassified emails
      const { data: emails, error } = await this.supabase
        .from('incoming_emails')
        .select('*')
        .eq('user_id', userId)
        .eq('classification_status', 'unclassified')
        .eq('processing_status', 'pending')
        .order('date_received', { ascending: true })
        .limit(limit)

      if (error) {
        result.errors.push(`Error fetching emails: ${error.message}`)
        return result
      }

      if (!emails || emails.length === 0) {
        console.log('📧 No unclassified emails to process')
        return result
      }

      console.log(`📧 Processing ${emails.length} unclassified emails`)

      // Process each email
      for (const email of emails) {
        result.processed++
        try {
          await this.processIncomingEmail(email)
          result.successful++
        } catch (error) {
          result.failed++
          result.errors.push(`Email ${email.id}: ${error.message}`)
          console.error(`❌ Error processing email ${email.id}:`, error)
        }
      }

      console.log(`✅ Processed ${result.successful}/${result.processed} emails successfully`)
      return result

    } catch (error) {
      console.error('❌ Error in reply processing:', error)
      result.errors.push(error.message)
      return result
    }
  }

  /**
   * Process a single incoming email
   */
  async processIncomingEmail(email: any): Promise<void> {
    console.log(`🔄 Processing email: ${email.subject} from ${email.from_address}`)

    // Classify the email
    const classification = await emailClassifier.classifyEmail({
      id: email.id,
      messageId: email.message_id,
      inReplyTo: email.in_reply_to,
      fromAddress: email.from_address,
      toAddress: email.to_address,
      subject: email.subject,
      textContent: email.text_content,
      htmlContent: email.html_content,
      dateReceived: email.date_received
    })

    console.log(`🏷️ Email classified as: ${classification.type} (${classification.confidence})`)

    // Update email classification in database
    await this.updateEmailClassification(email.id, classification)

    // Find related campaign/contact if this is a reply
    const context = await this.findEmailContext(email)

    // Create email reply record
    const replyId = await this.createEmailReply(email, classification, context)

    // Take appropriate actions based on classification
    const actions = await this.takeClassificationActions(email, classification, context)

    // Update reply record with actions taken
    await this.updateReplyActions(replyId, actions)

    console.log(`✅ Email processed: ${classification.type} - ${actions.length} actions taken`)
  }

  /**
   * Update email classification in database
   */
  private async updateEmailClassification(
    emailId: string,
    classification: EmailClassificationResult
  ): Promise<void> {
    const { error } = await this.supabase
      .from('incoming_emails')
      .update({
        classification_status: classification.type,
        classification_confidence: classification.confidence,
        processing_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', emailId)

    if (error) {
      throw new Error(`Failed to update email classification: ${error.message}`)
    }
  }

  /**
   * Find the original campaign/contact context for this email
   */
  private async findEmailContext(email: any): Promise<{
    campaignId?: string
    contactId?: string
    originalMessageId?: string
  }> {
    const context: any = {}

    // If this email has an in-reply-to header, try to find the original email
    if (email.in_reply_to) {
      // Search in email_tracking table for the original email
      const { data: originalEmail } = await this.supabase
        .from('email_tracking')
        .select('campaign_id, contact_id, message_id')
        .eq('message_id', email.in_reply_to)
        .single()

      if (originalEmail) {
        context.campaignId = originalEmail.campaign_id
        context.contactId = originalEmail.contact_id
        context.originalMessageId = originalEmail.message_id
      }
    }

    // If no direct reply match, try to find by email address
    if (!context.contactId) {
      const { data: contact } = await this.supabase
        .from('contacts')
        .select('id')
        .eq('email', email.from_address)
        .single()

      if (contact) {
        context.contactId = contact.id
      }
    }

    return context
  }

  /**
   * Create email reply record
   */
  private async createEmailReply(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<string> {
    // Map classification type to valid reply_type
    const mapClassificationToReplyType = (classificationType: string): string => {
      switch (classificationType) {
        case 'spam':
          return 'complaint'
        case 'unclassified':
          return 'human_reply'
        default:
          return classificationType
      }
    }

    const replyData = {
      user_id: email.user_id,
      incoming_email_id: email.id,
      campaign_id: context.campaignId,
      contact_id: context.contactId,
      original_message_id: context.originalMessageId,
      reply_type: mapClassificationToReplyType(classification.type),
      reply_subtype: classification.subtype,
      sentiment: classification.sentiment,
      intent: classification.intent,
      keywords: classification.keywords,
      confidence_score: classification.confidence,
      requires_human_review: classification.requiresHumanReview
    }

    // Add type-specific data
    if (classification.bounceInfo) {
      replyData.bounce_type = classification.bounceInfo.bounceType
      replyData.bounce_code = classification.bounceInfo.bounceCode
      replyData.bounce_reason = classification.bounceInfo.bounceReason
    }

    if (classification.autoReplyInfo) {
      replyData.auto_reply_until = classification.autoReplyInfo.autoReplyUntil?.toISOString()
      replyData.forwarded_to = classification.autoReplyInfo.forwardedTo
    }

    const { data, error } = await this.supabase
      .from('email_replies')
      .insert(replyData)
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create email reply: ${error.message}`)
    }

    return data.id
  }

  /**
   * Take appropriate actions based on email classification
   */
  private async takeClassificationActions(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<ReplyAction[]> {
    const actions: ReplyAction[] = []

    switch (classification.type) {
      case 'bounce':
        actions.push(...await this.handleBounce(email, classification, context))
        break

      case 'auto_reply':
        actions.push(...await this.handleAutoReply(email, classification, context))
        break

      case 'human_reply':
        actions.push(...await this.handleHumanReply(email, classification, context))
        break

      case 'unsubscribe':
        actions.push(...await this.handleUnsubscribe(email, classification, context))
        break

      case 'spam':
        actions.push(...await this.handleSpam(email, classification, context))
        break
    }

    return actions
  }

  /**
   * Handle bounce emails
   */
  private async handleBounce(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<ReplyAction[]> {
    const actions: ReplyAction[] = []

    if (context.contactId) {
      // Update contact status based on bounce type
      const bounceType = classification.bounceInfo?.bounceType
      
      if (bounceType === 'hard') {
        // Hard bounce - mark email as invalid
        await this.supabase
          .from('contacts')
          .update({
            email_status: 'bounced',
            bounced_at: new Date().toISOString(),
            bounce_reason: classification.bounceInfo?.bounceReason
          })
          .eq('id', context.contactId)

        actions.push({
          action: 'contact_marked_bounced',
          timestamp: new Date().toISOString(),
          details: { bounceType: 'hard', reason: classification.bounceInfo?.bounceReason }
        })

        // Pause active campaigns for this contact
        if (context.campaignId) {
          await this.pauseCampaignForContact(context.campaignId, context.contactId)
          actions.push({
            action: 'campaign_paused_for_contact',
            timestamp: new Date().toISOString(),
            details: { campaignId: context.campaignId }
          })
        }
      } else {
        // Soft bounce - just log it, don't take action yet
        actions.push({
          action: 'soft_bounce_logged',
          timestamp: new Date().toISOString(),
          details: { reason: classification.bounceInfo?.bounceReason }
        })
      }
    }

    return actions
  }

  /**
   * Handle auto-reply emails
   */
  private async handleAutoReply(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<ReplyAction[]> {
    const actions: ReplyAction[] = []

    if (context.contactId) {
      // Update contact with auto-reply information
      const updateData: any = {
        last_contacted_at: new Date().toISOString()
      }

      if (classification.autoReplyInfo?.autoReplyUntil) {
        updateData.auto_reply_until = classification.autoReplyInfo.autoReplyUntil.toISOString()
      }

      await this.supabase
        .from('contacts')
        .update(updateData)
        .eq('id', context.contactId)

      actions.push({
        action: 'contact_auto_reply_recorded',
        timestamp: new Date().toISOString(),
        details: { 
          autoReplyUntil: classification.autoReplyInfo?.autoReplyUntil,
          subtype: classification.subtype
        }
      })

      // Temporarily pause campaigns for this contact if they're away for a while
      if (classification.autoReplyInfo?.autoReplyUntil && context.campaignId) {
        const awayDuration = classification.autoReplyInfo.autoReplyUntil.getTime() - Date.now()
        if (awayDuration > 7 * 24 * 60 * 60 * 1000) { // More than a week
          await this.pauseCampaignForContact(context.campaignId, context.contactId)
          actions.push({
            action: 'campaign_paused_extended_absence',
            timestamp: new Date().toISOString(),
            details: { campaignId: context.campaignId, awayUntil: classification.autoReplyInfo.autoReplyUntil }
          })
        }
      }
    }

    return actions
  }

  /**
   * Handle human replies
   */
  private async handleHumanReply(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<ReplyAction[]> {
    const actions: ReplyAction[] = []

    if (context.contactId) {
      // Update contact engagement
      await this.supabase
        .from('contacts')
        .update({
          last_replied_at: new Date().toISOString(),
          engagement_score: this.supabase.rpc('increment_engagement_score', {
            contact_id: context.contactId,
            increment: classification.sentiment === 'positive' ? 2 : 1
          })
        })
        .eq('id', context.contactId)

      actions.push({
        action: 'contact_engagement_updated',
        timestamp: new Date().toISOString(),
        details: { 
          sentiment: classification.sentiment,
          intent: classification.intent
        }
      })

      // If positive reply, pause campaign to allow for manual follow-up
      if (classification.sentiment === 'positive' && context.campaignId) {
        await this.pauseCampaignForContact(context.campaignId, context.contactId)
        actions.push({
          action: 'campaign_paused_positive_reply',
          timestamp: new Date().toISOString(),
          details: { campaignId: context.campaignId }
        })
      }

      // Create notification for human review if flagged
      if (classification.requiresHumanReview) {
        actions.push({
          action: 'human_review_requested',
          timestamp: new Date().toISOString(),
          details: { reason: 'requires_human_review' }
        })
      }
    }

    return actions
  }

  /**
   * Handle unsubscribe requests
   */
  private async handleUnsubscribe(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<ReplyAction[]> {
    const actions: ReplyAction[] = []

    if (context.contactId) {
      // Mark contact as unsubscribed
      await this.supabase
        .from('contacts')
        .update({
          email_status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString()
        })
        .eq('id', context.contactId)

      actions.push({
        action: 'contact_unsubscribed',
        timestamp: new Date().toISOString(),
        details: { method: 'email_reply' }
      })

      // Stop all active campaigns for this contact
      if (context.campaignId) {
        await this.pauseCampaignForContact(context.campaignId, context.contactId)
        actions.push({
          action: 'all_campaigns_stopped',
          timestamp: new Date().toISOString(),
          details: { contactId: context.contactId }
        })
      }
    }

    return actions
  }

  /**
   * Handle spam complaints
   */
  private async handleSpam(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<ReplyAction[]> {
    const actions: ReplyAction[] = []

    // Log spam for analysis
    actions.push({
      action: 'spam_logged',
      timestamp: new Date().toISOString(),
      details: { confidence: classification.confidence }
    })

    return actions
  }

  /**
   * Pause campaign for a specific contact
   */
  private async pauseCampaignForContact(campaignId: string, contactId: string): Promise<void> {
    // Update campaign progress to pause this contact
    const { error } = await this.supabase
      .from('campaign_contact_progress')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)

    if (error) {
      console.error('❌ Error pausing campaign for contact:', error)
    }
  }

  /**
   * Update reply record with actions taken
   */
  private async updateReplyActions(replyId: string, actions: ReplyAction[]): Promise<void> {
    if (actions.length === 0) return

    const { error } = await this.supabase
      .from('email_replies')
      .update({
        action_taken: actions.map(a => a.action).join(', '),
        action_taken_at: new Date().toISOString()
      })
      .eq('id', replyId)

    if (error) {
      console.error('❌ Error updating reply actions:', error)
    }
  }

  /**
   * Get reply statistics for a user
   */
  async getReplyStats(userId: string, dateFrom?: string): Promise<any> {
    const query = this.supabase
      .from('email_replies')
      .select('reply_type, sentiment, requires_human_review, created_at')
      .eq('user_id', userId)

    if (dateFrom) {
      query.gte('created_at', dateFrom)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching reply stats:', error)
      return {}
    }

    // Calculate statistics
    const stats = {
      total: data?.length || 0,
      by_type: {},
      by_sentiment: {},
      requiring_review: 0
    }

    data?.forEach(reply => {
      // Count by type
      stats.by_type[reply.reply_type] = (stats.by_type[reply.reply_type] || 0) + 1
      
      // Count by sentiment
      if (reply.sentiment) {
        stats.by_sentiment[reply.sentiment] = (stats.by_sentiment[reply.sentiment] || 0) + 1
      }
      
      // Count requiring review
      if (reply.requires_human_review) {
        stats.requiring_review++
      }
    })

    return stats
  }
}

// Export singleton instance
export const replyProcessor = new ReplyProcessor()