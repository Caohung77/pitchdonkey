import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SMTP_PROVIDERS, SMTPService } from '@/lib/smtp-providers'
import { handleApiError, AuthenticationError } from '@/lib/errors'

// GET /api/email-accounts/smtp-providers - Get SMTP provider templates
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('provider')

    if (providerId) {
      // Get specific provider
      const provider = SMTPService.getProviderTemplate(providerId)
      if (!provider) {
        return NextResponse.json({
          success: false,
          message: 'Provider not found',
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: provider,
      })
    } else {
      // Get all providers
      return NextResponse.json({
        success: true,
        data: SMTP_PROVIDERS,
      })
    }
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}

// POST /api/email-accounts/smtp-providers/detect - Detect provider from host
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const body = await request.json()
    const { host } = body

    if (!host || typeof host !== 'string') {
      return NextResponse.json({
        success: false,
        message: 'Host parameter is required',
      }, { status: 400 })
    }

    const detectedProvider = SMTPService.detectProvider(host)

    return NextResponse.json({
      success: true,
      data: {
        detected: !!detectedProvider,
        provider: detectedProvider,
      },
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}