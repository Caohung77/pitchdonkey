import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { z } from 'zod'

const assignAgentSchema = z.object({
  agent_id: z.string().uuid().nullable()
})

/**
 * PUT /api/email-accounts/[id]/assign-agent
 * Assign an outreach agent to handle replies for this mailbox
 *
 * @body { agent_id: string | null } - UUID of agent to assign, or null for manual mode
 * @returns Updated email account with assigned_agent_id
 */
export const PUT = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    console.log('PUT /api/email-accounts/[id]/assign-agent called for user:', user.id)

    // Apply rate limiting
    await withRateLimit(user, 20, 60000) // 20 updates per minute

    const { id: emailAccountId } = await params
    const body = await request.json()

    // Validate input
    const validationResult = assignAgentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    const { agent_id } = validationResult.data

    console.log('Assigning agent', agent_id, 'to email account', emailAccountId)

    // Verify email account exists and belongs to user
    const { data: emailAccount, error: fetchError } = await supabase
      .from('email_accounts')
      .select('id, user_id, email, provider')
      .eq('id', emailAccountId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !emailAccount) {
      console.error('Email account not found:', fetchError)
      return NextResponse.json({
        error: 'Email account not found',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    // If agent_id is provided, verify it exists and belongs to user
    if (agent_id) {
      const { data: agent, error: agentError } = await supabase
        .from('ai_personas' as any)
        .select('id, user_id, name, status')
        .eq('id', agent_id)
        .eq('user_id', user.id)
        .single()

      if (agentError || !agent) {
        console.error('Agent not found:', agentError)
        return NextResponse.json({
          error: 'Outreach agent not found',
          code: 'NOT_FOUND'
        }, { status: 404 })
      }

      // Warn if agent is not active
      if (agent.status !== 'active') {
        console.warn(`Assigning non-active agent (${agent.status}): ${agent.name}`)
      }
    }

    // Update email account with assigned agent
    const { data: updatedAccount, error: updateError } = await supabase
      .from('email_accounts')
      .update({
        assigned_persona_id: agent_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', emailAccountId)
      .eq('user_id', user.id)
      .select(`
        *,
        assigned_agent_id:assigned_persona_id,
        assigned_agent:ai_personas!email_accounts_assigned_persona_id_fkey(
          id,
          name,
          status,
          language,
          tone,
          purpose
        )
      `)
      .single()

    if (updateError) {
      console.error('Failed to update email account:', updateError)
      return NextResponse.json({
        error: 'Failed to assign agent to mailbox',
        code: 'UPDATE_ERROR',
        details: updateError.message
      }, { status: 500 })
    }

    console.log(`Successfully ${agent_id ? 'assigned' : 'unassigned'} agent for mailbox:`, emailAccount.email)

    const response = NextResponse.json({
      success: true,
      data: updatedAccount,
      message: agent_id
        ? `Agent assigned successfully. Replies to ${emailAccount.email} will be handled autonomously.`
        : `Agent unassigned. Replies to ${emailAccount.email} will require manual handling.`
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in assign-agent endpoint:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

/**
 * GET /api/email-accounts/[id]/assign-agent
 * Get current agent assignment for this mailbox
 *
 * @returns Email account with assigned agent details
 */
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await withRateLimit(user, 100, 60000) // 100 requests per minute

    const { id: emailAccountId } = await params

    const { data: emailAccount, error } = await supabase
      .from('email_accounts')
      .select(`
        *,
        assigned_agent_id:assigned_persona_id,
        assigned_agent:ai_personas!email_accounts_assigned_persona_id_fkey(
          id,
          name,
          status,
          language,
          tone,
          purpose,
          last_used_at,
          created_at
        )
      `)
      .eq('id', emailAccountId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          error: 'Email account not found',
          code: 'NOT_FOUND'
        }, { status: 404 })
      }

      console.error('Error fetching email account:', error)
      return NextResponse.json({
        error: 'Failed to fetch email account',
        code: 'FETCH_ERROR'
      }, { status: 500 })
    }

    const response = NextResponse.json({
      success: true,
      data: emailAccount
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error fetching agent assignment:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})
