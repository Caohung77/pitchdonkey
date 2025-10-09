import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createDraftService } from '@/lib/outreach-agent-draft'
import { z } from 'zod'

const draftReplySchema = z.object({
  email_account_id: z.string().uuid(),
  incoming_email_id: z.string().uuid(),
  thread_id: z.string().min(1),
  contact_id: z.string().uuid().nullish(),
  incoming_subject: z.string().min(1),
  incoming_body: z.string().min(1),
  incoming_from: z.string().email(),
  message_ref: z.string().nullish(),
})

/**
 * POST /api/outreach-agents/[id]/draft-reply
 * Generate an autonomous reply draft for an incoming email
 *
 * @body { email_account_id, incoming_email_id, thread_id, incoming_subject, incoming_body, incoming_from, ... }
 * @returns Draft reply with risk assessment and scheduling details
 */
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    console.log('POST /api/outreach-agents/[agentId]/draft-reply called for user:', user.id)

    // Apply rate limiting (max 30 draft requests per minute)
    await withRateLimit(user, 30, 60000)

    const { agentId } = await params
    const body = await request.json()

    // Validate input
    const validationResult = draftReplySchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Draft reply validation error:', validationResult.error.flatten())
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.flatten(),
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

  const {
    email_account_id,
    incoming_email_id,
    thread_id,
    contact_id,
    incoming_subject,
    incoming_body,
    incoming_from,
    message_ref,
  } = validationResult.data

    console.log(`Drafting reply for agent ${agentId} to email from ${incoming_from}`)

    // Verify agent exists and belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('outreach_agents')
      .select('id, user_id, name, status')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      console.error('Agent not found:', agentError)
      return NextResponse.json({
        error: 'Outreach agent not found',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    if (agent.status !== 'active') {
      return NextResponse.json({
        error: `Agent "${agent.name}" is not active (status: ${agent.status})`,
        code: 'AGENT_INACTIVE'
      }, { status: 400 })
    }

    // Verify email account exists and belongs to user
    const { data: emailAccount, error: emailAccountError } = await supabase
      .from('email_accounts')
      .select('id, user_id, email, assigned_agent_id')
      .eq('id', email_account_id)
      .eq('user_id', user.id)
      .single()

    if (emailAccountError || !emailAccount) {
      console.error('Email account not found:', emailAccountError)
      return NextResponse.json({
        error: 'Email account not found',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    // Verify agent is assigned to this mailbox
    if (emailAccount.assigned_agent_id !== agentId) {
      return NextResponse.json({
        error: `Agent "${agent.name}" is not assigned to mailbox ${emailAccount.email}`,
        code: 'AGENT_NOT_ASSIGNED'
      }, { status: 403 })
    }

    // Verify incoming email exists
    const { data: incomingEmail, error: incomingEmailError } = await supabase
      .from('incoming_emails')
      .select('id, user_id')
      .eq('id', incoming_email_id)
      .eq('user_id', user.id)
      .single()

    if (incomingEmailError || !incomingEmail) {
      console.error('Incoming email not found:', incomingEmailError)
      return NextResponse.json({
        error: 'Incoming email not found',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    // If contact_id provided, verify it exists and belongs to user
    if (contact_id) {
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, user_id')
        .eq('id', contact_id)
        .eq('user_id', user.id)
        .single()

      if (contactError || !contact) {
        console.warn(`⚠️ Contact ${contact_id} not found, proceeding without contact data`)
      }
    }

    // Create draft service
    const draftService = createDraftService(supabase)

    // Generate draft reply
    const draftResult = await draftService.draftReply(user.id, {
      agentId,
      emailAccountId: email_account_id,
      incomingEmailId: incoming_email_id,
      threadId: thread_id,
      contactId: contact_id || undefined,
      incomingSubject: incoming_subject,
      incomingBody: incoming_body,
      incomingFrom: incoming_from,
      messageRef: message_ref || undefined,
    })

    console.log(`✅ Draft reply created: ${draftResult.replyJobId} (status: ${draftResult.status})`)

    const response = NextResponse.json({
      success: true,
      data: {
        reply_job_id: draftResult.replyJobId,
        draft_subject: draftResult.draftSubject,
        draft_body: draftResult.draftBody,
        rationale: draftResult.rationale,
        risk_score: draftResult.riskScore,
        risk_flags: draftResult.riskFlags,
        confidence_score: draftResult.confidenceScore,
        proposed_send_at: draftResult.proposedSendAt.toISOString(),
        scheduled_at: draftResult.scheduledAt.toISOString(),
        editable_until: draftResult.editableUntil.toISOString(),
        status: draftResult.status,
      },
      message: draftResult.status === 'needs_approval'
        ? 'Draft created and pending manual approval (high risk score)'
        : `Draft created and scheduled for ${draftResult.scheduledAt.toLocaleString()}`
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in draft-reply endpoint:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})
