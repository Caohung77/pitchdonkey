import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { GoogleOAuthService, generateOAuthState } from '@/lib/oauth-providers'
import { handleApiError, AuthenticationError } from '@/lib/errors'

// GET /api/email-accounts/oauth/gmail - Initiate Gmail OAuth flow
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const googleService = new GoogleOAuthService()
    const state = generateOAuthState(user.id, 'gmail')
    const authUrl = googleService.generateAuthUrl(state)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard/email-accounts?error=oauth_failed`)
  }
}