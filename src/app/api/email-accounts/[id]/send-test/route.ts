import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import nodemailer from 'nodemailer'

// POST /api/email-accounts/[id]/send-test - Send a test email
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, message } = body

    // Basic validation
    if (!to || !subject || !message) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: to, subject, message'
      }, { status: 400 })
    }

    // Verify account ownership and get account details
    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    // Check if account has SMTP configuration
    if (!account.smtp_host || !account.smtp_port || !account.smtp_username || !account.smtp_password) {
      return NextResponse.json({
        success: false,
        error: 'SMTP configuration incomplete'
      }, { status: 400 })
    }

    try {
      // Create transporter
      const transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_secure,
        auth: {
          user: account.smtp_username,
          pass: account.smtp_password,
        },
      })

      // Send test email
      const info = await transporter.sendMail({
        from: `"${account.email}" <${account.email}>`,
        to: to,
        subject: subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Test Email from ColdReach Pro</h2>
            <p style="color: #666; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
              This is a test email sent from ColdReach Pro using ${account.email}<br>
              Sent via: ${account.smtp_host}:${account.smtp_port}
            </p>
          </div>
        `
      })

      return NextResponse.json({
        success: true,
        data: {
          messageId: info.messageId,
          from: account.email,
          to: to,
          subject: subject,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response
        },
        message: 'Test email sent successfully!'
      })
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      return NextResponse.json({
        success: false,
        error: 'Failed to send email',
        details: emailError instanceof Error ? emailError.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}