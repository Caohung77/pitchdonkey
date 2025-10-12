import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

/**
 * GET /api/inbox
 * Get incoming emails with optional reply job information
 */
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    console.log('GET /api/inbox called for user:', user.id)

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const classification = searchParams.get('classification')
    const includeReplyJobs = searchParams.get('include_reply_jobs') === 'true'

    // Build query
    let query = supabase
      .from('incoming_emails')
      .select(`
        *,
        email_account:email_accounts!incoming_emails_email_account_id_fkey(
          email,
          assigned_agent_id:assigned_persona_id,
          assigned_agent:ai_personas!email_accounts_assigned_persona_id_fkey(name)
        )
        ${
          includeReplyJobs
            ? ',reply_job:reply_jobs!reply_jobs_incoming_email_id_fkey(id, status, draft_subject, scheduled_at, agent:ai_personas!reply_jobs_agent_id_fkey(name))'
            : ''
        }
      `)
      .eq('user_id', user.id)
      .order('date_received', { ascending: false })
      .limit(limit)

    // Apply classification filter
    if (classification && classification !== 'all') {
      query = query.eq('classification_status', classification)
    }

    const { data: emails, error } = await query

    if (error) {
      console.error('Error fetching inbox:', error)
      return NextResponse.json({
        error: 'Failed to fetch inbox',
        code: 'FETCH_ERROR',
        details: error.message,
      }, { status: 500 })
    }

    // Transform reply_job from array to single object (if exists)
    const transformedEmails = emails?.map(email => ({
      ...email,
      reply_job: Array.isArray(email.reply_job) && email.reply_job.length > 0
        ? email.reply_job[0]
        : null
    }))

    const response = NextResponse.json({
      success: true,
      data: {
        emails: transformedEmails || [],
        count: transformedEmails?.length || 0,
      },
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in GET /api/inbox:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})
