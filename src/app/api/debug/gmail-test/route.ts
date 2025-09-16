import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const POST = async (request: NextRequest) => {
  // Bypass auth for testing
  const supabase = (await import('@/lib/supabase')).createServerSupabaseClient()
  const user = { id: 'ea1f9972-6109-44ec-93d5-05522f49760c' } // Your user ID for testing
  try {
    console.log('🧪 Debug Gmail Test: Starting comprehensive email test...')

    // Get the Gmail account
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('status', 'active')

    if (accountsError || !accounts || accounts.length === 0) {
      console.log('❌ No active Gmail accounts found')
      return NextResponse.json({
        error: 'No active Gmail accounts found',
        code: 'NO_GMAIL_ACCOUNT'
      }, { status: 400 })
    }

    const account = accounts[0]
    console.log('🧪 Debug Gmail Test: {')
    console.log('  accountId:', account.id)
    console.log('  email:', account.email)
    console.log('  provider:', account.provider)
    console.log('  status:', account.status)
    console.log('  to: banbau@gmx.net')
    console.log('  subject: Gmail IMAP/SMTP Integration Test - ColdReach Pro')
    console.log('  hasTokens:', !!(account.access_token && account.refresh_token))
    console.log('}')

    // Test 1: Verify tokens are valid
    console.log('🔍 Step 1: Verifying OAuth tokens...')
    if (!account.access_token || !account.refresh_token) {
      return NextResponse.json({
        error: 'Missing OAuth tokens',
        code: 'MISSING_TOKENS'
      }, { status: 400 })
    }

    // Test 2: Create Gmail service
    console.log('🔍 Step 2: Creating Gmail service...')
    const { createGmailIMAPSMTPService } = await import('@/lib/gmail-imap-smtp')

    const tokens = {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: new Date(account.token_expires_at).getTime(),
      scope: 'https://mail.google.com/ https://www.googleapis.com/auth/gmail.send',
      token_type: 'Bearer'
    }

    console.log('🔍 Creating service with tokens expiring at:', new Date(tokens.expires_at).toISOString())

    const gmailService = await createGmailIMAPSMTPService(tokens, account.email)
    console.log('✅ Gmail service created successfully')

    // Test 3: Test SMTP connection
    console.log('🔍 Step 3: Testing SMTP connection...')
    const smtpWorking = await gmailService.testSMTPConnection()
    console.log('SMTP Connection:', smtpWorking ? '✅ Working' : '❌ Failed')

    // Test 4: Test IMAP connection
    console.log('🔍 Step 4: Testing IMAP connection...')
    const imapWorking = await gmailService.testIMAPConnection()
    console.log('IMAP Connection:', imapWorking ? '✅ Working' : '❌ Failed')

    if (!smtpWorking && !imapWorking) {
      return NextResponse.json({
        error: 'Both SMTP and IMAP connections failed',
        code: 'CONNECTION_FAILED',
        details: {
          smtp: smtpWorking,
          imap: imapWorking
        }
      }, { status: 500 })
    }

    // Test 5: Send email
    console.log('🔍 Step 5: Sending test email...')
    const emailOptions = {
      to: 'banbau@gmx.net',
      subject: 'Gmail IMAP/SMTP Integration Test - ColdReach Pro',
      text: `Test email sent at ${new Date().toISOString()}

This is a test email to verify Gmail SMTP integration is working correctly.

Account: ${account.email}
Service: Gmail IMAP/SMTP
Timestamp: ${new Date().toISOString()}

If you receive this email, the integration is working!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Gmail IMAP/SMTP Integration Test</h2>
          <p>Test email sent at <strong>${new Date().toISOString()}</strong></p>

          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Test Details:</h3>
            <ul>
              <li><strong>Account:</strong> ${account.email}</li>
              <li><strong>Service:</strong> Gmail IMAP/SMTP</li>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
              <li><strong>SMTP Status:</strong> ${smtpWorking ? '✅ Working' : '❌ Failed'}</li>
              <li><strong>IMAP Status:</strong> ${imapWorking ? '✅ Working' : '❌ Failed'}</li>
            </ul>
          </div>

          <p style="color: #666;">If you receive this email, the Gmail integration is working correctly!</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">
            Sent via ColdReach Pro Gmail Integration Test<br>
            ${new Date().toISOString()}
          </p>
        </div>
      `
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

    // Test 6: Test mailboxes and email reading
    console.log('🔍 Step 6: Testing mailboxes and email reading...')
    if (imapWorking) {
      try {
        const mailboxes = await gmailService.getMailboxes()
        console.log('📂 Available mailboxes:', mailboxes.slice(0, 5)) // Show first 5

        const recentEmails = await gmailService.fetchEmails('INBOX', { limit: 3 })
        console.log('📧 Recent emails:', recentEmails.length, 'emails found')
        console.log('📧 Sample email subjects:', recentEmails.map(e => e.subject).slice(0, 2))
      } catch (emailError) {
        console.error('⚠️ Email reading test failed:', emailError)
      }
    }

    // Test 7: Log to email tracking
    console.log('🔍 Step 7: Logging to email tracking...')
    try {
      await supabase
        .from('email_tracking')
        .insert({
          user_id: user.id,
          email_account_id: account.id,
          recipient_email: 'banbau@gmx.net',
          subject: emailOptions.subject,
          message_id: result.messageId,
          status: 'sent',
          sent_at: new Date().toISOString(),
          is_test: true
        })
      console.log('✅ Email tracking logged successfully')
    } catch (trackingError) {
      console.error('⚠️ Failed to log email tracking:', trackingError)
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      details: {
        messageId: result.messageId,
        from: account.email,
        to: 'banbau@gmx.net',
        subject: emailOptions.subject,
        timestamp: new Date().toISOString(),
        smtpWorking,
        imapWorking,
        response: result.response
      }
    })

  } catch (error) {
    console.error('🚨 Debug Gmail test error:', error)

    return NextResponse.json({
      error: 'Gmail test failed',
      code: 'GMAIL_TEST_FAILED',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}