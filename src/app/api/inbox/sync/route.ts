import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { imapMonitor } from '@/lib/imap-monitor'

// POST /api/inbox/sync - Force IMAP sync for user's email accounts
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 10, 60000) // 10 sync requests per minute

    const body = await request.json()
    const { emailAccountId } = body

    if (emailAccountId && emailAccountId !== 'all') {
      // Verify the email account belongs to the user
      const { data: account, error } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('id', emailAccountId)
        .eq('user_id', user.id)
        .single()

      if (error || !account) {
        return NextResponse.json({
          success: false,
          error: 'Email account not found or access denied',
          code: 'NOT_FOUND'
        }, { status: 404 })
      }

      // Force sync specific account
      try {
        const result = await imapMonitor.forceSyncAccount(emailAccountId)
        
        const response = NextResponse.json({
          success: true,
          message: 'Account sync completed successfully',
          data: result
        })

        return addSecurityHeaders(response)
      } catch (syncError) {
        console.error('Force sync error:', syncError)
        return NextResponse.json({
          success: false,
          error: syncError.message || 'Failed to sync account',
          code: 'SYNC_ERROR'
        }, { status: 500 })
      }
    } else {
      // Run general monitoring cycle
      try {
        await imapMonitor.runMonitoringCycle()
        
        const response = NextResponse.json({
          success: true,
          message: 'IMAP monitoring cycle completed successfully'
        })

        return addSecurityHeaders(response)
      } catch (syncError) {
        console.error('IMAP cycle error:', syncError)
        return NextResponse.json({
          success: false,
          error: syncError.message || 'Failed to run IMAP sync cycle',
          code: 'SYNC_ERROR'
        }, { status: 500 })
      }
    }

  } catch (error) {
    console.error('Error in inbox sync API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})