import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import nodemailer from 'nodemailer'

const stripHtml = (input: string) => input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }) => {
  try {
    const { id } = await params
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

    let htmlBodyForStorage = ''
    const plainTextBodyForStorage = stripHtml(message || '')

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

        htmlBodyForStorage = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
            </div>
          `

        const info = await transporter.sendMail({
          from: `"Eisbrief" <${account.email}>`,
          to,
          subject,
          text: message,
          html: htmlBodyForStorage
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

      } else if (account.provider === 'gmail') {
        // Use Gmail API for sending
        console.log('📧 Gmail send-test: Starting email send process...')
        console.log('📧 Account details:', {
          id: account.id,
          email: account.email,
          provider: account.provider,
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          tokenExpiry: account.token_expires_at
        })

        const { createGmailIMAPSMTPService } = await import('@/lib/server/gmail-imap-smtp-server')

        const tokens = {
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: new Date(account.token_expires_at).getTime(),
          scope: 'https://mail.google.com/ https://www.googleapis.com/auth/gmail.send',
          token_type: 'Bearer'
        }

        console.log('📧 Creating Gmail service with tokens expiring at:', new Date(tokens.expires_at).toISOString())
        const gmailService = await createGmailIMAPSMTPService(tokens, account.email)
        console.log('✅ Gmail service created successfully')

        htmlBodyForStorage = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Test Email from Eisbrief</h2>
              <div style="white-space: pre-wrap; padding: 20px; background: #f9f9f9; border-radius: 8px; margin: 20px 0;">
                ${message.replace(/\n/g, '<br>')}
              </div>
              <p style="color: #666; font-size: 12px;">Dieses E-Mail wurde über die Gmail IMAP/SMTP Integration gesendet.</p>
            </div>
          `

        const emailOptions = {
          to,
          subject,
          text: message,
          html: htmlBodyForStorage
        }

        console.log('📧 Sending email with options:', {
          to: emailOptions.to,
          subject: emailOptions.subject,
          hasText: !!emailOptions.text,
          hasHtml: !!emailOptions.html
        })

        const result = await gmailService.sendEmail(emailOptions)

        console.log('📧 Send result:', {
          messageId: result.messageId,
          response: result.response?.substring(0, 100) + '...'
        })

        sendResult = {
          success: true,
          message: 'Test email sent successfully via Gmail API',
          messageId: result.messageId || `gmail-${Date.now()}`,
          from: account.email,
          to,
          details: {
            provider: 'gmail',
            service: 'Gmail IMAP/SMTP',
            result
          }
        }

      } else if (account.provider === 'outlook') {
        // For Outlook OAuth, we would use Microsoft Graph API
        // For now, return a mock success response
        sendResult = {
          success: true,
          message: `Test email would be sent via Outlook OAuth`,
          messageId: `mock-${Date.now()}@outlook.com`,
          from: account.email,
          to,
          details: {
            provider: account.provider,
            note: 'Outlook OAuth email sending not yet implemented'
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

      if (sendResult.success) {
        try {
          const fallbackMessageId = sendResult.messageId || `manual-${Date.now()}`
          await supabase
            .from('outgoing_emails')
            .insert({
              user_id: user.id,
              email_account_id: account.id,
              message_id: fallbackMessageId,
              from_address: account.email,
              to_address: to,
              subject,
              text_content: plainTextBodyForStorage || message,
              html_content: htmlBodyForStorage || message,
              date_sent: new Date().toISOString()
            })
        } catch (outgoingError: any) {
          console.error('⚠️ Failed to insert sent email into outgoing_emails:', outgoingError)
        }
      }

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
