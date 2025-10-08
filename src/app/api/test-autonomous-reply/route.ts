import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import { createReplyProcessor } from '@/lib/reply-processor'

/**
 * POST /api/test-autonomous-reply
 * Test endpoint to simulate incoming email and autonomous reply generation
 *
 * This creates a fake incoming email and triggers the full autonomous reply workflow
 */
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    console.log('🧪 Test: Simulating autonomous reply workflow for user:', user.id)

    const body = await request.json()
    const {
      email_account_id,
      from_address = 'test@example.com',
      subject = 'Test: Interested in your product',
      body_text = 'Hi, I saw your website and I\'m interested in learning more about your product. Can you provide more information about pricing and features?',
    } = body

    if (!email_account_id) {
      return NextResponse.json({
        error: 'email_account_id is required',
        code: 'MISSING_PARAMETER',
      }, { status: 400 })
    }

    // 1. Get email account details
    const { data: emailAccount, error: accountError } = await supabase
      .from('email_accounts')
      .select('*, assigned_agent:outreach_agents!email_accounts_assigned_agent_id_fkey(*)')
      .eq('id', email_account_id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !emailAccount) {
      return NextResponse.json({
        error: 'Email account not found',
        code: 'NOT_FOUND',
      }, { status: 404 })
    }

    console.log(`📧 Email account: ${emailAccount.email}`)
    console.log(`🤖 Assigned agent: ${emailAccount.assigned_agent?.name || 'None'}`)

    // 2. Create fake incoming email
    const { data: incomingEmail, error: emailError } = await supabase
      .from('incoming_emails')
      .insert({
        user_id: user.id,
        email_account_id: email_account_id,
        message_id: `test-${Date.now()}@example.com`,
        thread_id: `thread-${Date.now()}`,
        from_address: from_address,
        to_address: emailAccount.email,
        subject: subject,
        text_content: body_text,
        html_content: `<p>${body_text}</p>`,
        date_received: new Date().toISOString(),
        attachments: null,
        flags: [],
        classification_status: 'unclassified',
        processing_status: 'pending',
      })
      .select()
      .single()

    if (emailError || !incomingEmail) {
      console.error('❌ Error creating incoming email:', emailError)
      return NextResponse.json({
        error: 'Failed to create incoming email',
        code: 'DATABASE_ERROR',
        details: emailError?.message,
      }, { status: 500 })
    }

    console.log(`✅ Created incoming email: ${incomingEmail.id}`)

    // 3. Process the email through reply processor
    const replyProcessor = createReplyProcessor(supabase)
    const actions = await replyProcessor.processIncomingEmail(incomingEmail)

    console.log(`✅ Processing complete. Actions taken:`, actions.map(a => a.action))

    // 4. Check if autonomous reply was created
    const autonomousDraft = actions.find(a => a.action === 'autonomous_draft_created')

    // 5. Get the reply job if created
    let replyJob = null
    if (autonomousDraft) {
      const { data: job } = await supabase
        .from('reply_jobs')
        .select('*, agent:outreach_agents(name)')
        .eq('incoming_email_id', incomingEmail.id)
        .single()

      replyJob = job
      console.log(`✅ Reply job created: ${replyJob?.id} (status: ${replyJob?.status})`)
    }

    const response = NextResponse.json({
      success: true,
      data: {
        incoming_email: {
          id: incomingEmail.id,
          from: incomingEmail.from_address,
          subject: incomingEmail.subject,
          classification: incomingEmail.classification_status,
        },
        email_account: {
          email: emailAccount.email,
          has_assigned_agent: !!emailAccount.assigned_agent,
          agent_name: emailAccount.assigned_agent?.name,
        },
        processing: {
          actions_taken: actions.map(a => a.action),
          autonomous_draft_created: !!autonomousDraft,
        },
        reply_job: replyJob ? {
          id: replyJob.id,
          status: replyJob.status,
          agent_name: replyJob.agent?.name,
          draft_subject: replyJob.draft_subject,
          scheduled_at: replyJob.scheduled_at,
          risk_score: replyJob.risk_score,
          requires_approval: replyJob.status === 'needs_approval',
        } : null,
        next_steps: replyJob ? [
          'View inbox at /dashboard/inbox',
          replyJob.status === 'needs_approval'
            ? 'Approve reply at /dashboard/scheduled-replies'
            : 'Reply will be sent automatically at scheduled time',
        ] : [
          'No agent assigned to this email account',
          'Assign an agent at /dashboard/email-accounts',
        ],
      },
      message: autonomousDraft
        ? `✅ Autonomous reply drafted! Status: ${replyJob?.status}`
        : emailAccount.assigned_agent
          ? '⚠️ Email processed but no autonomous reply created'
          : '⚠️ No agent assigned to this email account',
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('❌ Error in test endpoint:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})
