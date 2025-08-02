import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/email-accounts - Get user's email accounts
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's email accounts from database
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching email accounts:', error)
      return NextResponse.json({ error: 'Failed to fetch email accounts' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: accounts || [],
    })
  } catch (error) {
    console.error('Error fetching email accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/email-accounts - Create new email account
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, email, name, smtp_config } = body

    // Basic validation
    if (!provider || !email) {
      return NextResponse.json({
        success: false,
        message: 'Provider and email are required',
      }, { status: 400 })
    }

    // Check user's plan limits (simplified for now)
    const { count: existingAccounts } = await supabase
      .from('email_accounts')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)

    const maxAccounts = 3 // Default limit, can be made dynamic based on user plan
    if ((existingAccounts || 0) >= maxAccounts) {
      return NextResponse.json({
        success: false,
        message: 'Email account limit reached for your plan',
      }, { status: 400 })
    }

    // Extract domain from email for domain verification
    const domain = email.split('@')[1]

    // Create email account record matching the actual database schema
    const accountData = {
      user_id: user.id,
      provider,
      email,
      status: 'pending',
      domain,
      daily_send_limit: 50,
      warmup_enabled: true,
      reputation_score: 9.99, // Set to max allowed value for precision(3,2)
      bounce_rate: 0.0000,
      complaint_rate: 0.0000,
      // Store SMTP config if provided
      ...(smtp_config && {
        smtp_host: smtp_config.host,
        smtp_port: smtp_config.port,
        smtp_username: smtp_config.username,
        smtp_password: smtp_config.password, // In production, this should be encrypted
        smtp_secure: smtp_config.secure,
      }),
    }

    const { data: account, error } = await supabase
      .from('email_accounts')
      .insert(accountData)
      .select()
      .single()

    if (error) {
      console.error('Error creating email account:', error)
      return NextResponse.json({
        success: false,
        message: 'Failed to create email account',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Email account created successfully',
    })
  } catch (error) {
    console.error('Error creating email account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}