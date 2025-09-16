import { NextRequest, NextResponse } from 'next/server'
import { OAUTH_PROVIDERS } from '@/lib/oauth-providers'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  return NextResponse.json({
    googleOAuth: {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      clientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
      clientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
      clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) || 'missing',
      scopes: OAUTH_PROVIDERS.gmail.scopes,
      expectedRedirectUri: `${origin}/api/email-accounts/oauth/gmail/callback`,
      authUrl: OAUTH_PROVIDERS.gmail.authUrl
    }
  })
}