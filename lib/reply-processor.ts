import { createServerSupabaseClient } from './supabase-server'
import { emailClassifier, EmailClassificationResult } from './email-classifier'
import { createDraftService } from './outreach-agent-draft'

export interface ReplyProcessingResult {
  processed: number
  successful: number
  failed: number
  errors: string[]
  autonomousDraftsCreated?: number
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
      errors: [],
      autonomousDraftsCreated: 0
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
          const actions = await this.processIncomingEmail(email)
          result.successful++

          // Check if autonomous draft was created
          if (actions.some(action => action.action === 'autonomous_draft_created')) {
            result.autonomousDraftsCreated!++
          }
        } catch (error) {
          result.failed++
          result.errors.push(`Email ${email.id}: ${error.message}`)
          console.error(`❌ Error processing email ${email.id}:`, error)
        }
      }

      console.log(`✅ Processed ${result.successful}/${result.processed} emails successfully (${result.autonomousDraftsCreated} autonomous drafts)`)
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
  async processIncomingEmail(email: any): Promise<ReplyAction[]> {
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

    return actions
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
        // Hard bounce - mark email as invalid and heavily penalize engagement
        const { data: contact } = await this.supabase
          .from('contacts')
          .select('engagement_score, engagement_bounce_count')
          .eq('id', context.contactId)
          .single()

        const currentScore = contact?.engagement_score || 0
        const penaltyScore = Math.max(-100, currentScore - 50) // Reduce by 50 points, minimum -100
        const bounceCount = (contact?.engagement_bounce_count || 0) + 1

        await this.supabase
          .from('contacts')
          .update({
            engagement_status: 'bad', // Mark as bad status for visual indicators
            engagement_score: penaltyScore,
            engagement_bounce_count: bounceCount,
            engagement_updated_at: new Date().toISOString()
          })
          .eq('id', context.contactId)

        actions.push({
          action: 'contact_marked_bounced',
          timestamp: new Date().toISOString(),
          details: {
            bounceType: 'hard',
            reason: classification.bounceInfo?.bounceReason,
            scorePenalty: currentScore - penaltyScore
          }
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
        // Soft bounce - apply smaller penalty, don't mark as bad yet
        const { data: contact } = await this.supabase
          .from('contacts')
          .select('engagement_score')
          .eq('id', context.contactId)
          .single()

        const currentScore = contact?.engagement_score || 0
        const penaltyScore = Math.max(-50, currentScore - 10) // Reduce by 10 points, minimum -50

        await this.supabase
          .from('contacts')
          .update({
            engagement_score: penaltyScore
          })
          .eq('id', context.contactId)

        actions.push({
          action: 'soft_bounce_logged',
          timestamp: new Date().toISOString(),
          details: {
            reason: classification.bounceInfo?.bounceReason,
            scorePenalty: currentScore - penaltyScore
          }
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

    // 🤖 AUTONOMOUS REPLY DRAFTING
    // Check if this email account has an assigned outreach agent
    try {
      const autonomousDraftAction = await this.checkAndDraftAutonomousReply(email, classification, context)
      if (autonomousDraftAction) {
        actions.push(autonomousDraftAction)
      }
    } catch (error) {
      console.error('❌ Error drafting autonomous reply:', error)
      // Don't fail the entire processing if autonomous drafting fails
      actions.push({
        action: 'autonomous_draft_failed',
        timestamp: new Date().toISOString(),
        details: { error: error.message }
      })
    }

    return actions
  }

  /**
   * Check if mailbox has assigned agent and draft autonomous reply
   */
  private async checkAndDraftAutonomousReply(
    email: any,
    classification: EmailClassificationResult,
    context: any
  ): Promise<ReplyAction | null> {
    const accountId = email.email_account_id

    if (!accountId) {
      console.log('⏭️ Incoming email missing email_account_id, skipping autonomous draft')
      return null
    }

    // Find the email account that received this email
    const { data: emailAccount, error: emailAccountError } = await this.supabase
      .from('email_accounts')
      .select('id, email, assigned_persona_id, user_id')
      .eq('id', accountId)
      .eq('user_id', email.user_id)
      .single()

    if (emailAccountError || !emailAccount) {
      console.log('⏭️ No email account found for', email.to_address)
      return null
    }

    // Check if agent is assigned
    if (!emailAccount.assigned_persona_id) {
      console.log('⏭️ No AI persona assigned to mailbox', emailAccount.email)
      return null
    }

    console.log(`🤖 AI Persona ${emailAccount.assigned_persona_id} assigned to ${emailAccount.email} - drafting autonomous reply`)

    // Create draft service
    const draftService = createDraftService(this.supabase)

    // Draft the reply
    try {
      const draftResult = await draftService.draftReply(email.user_id, {
        agentId: emailAccount.assigned_persona_id,
        emailAccountId: emailAccount.id,
        incomingEmailId: email.id,
        threadId: email.thread_id || email.message_id, // Use thread_id if available, fallback to message_id
        contactId: context.contactId,
        incomingSubject: email.subject,
        incomingBody: email.text_content || email.html_content,
        incomingFrom: email.from_address,
        messageRef: email.message_id,
      })

      console.log(`✅ Autonomous draft created: ${draftResult.replyJobId} (status: ${draftResult.status})`)

      return {
        action: 'autonomous_draft_created',
        timestamp: new Date().toISOString(),
        details: {
          replyJobId: draftResult.replyJobId,
          status: draftResult.status,
          riskScore: draftResult.riskScore,
          scheduledAt: draftResult.scheduledAt,
        }
      }
    } catch (error) {
      console.error('❌ Failed to draft autonomous reply:', error)
      throw error
    }
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

// Export factory function for dependency injection
export function createReplyProcessor(supabase: any): ReplyProcessor {
  const processor = new ReplyProcessor()
  processor['supabase'] = supabase // Override the default supabase client
  return processor
}
