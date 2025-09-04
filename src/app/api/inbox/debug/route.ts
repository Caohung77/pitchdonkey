import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

// GET /api/inbox/debug - Debug IMAP connection status
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 20, 60000) // 20 requests per minute

    // Get user's email accounts
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select(`
        id,
        email,
        provider,
        status,
        imap_host,
        imap_port,
        imap_username,
        imap_secure
      `)
      .eq('user_id', user.id)

    // Get IMAP connections
    const { data: imapConnections, error: connectionsError } = await supabase
      .from('imap_connections')
      .select(`
        id,
        email_account_id,
        status,
        last_sync_at,
        next_sync_at,
        sync_interval_minutes,
        last_error
      `)
      .eq('user_id', user.id)

    // Get recent incoming emails count
    const { data: recentEmails, count: emailCount } = await supabase
      .from('incoming_emails')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    const response = NextResponse.json({
      success: true,
      debug: {
        user_id: user.id,
        email_accounts: {
          count: emailAccounts?.length || 0,
          accounts: emailAccounts || [],
          error: accountsError?.message
        },
        imap_connections: {
          count: imapConnections?.length || 0,
          connections: imapConnections || [],
          error: connectionsError?.message
        },
        recent_emails: {
          count: emailCount || 0,
          error: null
        }
      }
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error in inbox debug API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})