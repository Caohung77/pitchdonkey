import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

// GET /api/inbox/email-accounts - Get user's email accounts for inbox filter
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 100, 60000) // 100 requests per minute

    // Get user's email accounts with outreach agent info
    // Try both outreach_agent_id and assigned_agent_id
    const { data: emailAccounts, error } = await supabase
      .from('email_accounts')
      .select(`
        id,
        email,
        provider,
        status,
        deleted_at,
        outreach_agent_id,
        assigned_agent_id:assigned_persona_id,
        outreach_agents_via_outreach:ai_personas!email_accounts_outreach_agent_id_fkey (
          id,
          name,
          sender_name
        ),
        outreach_agents_via_assigned:ai_personas!email_accounts_assigned_persona_id_fkey (
          id,
          name,
          sender_name
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('email', { ascending: true })

    if (error) {
      console.error('Error fetching email accounts:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch email accounts',
        code: 'FETCH_ERROR'
      }, { status: 500 })
    }

    console.log('📧 Email accounts from DB:', JSON.stringify(emailAccounts, null, 2))

    const response = NextResponse.json({
      success: true,
      emailAccounts: emailAccounts || []
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error in email accounts API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})
