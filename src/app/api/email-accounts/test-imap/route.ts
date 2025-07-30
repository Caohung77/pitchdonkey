import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { IMAPService } from '@/lib/smtp-providers'
import { handleApiError, AuthenticationError } from '@/lib/errors'
import { z } from 'zod'

const testIMAPSchema = z.object({
  host: z.string().min(1, 'IMAP host is required'),
  port: z.number().min(1).max(65535, 'Valid port number required'),
  secure: z.boolean(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

// POST /api/email-accounts/test-imap - Test IMAP connection
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const body = await request.json()
    const validatedData = testIMAPSchema.parse(body)

    // Test IMAP connection
    const connectionResult = await IMAPService.testConnection({
      host: validatedData.host,
      port: validatedData.port,
      secure: validatedData.secure,
      username: validatedData.username,
      password: validatedData.password,
    })

    if (!connectionResult.success) {
      return NextResponse.json({
        success: false,
        message: connectionResult.message,
        details: connectionResult.details,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'IMAP connection test successful',
      data: connectionResult,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}