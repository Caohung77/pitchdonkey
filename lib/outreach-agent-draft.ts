import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { AIPersonalizationService, PersonalizationRequest, PersonalizationResult } from './ai-providers'
import { getOutreachAgent, type OutreachAgent } from './outreach-agents'

export type Supabase = SupabaseClient<Database>

export interface DraftReplyRequest {
  agentId: string
  emailAccountId: string
  incomingEmailId: string
  threadId: string
  contactId?: string
  incomingSubject: string
  incomingBody: string
  incomingFrom: string
  messageRef?: string
}

export interface DraftReplyResult {
  draftSubject: string
  draftBody: string
  rationale: string
  riskScore: number
  riskFlags: string[]
  confidenceScore: number
  proposedSendAt: Date
  scheduledAt: Date
  editableUntil: Date
  status: 'scheduled' | 'needs_approval'
  replyJobId: string
}

export interface GuardrailViolation {
  flag: string
  severity: 'high' | 'medium' | 'low'
  reason: string
}

/**
 * Service for drafting autonomous email replies using outreach agents
 */
export class OutreachAgentDraftService {
  private supabase: Supabase
  private aiService: AIPersonalizationService

  constructor(supabase: Supabase) {
    this.supabase = supabase
    this.aiService = new AIPersonalizationService()
  }

  /**
   * Draft an autonomous reply for an incoming email
   */
  async draftReply(
    userId: string,
    request: DraftReplyRequest
  ): Promise<DraftReplyResult> {
    console.log(`🤖 Drafting autonomous reply for email from ${request.incomingFrom}`)

    // 1. Load agent and validate configuration
    const agent = await getOutreachAgent(this.supabase, userId, request.agentId)
    if (!agent) {
      throw new Error('Outreach agent not found')
    }

    if (agent.status !== 'active') {
      throw new Error(`Agent "${agent.name}" is not active (status: ${agent.status})`)
    }

    // 2. Load contact data if available
    const contactData = request.contactId
      ? await this.loadContactData(userId, request.contactId)
      : this.extractContactDataFromEmail(request.incomingFrom, request.incomingBody)

    // 3. Generate reply content using AI
    const { draftSubject, draftBody, rationale } = await this.generateReplyContent(
      agent,
      request,
      contactData
    )

    // 4. Apply guardrails and calculate risk score
    const { riskScore, riskFlags, confidenceScore } = await this.evaluateReplyRisk(
      agent,
      draftBody,
      request
    )

    // 5. Calculate optimal send timing
    const { proposedSendAt, scheduledAt, editableUntil } = await this.calculateSendTiming(
      agent,
      riskScore
    )

    // 6. Determine if approval is needed
    const status = this.determineApprovalStatus(riskScore, confidenceScore, agent)

    // 7. Create reply job in database
    const replyJobId = await this.createReplyJob(userId, {
      agentId: request.agentId,
      emailAccountId: request.emailAccountId,
      incomingEmailId: request.incomingEmailId,
      threadId: request.threadId,
      contactId: request.contactId,
      messageRef: request.messageRef,
      draftSubject,
      draftBody,
      rationale,
      riskScore,
      riskFlags,
      confidenceScore,
      proposedSendAt,
      scheduledAt,
      editableUntil,
      status,
    })

    console.log(`✅ Reply drafted: ${status} (risk: ${riskScore.toFixed(2)}, confidence: ${confidenceScore.toFixed(2)})`)

    return {
      draftSubject,
      draftBody,
      rationale,
      riskScore,
      riskFlags,
      confidenceScore,
      proposedSendAt,
      scheduledAt,
      editableUntil,
      status,
      replyJobId,
    }
  }

