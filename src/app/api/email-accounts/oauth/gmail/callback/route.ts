import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { EmailAccountService } from '@/lib/email-providers'
import { GoogleOAuthService, parseOAuthState, validateOAuthState } from '@/lib/oauth-providers'
import { handleApiError, AuthenticationError } from '@/lib/errors'

// GET /api/email-accounts/oauth/gmail/callback - Handle Gmail OAuth callback
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('Gmail OAuth error:', error)
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_cancelled`)
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_invalid`)
    }

    // Validate and parse state parameter
    if (!validateOAuthState(state)) {
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_expired`)
    }

    const { userId, provider } = parseOAuthState(state)
    
    // Verify user matches state
    if (userId !== user.id || provider !== 'gmail') {
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_invalid`)
    }

    // Exchange authorization code for tokens
    const origin = request.nextUrl.origin
    const googleService = new GoogleOAuthService(origin)
    const tokens = await googleService.exchangeCodeForTokens(code)
    
    // Get user information from Google
    const userInfo = await googleService.getUserInfo(tokens.access_token)

    // Check if email account already exists
    const { data: existingAccounts } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', userInfo.email)
      .eq('provider', 'gmail')
      // Note: 'is_active' field doesn't exist in actual schema, using status instead
      .eq('status', 'active')

    if (existingAccounts && existingAccounts.length > 0) {
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=account_exists`)
    }

    // Create email account with OAuth tokens
    const emailService = new EmailAccountService()
    await emailService.createEmailAccount(user.id, {
      provider: 'gmail',
      email: userInfo.email,
      // Note: 'name' field doesn't exist in actual database schema
      oauth_tokens: tokens,
      settings: {
        daily_limit: 50,
        delay_between_emails: 60,
        warm_up_enabled: true,
      },
    })

    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?success=gmail_connected`)
  } catch (error) {
    console.error('Gmail OAuth callback error:', error)
    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_failed`)
  }
}
