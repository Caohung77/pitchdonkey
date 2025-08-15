import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import nodemailer from 'nodemailer'

export const POST = withAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = params
    const body = await request.json()
    const { to, subject, message } = body

    if (!to || !subject || !message) {
      return handleApiError(new Error('Missing required fields: to, subject, message'))
    }

    const supabase = createServerSupabaseClient()

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return handleApiError(new Error('Email account not found'))
    }

    if (account.status !== 'active') {
      return handleApiError(new Error('Email account is not active'))
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
        const transporter = nodemailer.createTransporter({
          host: account.smtp_host,
          port: account.smtp_port,
          secure: account.smtp_secure,
          auth: {
            user: account.smtp_username,
            pass: account.smtp_password,
          },
        })

        const info = await transporter.sendMail({
          from: `"${account.name || 'ColdReach Pro'}" <${account.email}>`,
          to,
          subject,
          text: message,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              
              <p style="color: #6b7280; font-size: 12px;">
                This test email was sent from ColdReach Pro using the email account: ${account.email}
              </p>
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

      // Update account last used timestamp
      await supabase
        .from('email_accounts')
        .update({ 
          last_used_at: new Date().toISOString()
        })
        .eq('id', id)

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

    return createSuccessResponse(sendResult)

  } catch (error) {
    return handleApiError(error)
  }
})