  /**
   * Generate reply content using AI personalization
   */
  private async generateReplyContent(
    agent: OutreachAgent,
    request: DraftReplyRequest,
    contactData: any
  ): Promise<{ draftSubject: string; draftBody: string; rationale: string }> {
    // Build context-aware prompt for reply generation
    const replyPrompt = this.buildReplyPrompt(agent, request, contactData)

    // Use existing AI personalization service
    const personalizationRequest: PersonalizationRequest = {
      contactData: {
        first_name: contactData.firstName || 'there',
        last_name: contactData.lastName || '',
        company_name: contactData.company,
        job_title: contactData.position,
        industry: contactData.industry,
        custom_fields: contactData.customFields,
      },
      templateContent: replyPrompt.template,
      customPrompt: replyPrompt.customPrompt,
      provider: agent.settings?.ai_provider || 'gemini', // Default to Gemini for reply generation
    }

    let personalizationResult: PersonalizationResult
    try {
      personalizationResult = await this.aiService.personalizeContent(personalizationRequest)
    } catch (error) {
      console.error('❌ AI personalization failed:', error)
      throw new Error(`Failed to generate reply: ${error.message}`)
    }

    // Extract subject and body from generated content
    const { subject, body } = this.parseGeneratedReply(personalizationResult.personalizedContent)

    // Generate rationale for the reply
    const rationale = this.generateRationale(agent, request, personalizationResult)

    return {
      draftSubject: subject,
      draftBody: body,
      rationale,
    }
  }

  /**
   * Build AI prompt for reply generation
   */
  private buildReplyPrompt(
    agent: OutreachAgent,
    request: DraftReplyRequest,
    contactData: any
  ): { template: string; customPrompt: string } {
    // Base template structure
    const template = `Subject: [Your reply subject here]

[Your reply body here]`

    // Build custom prompt with agent context
    const customPrompt = `You are ${agent.sender_name || 'an outreach agent'}${agent.sender_role ? ` (${agent.sender_role})` : ''} from ${agent.company_name || 'our company'}.

**Your Purpose**: ${agent.purpose || 'Building relationships through authentic outreach'}

**Communication Style**: ${agent.tone || 'Professional and friendly'}

**Product Context**: ${agent.product_one_liner || 'Our solution'}
${agent.product_description ? `\n${agent.product_description}` : ''}

${agent.unique_selling_points && agent.unique_selling_points.length > 0 ? `
**Key Benefits**:
${agent.unique_selling_points.map((usp: string) => `- ${usp}`).join('\n')}
` : ''}

**Conversation Goal**: ${agent.conversation_goal || 'Build rapport and provide value'}

**Preferred CTA**: ${agent.preferred_cta || 'Ask for a brief conversation'}

${agent.custom_prompt ? `
**Additional Context**:
${agent.custom_prompt}
` : ''}

**INCOMING EMAIL YOU ARE REPLYING TO**:
From: ${request.incomingFrom}
Subject: ${request.incomingSubject}

${request.incomingBody}

---

**YOUR TASK**:
Write a thoughtful, personalized reply to this email that:
1. Addresses their message directly and specifically
2. Maintains the tone and style described above
3. Uses the product context naturally (don't force it if irrelevant)
4. Moves toward the conversation goal
5. Is concise (2-4 short paragraphs maximum)
6. Feels human and authentic, not like a template
7. ${agent.language === 'de' ? 'MUST be written in German' : 'MUST be written in English'}

Format your response as:
Subject: [subject line]

[reply body]

Do not include any commentary or meta-text. Only output the subject and body.`

    return { template, customPrompt }
  }

  /**
   * Parse generated reply into subject and body
   */
  private parseGeneratedReply(generatedContent: string): { subject: string; body: string } {
    const lines = generatedContent.trim().split('\n')

    // Extract subject
    let subject = 'Re: ' // Default fallback
    const subjectLine = lines.find(line => line.toLowerCase().startsWith('subject:'))
    if (subjectLine) {
      subject = subjectLine.replace(/^subject:\s*/i, '').trim()
    }

    // Extract body (everything after subject line)
    const subjectIndex = lines.findIndex(line => line.toLowerCase().startsWith('subject:'))
    const bodyStartIndex = subjectIndex >= 0 ? subjectIndex + 1 : 0
    const body = lines
      .slice(bodyStartIndex)
      .join('\n')
      .trim()
      .replace(/^\n+/, '') // Remove leading newlines

    return { subject, body }
  }

  /**
   * Generate rationale explaining the reply
   */
  private generateRationale(
    agent: OutreachAgent,
    request: DraftReplyRequest,
    personalizationResult: PersonalizationResult
  ): string {
    return `Autonomous reply generated by agent "${agent.name}" in response to email from ${request.incomingFrom}. ` +
           `Tone: ${agent.tone || 'professional'}. ` +
           `Language: ${agent.language || 'en'}. ` +
           `AI confidence: ${personalizationResult.confidence.toFixed(2)}. ` +
           `Goal: ${agent.conversation_goal || 'Build relationship'}.`
  }

