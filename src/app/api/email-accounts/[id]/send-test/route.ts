import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import nodemailer from 'nodemailer'

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }) => {
  try {
    const { id } = params
    const body = await request.json()
    const { to, subject, message } = body

    if (!to || !subject || !message) {
      return NextResponse.json({
        error: 'Missing required fields: to, subject, message',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({
        error: 'Email account not found',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    if (account.status !== 'active') {
      return NextResponse.json({
        error: 'Email account is not active',
        code: 'ACCOUNT_INACTIVE'
      }, { status: 400 })
    }

    let sendResult = {
      success: false,
      message: '',
      messageId: null,
      from: account.email,
      to,
      details: null
    }

    try {
      if (account.provider === 'smtp') {
        // Send via SMTP
        const transporter = nodemailer.createTransport({
          host: account.smtp_host,
          port: account.smtp_port,
          secure: account.smtp_secure,
          auth: {
            user: account.smtp_username,
            pass: account.smtp_password,
          },
        })

        const info = await transporter.sendMail({
          from: `"ColdReach Pro" <${account.email}>`,
          to,
          subject,
          text: message,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
            </div>
          `
        })

        sendResult = {
          success: true,
          message: 'Test email sent successfully via SMTP',
          messageId: info.messageId,
          from: account.email,
          to,
          details: {
            provider: 'smtp',
            host: account.smtp_host,
            port: account.smtp_port
          }
        }

      } else if (account.provider === 'gmail' || account.provider === 'outlook') {
        // For OAuth providers, we would use their respective APIs
        // For now, return a mock success response
        sendResult = {
          success: true,
          message: `Test email would be sent via ${account.provider} OAuth`,
          messageId: `mock-${Date.now()}@${account.provider}.com`,
          from: account.email,
          to,
          details: {
            provider: account.provider,
            note: 'OAuth email sending not yet implemented'
          }
        }

      } else {
        throw new Error(`Unsupported provider: ${account.provider}`)
      }

      // Log the test email send
      await supabase
        .from('email_tracking')
        .insert({
          user_id: user.id,
          email_account_id: account.id,
          recipient_email: to,
          subject,
          message_id: sendResult.messageId,
          status: 'sent',
          sent_at: new Date().toISOString(),
          is_test: true
        })

      // Note: last_used_at field doesn't exist in the schema
      // This functionality can be added later if needed

    } catch (error) {
      sendResult = {
        success: false,
        message: `Failed to send test email: ${error.message}`,
        messageId: null,
        from: account.email,
        to,
        details: {
          provider: account.provider,
          error: error.code || 'UNKNOWN_ERROR'
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: sendResult
    })

  } catch (error) {
    console.error('Send test email error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})