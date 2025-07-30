import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SMTP_PROVIDER_TEMPLATES, getRecommendedSettings } from '@/lib/smtp-providers'
import { handleApiError, AuthenticationError } from '@/lib/errors'

// GET /api/email-accounts/smtp-templates - Get SMTP provider templates
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const providerId = searchParams.get('provider')

    // If specific provider requested
    if (providerId) {
      const template = SMTP_PROVIDER_TEMPLATES.find(t => t.id === providerId)
      if (!template) {
        return NextResponse.json({
          success: false,
          message: 'Provider template not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: template
      })
    }

    // If email provided, get recommended settings
    if (email) {
      const recommended = getRecommendedSettings(email)
      
      return NextResponse.json({
        success: true,
        data: {
          recommended,
          all: SMTP_PROVIDER_TEMPLATES
        }
      })
    }

    // Return all templates
    return NextResponse.json({
      success: true,
      data: SMTP_PROVIDER_TEMPLATES
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}