  /**
   * Evaluate reply risk and apply guardrails
   */
  private async evaluateReplyRisk(
    agent: OutreachAgent,
    draftBody: string,
    request: DraftReplyRequest
  ): Promise<{ riskScore: number; riskFlags: string[]; confidenceScore: number }> {
    const violations: GuardrailViolation[] = []
    let riskScore = 0.0
    let confidenceScore = 0.85 // Default confidence

    // Guardrail 1: Length check (too short might be low-quality)
    if (draftBody.length < 100) {
      violations.push({
        flag: 'reply_too_short',
        severity: 'medium',
        reason: 'Reply is unusually short (< 100 characters)',
      })
      riskScore += 0.15
    }

    // Guardrail 2: Length check (too long might be spammy)
    if (draftBody.length > 2000) {
      violations.push({
        flag: 'reply_too_long',
        severity: 'medium',
        reason: 'Reply is unusually long (> 2000 characters)',
      })
      riskScore += 0.15
    }

    // Guardrail 3: Check for spam indicators
    const spamKeywords = ['buy now', 'limited time', 'act fast', 'click here', 'free money', 'guaranteed']
    const hasSpamKeywords = spamKeywords.some(keyword =>
      draftBody.toLowerCase().includes(keyword.toLowerCase())
    )
    if (hasSpamKeywords) {
      violations.push({
        flag: 'spam_keywords_detected',
        severity: 'high',
        reason: 'Reply contains potential spam keywords',
      })
      riskScore += 0.4
    }

    // Guardrail 4: Check for excessive links
    const linkCount = (draftBody.match(/https?:\/\//g) || []).length
    if (linkCount > 3) {
      violations.push({
        flag: 'excessive_links',
        severity: 'medium',
        reason: `Reply contains ${linkCount} links (> 3)`,
      })
      riskScore += 0.2
    }

    // Guardrail 5: Language consistency check
    if (agent.language === 'de') {
      // Simple heuristic: German emails should contain umlauts or common German words
      const germanIndicators = ['der', 'die', 'das', 'und', 'ist', 'ä', 'ö', 'ü', 'ß']
      const hasGermanIndicators = germanIndicators.some(indicator =>
        draftBody.toLowerCase().includes(indicator)
      )
      if (!hasGermanIndicators) {
        violations.push({
          flag: 'language_mismatch',
          severity: 'high',
          reason: 'Reply does not appear to be in German as configured',
        })
        riskScore += 0.3
      }
    }

    // Guardrail 6: Check for incomplete sentences
    if (draftBody.includes('[') || draftBody.includes(']') || draftBody.includes('TODO')) {
      violations.push({
        flag: 'incomplete_content',
        severity: 'high',
        reason: 'Reply appears to contain placeholders or incomplete content',
      })
      riskScore += 0.5
    }

    // Guardrail 7: First contact safety
    if (!request.contactId) {
      violations.push({
        flag: 'unknown_contact',
        severity: 'medium',
        reason: 'No contact record found - this is a first-time interaction',
      })
      riskScore += 0.15
      confidenceScore -= 0.1
    }

    // Clamp risk score between 0 and 1
    riskScore = Math.min(Math.max(riskScore, 0), 1)
    confidenceScore = Math.min(Math.max(confidenceScore, 0), 1)

    const riskFlags = violations.map(v => v.flag)

    return {
      riskScore,
      riskFlags,
      confidenceScore,
    }
  }

  /**
   * Calculate optimal send timing
   */
  private async calculateSendTiming(
    agent: OutreachAgent,
    riskScore: number
  ): Promise<{ proposedSendAt: Date; scheduledAt: Date; editableUntil: Date }> {
    const now = new Date()

    // Base delay: 5-15 minutes for natural response time
    const baseDelayMinutes = 5 + Math.random() * 10

    // Risk-based delay: higher risk = longer delay (more time for review)
    const riskDelayMinutes = riskScore * 30 // Up to 30 extra minutes for high-risk

    // Total delay
    const totalDelayMinutes = baseDelayMinutes + riskDelayMinutes

    const proposedSendAt = new Date(now.getTime() + totalDelayMinutes * 60 * 1000)

    // Check if we have timing optimization data from agent_stats_hourly
    const optimizedSendAt = await this.getOptimizedSendTime(agent.id, proposedSendAt)

    // Use optimized time if available, otherwise use proposed time
    const scheduledAt = optimizedSendAt || proposedSendAt

    // Editable until 2 minutes before send
    const editableUntil = new Date(scheduledAt.getTime() - 2 * 60 * 1000)

    return {
      proposedSendAt,
      scheduledAt,
      editableUntil,
    }
  }

  /**
   * Get optimized send time based on agent statistics
   */
  private async getOptimizedSendTime(agentId: string, proposedTime: Date): Promise<Date | null> {
    // TODO: Implement timing optimization based on agent_stats_hourly
    // For Phase 2, we'll use the proposed time
    // Phase 5 will implement learning-based timing optimization
    return null
  }

  /**
   * Determine if manual approval is needed
   */
  private determineApprovalStatus(
    riskScore: number,
    confidenceScore: number,
    agent: OutreachAgent
  ): 'scheduled' | 'needs_approval' {
    // High-risk threshold for manual approval
    const RISK_THRESHOLD = 0.6

    // Check agent settings for approval requirements
    const requiresApproval = agent.settings?.require_approval_for_all_replies || false

    if (requiresApproval) {
      return 'needs_approval'
    }

    if (riskScore >= RISK_THRESHOLD) {
      return 'needs_approval'
    }

    if (confidenceScore < 0.7) {
      return 'needs_approval'
    }

    return 'scheduled'
  }

  /**
   * Load contact data from database
   */
  private async loadContactData(userId: string, contactId: string): Promise<any> {
    const { data: contact, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('id', contactId)
      .single()

    if (error || !contact) {
      console.warn(`⚠️ Contact ${contactId} not found, using minimal data`)
      return {}
    }

    return {
      firstName: contact.first_name,
      lastName: contact.last_name,
      company: contact.company,
      position: contact.position,
      industry: contact.industry,
      customFields: contact.custom_fields,
    }
  }

  /**
   * Extract contact data from email metadata
   */
  private extractContactDataFromEmail(fromAddress: string, emailBody: string): any {
    // Basic extraction from email address and body
    const emailParts = fromAddress.match(/^(.+?)\s*<(.+?)>$/)
    const name = emailParts ? emailParts[1].trim() : ''
    const [firstName, ...lastNameParts] = name.split(' ')

    return {
      firstName: firstName || 'there',
      lastName: lastNameParts.join(' ') || '',
      company: null,
      position: null,
      industry: null,
      customFields: {},
    }
  }

  /**
   * Create reply job in database
   */
  private async createReplyJob(
    userId: string,
    jobData: {
      agentId: string
      emailAccountId: string
      incomingEmailId: string
      threadId: string
      contactId?: string
      messageRef?: string
      draftSubject: string
      draftBody: string
      rationale: string
      riskScore: number
      riskFlags: string[]
      confidenceScore: number
      proposedSendAt: Date
      scheduledAt: Date
      editableUntil: Date
      status: 'scheduled' | 'needs_approval'
    }
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('reply_jobs')
      .insert({
        user_id: userId,
        agent_id: jobData.agentId,
        email_account_id: jobData.emailAccountId,
        incoming_email_id: jobData.incomingEmailId,
        contact_id: jobData.contactId,
        thread_id: jobData.threadId,
        message_ref: jobData.messageRef,
        draft_subject: jobData.draftSubject,
        draft_body: jobData.draftBody,
        rationale: jobData.rationale,
        risk_score: jobData.riskScore,
        risk_flags: jobData.riskFlags,
        confidence_score: jobData.confidenceScore,
        proposed_send_at: jobData.proposedSendAt.toISOString(),
        scheduled_at: jobData.scheduledAt.toISOString(),
        editable_until: jobData.editableUntil.toISOString(),
        status: jobData.status,
        retry_count: 0,
        audit_log: [],
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ Failed to create reply job:', error)
      throw new Error(`Failed to create reply job: ${error.message}`)
    }

    return data.id
  }
}

// Export singleton factory
export function createDraftService(supabase: Supabase): OutreachAgentDraftService {
  return new OutreachAgentDraftService(supabase)
}
