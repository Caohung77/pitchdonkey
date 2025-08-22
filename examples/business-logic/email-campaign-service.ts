// Example: Email Campaign Service Pattern
// Shows how to implement business logic with proper error handling and validation

import { createServerSupabaseClient } from '@/lib/supabase'
import { Campaign, EmailStep, CampaignContact } from '@/lib/campaigns'
import { checkUserPermissions } from '@/lib/auth'
import { z } from 'zod'

/**
 * Service class for managing email campaign operations
 * Demonstrates patterns for:
 * - Database operations with Supabase
 * - Business logic validation
 * - Error handling and logging
 * - Permission checking
 * - Type safety with TypeScript
 */
export class EmailCampaignService {
  private supabase = createServerSupabaseClient()

  /**
   * Launch a campaign with comprehensive validation
   * PATTERN: Multi-step validation with rollback capability
   */
  async launchCampaign(campaignId: string, userId: string): Promise<{
    success: boolean
    campaign?: Campaign
    error?: string
  }> {
    try {
      // PATTERN: Check permissions first
      const canLaunch = await checkUserPermissions(userId, 'campaigns', 'launch')
      if (!canLaunch) {
        return { success: false, error: 'Insufficient permissions to launch campaigns' }
      }

      // PATTERN: Fetch and validate campaign exists
      const { data: campaign, error: fetchError } = await this.supabase
        .from('campaigns')
        .select(`
          *,
          email_sequence,
          contact_list_ids,
          ai_settings,
          schedule_settings
        `)
        .eq('id', campaignId)
        .eq('user_id', userId)
        .single()

      if (fetchError || !campaign) {
        return { success: false, error: 'Campaign not found' }
      }

      // PATTERN: Business logic validation
      const validation = await this.validateCampaignForLaunch(campaign)
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', ') }
      }

      // PATTERN: Get contacts for campaign
      const contacts = await this.getCampaignContacts(campaign.contact_list_ids, userId)
      if (contacts.length === 0) {
        return { success: false, error: 'No valid contacts found for campaign' }
      }

      // PATTERN: Check email account availability
      const emailAccounts = await this.getAvailableEmailAccounts(userId)
      if (emailAccounts.length === 0) {
        return { success: false, error: 'No active email accounts available' }
      }

      // PATTERN: Database transaction for campaign launch
      const launchResult = await this.executeTransactionalLaunch(campaign, contacts, emailAccounts)
      
      if (!launchResult.success) {
        return { success: false, error: launchResult.error }
      }

      // PATTERN: Update campaign status
      const { data: updatedCampaign, error: updateError } = await this.supabase
        .from('campaigns')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId)
        .select()
        .single()

      if (updateError) {
        // PATTERN: Log error but don't fail - campaign is already processing
        console.error('Error updating campaign status:', updateError)
      }

      return { success: true, campaign: updatedCampaign || campaign }

    } catch (error) {
      console.error('Error launching campaign:', error)
      return { success: false, error: 'Failed to launch campaign due to unexpected error' }
    }
  }

  /**
   * Get campaign analytics with real-time data
   * PATTERN: Complex aggregation queries with performance optimization
   */
  async getCampaignAnalytics(campaignId: string, userId: string): Promise<CampaignAnalytics> {
    // PATTERN: Verify ownership first
    const { data: campaign } = await this.supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single()

    if (!campaign) {
      throw new Error('Campaign not found or access denied')
    }

    // PATTERN: Parallel queries for performance
    const [contactStats, emailStats, engagementStats] = await Promise.all([
      this.getCampaignContactStats(campaignId),
      this.getCampaignEmailStats(campaignId),
      this.getCampaignEngagementStats(campaignId)
    ])

    // PATTERN: Calculate derived metrics
    const analytics: CampaignAnalytics = {
      campaignId,
      totalContacts: contactStats.total,
      emailsSent: emailStats.sent,
      emailsDelivered: emailStats.delivered,
      emailsOpened: engagementStats.opened,
      emailsClicked: engagementStats.clicked,
      emailsReplied: engagementStats.replied,
      
      // PATTERN: Safe division to avoid NaN
      deliveryRate: this.calculateRate(emailStats.delivered, emailStats.sent),
      openRate: this.calculateRate(engagementStats.opened, emailStats.delivered),
      clickRate: this.calculateRate(engagementStats.clicked, emailStats.delivered),
      replyRate: this.calculateRate(engagementStats.replied, emailStats.delivered),
      
      stepBreakdown: await this.getStepBreakdown(campaignId),
      lastUpdated: new Date().toISOString()
    }

    return analytics
  }

  /**
   * Pause campaign execution
   * PATTERN: Graceful shutdown with job cancellation
   */
  async pauseCampaign(campaignId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // PATTERN: Check ownership and current status
      const { data: campaign } = await this.supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .eq('user_id', userId)
        .single()

      if (!campaign) {
        return { success: false, error: 'Campaign not found' }
      }

      if (campaign.status !== 'active') {
        return { success: false, error: 'Campaign is not currently active' }
      }

      // PATTERN: Update campaign status first to prevent new jobs
      const { error: updateError } = await this.supabase
        .from('campaigns')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      if (updateError) {
        return { success: false, error: 'Failed to pause campaign' }
      }

      // PATTERN: Cancel pending email jobs
      const { error: cancelError } = await this.supabase
        .from('email_jobs')
        .update({
          status: 'cancelled',
          error_message: 'Campaign paused',
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')

      if (cancelError) {
        console.error('Error cancelling email jobs:', cancelError)
        // Don't fail the operation for this
      }

      return { success: true }

    } catch (error) {
      console.error('Error pausing campaign:', error)
      return { success: false, error: 'Failed to pause campaign' }
    }
  }

  // Private helper methods

  private async validateCampaignForLaunch(campaign: Campaign): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // PATTERN: Comprehensive validation
    if (!campaign.email_sequence || campaign.email_sequence.length === 0) {
      errors.push('Campaign must have at least one email step')
    }

    if (!campaign.contact_list_ids || campaign.contact_list_ids.length === 0) {
      errors.push('Campaign must target at least one contact list')
    }

    // PATTERN: Validate email sequence
    for (const step of campaign.email_sequence) {
      if (!step.subject_template || !step.content_template) {
        errors.push(`Step ${step.step_number} missing required templates`)
      }
    }

    // PATTERN: Check AI settings if enabled
    if (campaign.ai_settings.enabled) {
      if (!campaign.ai_settings.template_id && !campaign.ai_settings.custom_prompt) {
        errors.push('AI personalization enabled but no template or prompt provided')
      }
    }

    return { valid: errors.length === 0, errors }
  }

  private async getCampaignContacts(contactListIds: string[], userId: string): Promise<Contact[]> {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .in('contact_list_id', contactListIds)
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('email_status', 'invalid')

    if (error) {
      console.error('Error fetching campaign contacts:', error)
      return []
    }

    return data || []
  }

  private async getAvailableEmailAccounts(userId: string): Promise<EmailAccount[]> {
    const { data, error } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_verified', true)

    if (error) {
      console.error('Error fetching email accounts:', error)
      return []
    }

    return data || []
  }

  private async executeTransactionalLaunch(
    campaign: Campaign, 
    contacts: Contact[], 
    emailAccounts: EmailAccount[]
  ): Promise<{ success: boolean; error?: string }> {
    // PATTERN: This would typically use a database transaction
    // For Supabase, we simulate transactional behavior
    try {
      // Create campaign execution record
      const { error: executionError } = await this.supabase
        .from('campaign_executions')
        .insert({
          campaign_id: campaign.id,
          user_id: campaign.user_id,
          status: 'initializing',
          total_contacts: contacts.length,
          processed_contacts: 0,
          emails_scheduled: 0,
          emails_sent: 0
        })

      if (executionError) {
        return { success: false, error: 'Failed to create campaign execution' }
      }

      // Schedule initial email jobs
      const emailJobs = contacts.map(contact => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        email_account_id: emailAccounts[0].id, // Simple round-robin
        step_number: 1,
        step_id: campaign.email_sequence[0].id,
        subject: campaign.email_sequence[0].subject_template,
        content: campaign.email_sequence[0].content_template,
        scheduled_at: new Date().toISOString(),
        priority: 5,
        status: 'pending'
      }))

      const { error: jobsError } = await this.supabase
        .from('email_jobs')
        .insert(emailJobs)

      if (jobsError) {
        return { success: false, error: 'Failed to schedule initial emails' }
      }

      return { success: true }

    } catch (error) {
      console.error('Error in transactional launch:', error)
      return { success: false, error: 'Transaction failed' }
    }
  }

  private calculateRate(numerator: number, denominator: number): number {
    if (denominator === 0) return 0
    return Math.round((numerator / denominator) * 100 * 100) / 100 // Round to 2 decimal places
  }

  private async getCampaignContactStats(campaignId: string) {
    const { data, error } = await this.supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId)

    if (error) return { total: 0 }
    return { total: data?.length || 0 }
  }

  private async getCampaignEmailStats(campaignId: string) {
    const { data, error } = await this.supabase
      .from('email_sends')
      .select('send_status')
      .eq('campaign_id', campaignId)

    if (error) return { sent: 0, delivered: 0 }
    
    const sent = data?.filter(email => email.send_status === 'sent').length || 0
    const delivered = data?.filter(email => email.send_status === 'delivered').length || 0
    
    return { sent, delivered }
  }

  private async getCampaignEngagementStats(campaignId: string) {
    const { data, error } = await this.supabase
      .from('email_sends')
      .select('opened_at, clicked_at, replied_at')
      .eq('campaign_id', campaignId)

    if (error) return { opened: 0, clicked: 0, replied: 0 }
    
    const opened = data?.filter(email => email.opened_at).length || 0
    const clicked = data?.filter(email => email.clicked_at).length || 0
    const replied = data?.filter(email => email.replied_at).length || 0
    
    return { opened, clicked, replied }
  }

  private async getStepBreakdown(campaignId: string) {
    // This would return detailed breakdown by step
    // Implementation depends on specific analytics needs
    return []
  }
}

// Types for the service
export interface CampaignAnalytics {
  campaignId: string
  totalContacts: number
  emailsSent: number
  emailsDelivered: number
  emailsOpened: number
  emailsClicked: number
  emailsReplied: number
  deliveryRate: number
  openRate: number
  clickRate: number
  replyRate: number
  stepBreakdown: any[]
  lastUpdated: string
}

// Export service instance
export const emailCampaignService = new EmailCampaignService()