import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SMTPService } from '@/lib/smtp-providers'
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors'
import { z } from 'zod'

const testSMTPSchema = z.object({
  host: z.string().min(1, 'SMTP host is required'),
  port: z.number().min(1).max(65535, 'Port must be between 1 and 65535'),
  secure: z.boolean(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  testEmail: z.string().email('Valid test email is required').optional(),
})

// POST /api/email-accounts/test-smtp - Test SMTP configuration
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const body = await request.json()
    const validatedData = testSMTPSchema.parse(body)

    // Validate SMTP configuration
    const validation = SMTPService.validateConfig(validatedData)
    if (!validation.isValid) {
      throw new ValidationError(`SMTP configuration invalid: ${validation.errors.join(', ')}`)
    }

    // Test SMTP connection
    const connectionTest = await SMTPService.testConnection({
      host: validatedData.host,
      port: validatedData.port,
      secure: validatedData.secure,
      username: validatedData.username,
      password: validatedData.password,
    })

    let testEmailResult = null

    // Send test email if requested and connection is successful
    if (connectionTest.success && validatedData.testEmail) {
      testEmailResult = await SMTPService.sendTestEmail({
        host: validatedData.host,
        port: validatedData.port,
        secure: validatedData.secure,
        username: validatedData.username,
        password: validatedData.password,
      }, validatedData.testEmail)
    }

    return NextResponse.json({
      success: true,
      data: {
        connection: connectionTest,
        testEmail: testEmailResult,
      },
      message: connectionTest.success 
        ? 'SMTP configuration test successful'
        : 'SMTP configuration test failed',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}