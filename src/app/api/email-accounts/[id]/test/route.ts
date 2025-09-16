import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import nodemailer from 'nodemailer'

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }) => {
  try {
    const { id } = await params

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

    let testResult = {
      success: false,
      message: '',
      details: null
    }

    try {
      if (account.provider === 'smtp') {
        // Test SMTP connection
        const transporter = nodemailer.createTransport({
          host: account.smtp_host,
          port: account.smtp_port,
          secure: account.smtp_secure,
          auth: {
            user: account.smtp_username,
            pass: account.smtp_password,
          },
          connectionTimeout: 10000,
          greetingTimeout: 5000,
          socketTimeout: 10000,
        })

        await transporter.verify()
        
        testResult = {
          success: true,
          message: 'SMTP connection test successful',
          details: {
            provider: 'smtp',
            host: account.smtp_host,
            port: account.smtp_port,
            secure: account.smtp_secure,
            email: account.email
          }
        }

      } else if (account.provider === 'gmail') {
        // Test Gmail OAuth connection by verifying tokens and API access
        const { GoogleOAuthService } = await import('@/lib/oauth-providers')
        const googleService = new GoogleOAuthService()

        // Test connection using the OAuth service
        const isValid = await googleService.testConnection({
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: new Date(account.token_expires_at).getTime(),
          scope: 'https://mail.google.com/ https://www.googleapis.com/auth/gmail.send',
          token_type: 'Bearer'
        })

        if (!isValid) {
          throw new Error('Gmail OAuth tokens are invalid or expired')
        }

        // Additionally test Gmail IMAP/SMTP service if available
        try {
          const { createGmailIMAPSMTPService } = await import('@/lib/server/gmail-imap-smtp-server')

          const gmailService = await createGmailIMAPSMTPService({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: new Date(account.token_expires_at).getTime(),
            scope: 'https://mail.google.com/ https://www.googleapis.com/auth/gmail.send',
            token_type: 'Bearer'
          }, account.email)

          // Test basic Gmail API access by getting user profile
          const profile = await gmailService.testConnection()

          testResult = {
            success: true,
            message: 'Gmail OAuth and IMAP/SMTP connection test successful',
            details: {
              provider: 'gmail',
              email: account.email,
              status: account.status,
              tokenValid: true,
              gmailApiAccess: true,
              profileTest: profile
            }
          }
        } catch (gmailError) {
          // If IMAP/SMTP test fails, still consider OAuth valid if token test passed
          testResult = {
            success: true,
            message: 'Gmail OAuth connection valid, IMAP/SMTP test failed',
            details: {
              provider: 'gmail',
              email: account.email,
              status: account.status,
              tokenValid: true,
              gmailApiAccess: false,
              error: gmailError.message
            }
          }
        }

      } else if (account.provider === 'outlook') {
        // For Outlook OAuth, we would test the token validity with Microsoft Graph
        // For now, just return success if the account exists and is active
        testResult = {
          success: true,
          message: `Outlook OAuth connection is active (full test not implemented)`,
          details: {
            provider: account.provider,
            email: account.email,
            status: account.status,
            note: 'Outlook OAuth connection testing not yet fully implemented'
          }
        }

      } else {
        throw new Error(`Unsupported provider: ${account.provider}`)
      }

      // Update account status based on test result
      await supabase
        .from('email_accounts')
        .update({ 
          status: testResult.success ? 'active' : 'error'
        })
        .eq('id', id)

    } catch (error) {
      testResult = {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: {
          provider: account.provider,
          email: account.email,
          error: error.code || 'UNKNOWN_ERROR'
        }
      }

      // Update status to error
      await supabase
        .from('email_accounts')
        .update({ 
          status: 'error'
        })
        .eq('id', id)
    }

    return NextResponse.json({
      success: true,
      data: testResult
    })

  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})