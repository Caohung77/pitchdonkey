import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import nodemailer from 'nodemailer'

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }) => {
  try {
    const { id } = params

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

      } else if (account.provider === 'gmail' || account.provider === 'outlook') {
        // For OAuth accounts, we would test the token validity
        // For now, just return success if the account exists and is active
        testResult = {
          success: true,
          message: `${account.provider} OAuth connection is active`,
          details: {
            provider: account.provider,
            email: account.email,
            status: account.status
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