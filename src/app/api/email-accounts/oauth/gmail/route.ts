import { NextRequest, NextResponse } from 'next/server'
import { GoogleOAuthService, generateOAuthState } from '@/lib/oauth-providers'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/email-accounts/oauth/gmail - Initiate Gmail OAuth flow
export const GET = withAuth(async (request: NextRequest, { user }) => {
  const origin = request.nextUrl.origin
  const googleService = new GoogleOAuthService(origin)
  const state = generateOAuthState(user.id, 'gmail')
  const authUrl = googleService.generateAuthUrl(state)
  return NextResponse.redirect(authUrl)
})
