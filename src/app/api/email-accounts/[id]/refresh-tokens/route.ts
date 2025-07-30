import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { EmailAccountService } from '@/lib/email-providers'
import { OAuthTokenManager } from '@/lib/oauth-providers'
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors'

// POST /api/email-accounts/[id]/refresh-tokens - Refresh OAuth tokens
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (accountError || !account) {
      throw new NotFoundError('Email account not found')
    }

    // Only OAuth accounts can have tokens refreshed
    if (!account.oauth_tokens) {
      return NextResponse.json({
        success: false,
        message: 'Account does not use OAuth authentication',
      }, { status: 400 })
    }

    // Decrypt current tokens
    const currentTokens = OAuthTokenManager.decryptTokens(account.oauth_tokens)
    
    // Refresh tokens
    const refreshedTokens = await OAuthTokenManager.refreshTokensIfNeeded(
      account.provider as 'gmail' | 'outlook',
      currentTokens
    )

    // Update account with new tokens if they were refreshed
    if (refreshedTokens.access_token !== currentTokens.access_token) {
      const emailService = new EmailAccountService()
      await emailService.updateEmailAccount(params.id, {
        oauth_tokens: refreshedTokens,
      })

      return NextResponse.json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          expires_at: refreshedTokens.expires_at,
          refreshed: true,
        },
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Tokens are still valid',
        data: {
          expires_at: refreshedTokens.expires_at,
          refreshed: false,
        },
      })
    }
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}