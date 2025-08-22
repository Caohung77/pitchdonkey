import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { EmailAccountService } from '@/lib/email-providers'
import { MicrosoftOAuthService, parseOAuthState, validateOAuthState } from '@/lib/oauth-providers'
import { handleApiError, AuthenticationError } from '@/lib/errors'

// GET /api/email-accounts/oauth/outlook/callback - Handle Outlook OAuth callback
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
      console.error('Outlook OAuth error:', error)
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
    if (userId !== user.id || provider !== 'outlook') {
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_invalid`)
    }

    // Exchange authorization code for tokens
    const microsoftService = new MicrosoftOAuthService()
    const tokens = await microsoftService.exchangeCodeForTokens(code)
    
    // Get user information from Microsoft Graph
    const userInfo = await microsoftService.getUserInfo(tokens.access_token)

    // Check if email account already exists
    const { data: existingAccounts } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', userInfo.email)
      .eq('provider', 'outlook')
      .eq('status', 'active') // Note: 'is_active' field doesn't exist in actual schema

    if (existingAccounts && existingAccounts.length > 0) {
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=account_exists`)
    }

    // Create email account with OAuth tokens
    const emailService = new EmailAccountService()
    await emailService.createEmailAccount(user.id, {
      provider: 'outlook',
      email: userInfo.email,
      // Note: 'name' field doesn't exist in actual database schema
      oauth_tokens: tokens,
      settings: {
        daily_limit: 50,
        delay_between_emails: 60,
        warm_up_enabled: true,
      },
    })

    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?success=outlook_connected`)
  } catch (error) {
    console.error('Outlook OAuth callback error:', error)
    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_failed`)
  }
}