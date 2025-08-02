import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { SMTPService } from '@/lib/smtp-providers'

// POST /api/email-accounts/test-smtp - Test SMTP configuration
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { host, port, secure, username, password, testEmail } = body

    // Basic validation
    if (!host || !port || !username || !password) {
      return NextResponse.json({
        success: false,
        message: 'Missing required SMTP configuration fields',
      }, { status: 400 })
    }

    // Validate SMTP configuration
    const validation = SMTPService.validateConfig({ host, port, secure, username, password })
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        message: `SMTP configuration invalid: ${validation.errors.join(', ')}`,
      }, { status: 400 })
    }

    // Test SMTP connection
    const connectionTest = await SMTPService.testConnection({
      host,
      port,
      secure,
      username,
      password,
    })

    let testEmailResult = null

    // Send test email if requested and connection is successful
    if (connectionTest.success && testEmail) {
      testEmailResult = await SMTPService.sendTestEmail({
        host,
        port,
        secure,
        username,
        password,
      }, testEmail)
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
    console.error('Error testing SMTP connection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}