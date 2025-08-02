import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import nodemailer from 'nodemailer'

// POST /api/email-accounts/[id]/test - Test email account connection
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

    // Test SMTP connection
    if (account.smtp_host && account.smtp_port && account.smtp_username && account.smtp_password) {
      try {
        const transporter = nodemailer.createTransport({
          host: account.smtp_host,
          port: account.smtp_port,
          secure: account.smtp_secure,
          auth: {
            user: account.smtp_username,
            pass: account.smtp_password,
          },
        })

        // Verify the connection
        await transporter.verify()

        return NextResponse.json({
          success: true,
          data: {
            message: 'SMTP connection successful',
            host: account.smtp_host,
            port: account.smtp_port,
            secure: account.smtp_secure,
          },
        })
      } catch (error) {
        console.error('SMTP connection test failed:', error)
        return NextResponse.json({
          success: false,
          error: 'SMTP connection failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 400 })
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'SMTP configuration incomplete',
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error testing email account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}