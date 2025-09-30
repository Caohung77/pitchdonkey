import { NextRequest, NextResponse } from 'next/server'
import { EmailAccountService } from '@/lib/email-providers'
import { GoogleOAuthService, parseOAuthState, validateOAuthState } from '@/lib/oauth-providers'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/email-accounts/oauth/gmail/callback - Handle Gmail OAuth callback
export const GET = withAuth(async (request: NextRequest, { user }) => {

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

    console.log('📧 Gmail OAuth Callback:', {
      userId,
      provider,
      userIdMatch: userId === user.id,
      validProvider: provider === 'gmail' || provider === 'gmail-imap-smtp'
    })

    // Verify user matches state (accept both gmail and gmail-imap-smtp)
    if (userId !== user.id || (provider !== 'gmail' && provider !== 'gmail-imap-smtp')) {
      console.error('❌ OAuth validation failed:', { userId, expectedUserId: user.id, provider })
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_invalid`)
    }

    // Exchange authorization code for tokens
    const origin = request.nextUrl.origin
    const googleService = new GoogleOAuthService(origin)
    const tokens = await googleService.exchangeCodeForTokens(code)
    
    // Get user information from Google
    const userInfo = await googleService.getUserInfo(tokens.access_token)

    // Check if email account already exists for this provider type
    const { createServerSupabaseClient } = await import('@/lib/supabase-server')
    const supabase = createServerSupabaseClient()

    // Note: Use 'gmail' for both gmail and gmail-imap-smtp since DB constraint only allows 'gmail'
    const dbProvider = provider === 'gmail-imap-smtp' ? 'gmail' : provider

    const { data: existingAccounts } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', userInfo.email)
      .eq('provider', dbProvider) // Use the DB-compatible provider
      // Note: 'is_active' field doesn't exist in actual schema, using status instead
      .eq('status', 'active')

    if (existingAccounts && existingAccounts.length > 0) {
      return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=account_exists`)
    }

    // Create email account with OAuth tokens using server-side client to bypass RLS

    const accountData = {
      user_id: user.id,
      provider: dbProvider,
      email: userInfo.email,
      status: 'pending',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at).toISOString(),
      // Initialize email tracking counters from the start
      total_emails_sent: 0,
      current_daily_sent: 0,
      warmup_current_week: 1,
      warmup_current_daily_limit: 5,
      // Store additional metadata for gmail-imap-smtp accounts
      ...(provider === 'gmail-imap-smtp' && {
        daily_send_limit: 100, // Higher limit for IMAP/SMTP accounts
      })
    }

    console.log('💾 Creating email account:', {
      userId: user.id,
      originalProvider: provider,
      dbProvider: dbProvider,
      email: userInfo.email,
      expiresAt: tokens.expires_at,
      expiryDate: new Date(tokens.expires_at).toISOString()
    })

    console.log('📝 Account data being inserted:', JSON.stringify(accountData, null, 2))

    const { data: newAccount, error: insertError } = await supabase
      .from('email_accounts')
      .insert(accountData)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create email account:', insertError)
      throw new Error(`Failed to create email account: ${insertError.message}`)
    }

    console.log('✅ Successfully created email account:', newAccount.id)

    const successType = provider === 'gmail-imap-smtp' ? 'gmail_imap_smtp_connected' : 'gmail_connected'
    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?success=${successType}`)
})
