import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { EmailAccountService } from '@/lib/email-providers'
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors'

// POST /api/email-accounts/[id]/test - Test email account connection
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

    // Verify account ownership
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!account) {
      throw new NotFoundError('Email account not found')
    }

    const emailService = new EmailAccountService()
    const testResult = await emailService.testEmailConnection(params.id)

    return NextResponse.json({
      success: true,
      data: testResult,
      message: 'Connection test completed',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}