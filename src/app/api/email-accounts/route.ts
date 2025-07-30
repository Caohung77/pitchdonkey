import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { EmailAccountService } from '@/lib/email-providers'
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors'
import { z } from 'zod'

const createEmailAccountSchema = z.object({
  provider: z.enum(['gmail', 'outlook', 'smtp']),
  email: z.string().email(),
  name: z.string().optional(),
  smtp_config: z.object({
    host: z.string(),
    port: z.number(),
    secure: z.boolean(),
    username: z.string(),
    password: z.string(),
  }).optional(),
  settings: z.object({
    daily_limit: z.number().min(1).max(1000).optional(),
    delay_between_emails: z.number().min(30).max(3600).optional(),
    warm_up_enabled: z.boolean().optional(),
    signature: z.string().optional(),
  }).optional(),
})

// GET /api/email-accounts - Get user's email accounts
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const emailService = new EmailAccountService()
    const accounts = await emailService.getUserEmailAccounts(user.id)

    return NextResponse.json({
      success: true,
      data: accounts,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}

// POST /api/email-accounts - Create new email account
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const body = await request.json()
    const validatedData = createEmailAccountSchema.parse(body)

    // Check user's plan limits
    const { data: userProfile } = await supabase
      .from('users')
      .select('plan_limits')
      .eq('id', user.id)
      .single()

    const { count: existingAccounts } = await supabase
      .from('email_accounts')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_active', true)

    const maxAccounts = userProfile?.plan_limits?.email_accounts || 1
    if ((existingAccounts || 0) >= maxAccounts) {
      throw new ValidationError('Email account limit reached for your plan')
    }

    const emailService = new EmailAccountService()
    const account = await emailService.createEmailAccount(user.id, validatedData)

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Email account created successfully',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}