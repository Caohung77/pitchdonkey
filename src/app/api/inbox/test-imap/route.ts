import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { imapProcessor } from '@/lib/imap-processor'

// POST /api/inbox/test-imap - Test IMAP connection for debugging
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 5, 60000) // 5 tests per minute

    const body = await request.json()
    const { emailAccountId } = body

    if (!emailAccountId) {
      return NextResponse.json({
        success: false,
        error: 'Email account ID is required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    // Get the email account
    const { data: account, error } = await supabase
      .from('email_accounts')
      .select(`
        id,
        email,
        provider,
        imap_host,
        imap_port,
        imap_username,
        imap_password,
        imap_secure
      `)
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

    // Test IMAP connection
    const imapConfig = {
      host: account.imap_host || 'imap.gmail.com',
      port: account.imap_port || 993,
      tls: account.imap_secure !== false,
      user: account.imap_username || account.email,
      password: account.imap_password || ''
    }

    console.log('Testing IMAP connection for:', account.email)
    const testResult = await imapProcessor.testConnection(imapConfig)

    const response = NextResponse.json({
      success: true,
      account: {
        email: account.email,
        provider: account.provider,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls
      },
      test_result: testResult
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error testing IMAP connection:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})