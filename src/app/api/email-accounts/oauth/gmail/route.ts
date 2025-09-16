import { NextRequest, NextResponse } from 'next/server'
import { GoogleOAuthService, generateOAuthState } from '@/lib/oauth-providers'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/email-accounts/oauth/gmail - Initiate Gmail OAuth flow
export const GET = withAuth(async (request: NextRequest, { user }) => {
  const origin = request.nextUrl.origin
  const { searchParams } = new URL(request.url)

  // Get provider type from query parameter (defaults to 'gmail')
  const providerType = searchParams.get('provider') || 'gmail'

  // Validate provider type
  if (providerType !== 'gmail' && providerType !== 'gmail-imap-smtp') {
    return NextResponse.redirect(`${origin}/dashboard/email-accounts?error=invalid_provider`)
  }

  // Validate configuration before redirecting to Google
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Gmail OAuth is not configured: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET')
    return NextResponse.redirect(`${origin}/dashboard/email-accounts?error=oauth_failed`)
  }

  try {
    const googleService = new GoogleOAuthService(origin)
    const state = generateOAuthState(user.id, providerType)
    const authUrl = googleService.generateAuthUrl(state)

    console.log('📧 Gmail OAuth Request:', {
      origin,
      providerType,
      redirectUri: `${origin}/api/email-accounts/oauth/gmail/callback`,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      scopes: 'gmail.send gmail.readonly gmail.modify userinfo.email userinfo.profile',
      state: state.substring(0, 20) + '...', // Show partial state for debugging
      authUrl: authUrl.substring(0, 150) + '...' // Show partial URL
    })

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('❌ Failed to generate OAuth URL:', error)
    return NextResponse.redirect(`${origin}/dashboard/email-accounts?error=oauth_failed`)
  }
})
