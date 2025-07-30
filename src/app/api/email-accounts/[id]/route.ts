import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { EmailAccountService } from '@/lib/email-providers'
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors'
import { z } from 'zod'

const updateEmailAccountSchema = z.object({
  name: z.string().optional(),
  settings: z.object({
    daily_limit: z.number().min(1).max(1000).optional(),
    delay_between_emails: z.number().min(30).max(3600).optional(),
    warm_up_enabled: z.boolean().optional(),
    signature: z.string().optional(),
  }).optional(),
  is_active: z.boolean().optional(),
})

// GET /api/email-accounts/[id] - Get specific email account
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error || !account) {
      throw new NotFoundError('Email account not found')
    }

    return NextResponse.json({
      success: true,
      data: account,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}

// PUT /api/email-accounts/[id] - Update email account
export async function PUT(
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
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existingAccount) {
      throw new NotFoundError('Email account not found')
    }

    const body = await request.json()
    const validatedData = updateEmailAccountSchema.parse(body)

    const emailService = new EmailAccountService()
    const account = await emailService.updateEmailAccount(params.id, validatedData)

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Email account updated successfully',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}

// DELETE /api/email-accounts/[id] - Delete email account
export async function DELETE(
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
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existingAccount) {
      throw new NotFoundError('Email account not found')
    }

    const emailService = new EmailAccountService()
    await emailService.deleteEmailAccount(params.id)

    return NextResponse.json({
      success: true,
      message: 'Email account deleted successfully',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}