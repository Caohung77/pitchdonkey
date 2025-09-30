import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { extractDomainFromEmail } from '@/lib/domain-auth'

// GET /api/email-accounts - Get user's email accounts
export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('GET /api/email-accounts called for user:', user.id)
    
    // Apply rate limiting
    await withRateLimit(user, 60, 60000) // 60 requests per minute
    
    console.log('Rate limiting passed, fetching email accounts...')
    
    // Get user's email accounts from database (exclude soft-deleted accounts)
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    console.log('Database query result:', { accounts: accounts?.length || 0, error })

    if (error) {
      console.error('Database error fetching email accounts:', error)
      return NextResponse.json({
        error: 'Failed to fetch email accounts',
        code: 'FETCH_ERROR',
        details: error.message
      }, { status: 500 })
    }

    // All accounts are already filtered at the database level
    const safe = accounts || []

    // Add domain field to each account by extracting from email
    const accountsWithDomain = safe.map(account => {
      try {
        const domain = extractDomainFromEmail(account.email)
        return {
          ...account,
          domain
        }
      } catch (error) {
        console.warn(`Failed to extract domain from email ${account.email}:`, error)
        return {
          ...account,
          domain: null
        }
      }
    })

    console.log('Successfully fetched email accounts with domains, returning response')

    const response = NextResponse.json({
      success: true,
      data: accountsWithDomain,
    })
    
    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Unexpected error in GET /api/email-accounts:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

// POST /api/email-accounts - Create new email account
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('POST /api/email-accounts called for user:', user.id)
    
    // Apply rate limiting - more restrictive for write operations
    await withRateLimit(user, 10, 60000) // 10 requests per minute for creation
    
    const body = await request.json()
    console.log('Request body:', body)
    const { provider, email, name, smtp_config } = body

    // Basic validation
    if (!provider || !email) {
      return NextResponse.json({
        error: 'Provider and email are required',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        error: 'Invalid email format',
        code: 'VALIDATION_ERROR'
      }, { status: 400 })
    }

    // Check for duplicate email accounts (excluding soft-deleted accounts)
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', email)
      .is('deleted_at', null)
      .single()

    if (existingAccount) {
      return NextResponse.json({
        error: 'Email account already exists',
        code: 'DUPLICATE_ACCOUNT'
      }, { status: 409 })
    }

    // Extract domain from email address for domain auth integration
    let domain: string | undefined
    try {
      domain = extractDomainFromEmail(email)
    } catch (error) {
      console.error('Failed to extract domain from email:', error)
      // Continue without domain if extraction fails
    }

    // Prepare account data matching actual database schema (supabase-setup.sql)
    const accountData = {
      user_id: user.id,
      provider,
      email,
      domain, // Add domain field for domain auth integration
      // Note: 'name' field doesn't exist in actual database schema
      // All other fields have defaults, so we only need to provide what we have
    }

    // For SMTP, validate and store configuration in individual columns
    if (smtp_config && provider === 'smtp') {
      console.log('SMTP config provided, validating...')
      
      // Basic SMTP validation
      if (!smtp_config.host || !smtp_config.port || !smtp_config.username || !smtp_config.password) {
        return NextResponse.json({
          error: 'SMTP configuration missing required fields (host, port, username, password)',
          code: 'VALIDATION_ERROR'
        }, { status: 400 })
      }

      // Validate port number
      const port = parseInt(smtp_config.port)
      if (isNaN(port) || port < 1 || port > 65535) {
        return NextResponse.json({
          error: 'SMTP port must be a valid number between 1 and 65535',
          code: 'VALIDATION_ERROR'
        }, { status: 400 })
      }

      // Store SMTP config in individual columns (matching supabase-setup.sql schema)
      accountData.smtp_host = smtp_config.host
      accountData.smtp_port = port
      accountData.smtp_username = smtp_config.username
      accountData.smtp_password = smtp_config.password
      accountData.smtp_secure = smtp_config.secure || false
      
      console.log('SMTP port validation:', {
        original: smtp_config.port,
        parsed: port,
        isValid: !isNaN(port) && port >= 1 && port <= 65535
      })
      
      console.log('SMTP config validated and prepared for storage:', { 
        host: smtp_config.host, 
        port: smtp_config.port, 
        username: smtp_config.username,
        secure: smtp_config.secure,
        password: '[HIDDEN]' 
      })
    }

    console.log('Attempting to insert account data:', { 
      ...accountData, 
      smtp_password: accountData.smtp_password ? '[HIDDEN]' : undefined,
      fields: Object.keys(accountData).join(', ')
    })

    // Log each field's type and value for debugging
    console.log('Field analysis:')
    Object.entries(accountData).forEach(([key, value]) => {
      console.log(`  ${key}: ${typeof value} = ${value}`)
      if (typeof value === 'number' && !Number.isFinite(value)) {
        console.error(`  ⚠️  ${key} has invalid number value: ${value}`)
      }
    })

    // Clean the account data to remove any undefined values and problematic fields
    // Let the database handle default values for reputation tracking fields
    const fieldsToExclude = ['reputation_score', 'bounce_rate', 'complaint_rate', 'daily_send_limit']
    const cleanAccountData = Object.fromEntries(
      Object.entries(accountData).filter(([key, value]) =>
        value !== undefined && !fieldsToExclude.includes(key)
      )
    )

    // Initialize email tracking counters from the start
    cleanAccountData.total_emails_sent = 0
    cleanAccountData.current_daily_sent = 0
    cleanAccountData.warmup_current_week = 1
    cleanAccountData.warmup_current_daily_limit = 5
    
    console.log('Clean account data for insertion:', {
      ...cleanAccountData,
      smtp_password: cleanAccountData.smtp_password ? '[HIDDEN]' : undefined
    })

    const { data: account, error } = await supabase
      .from('email_accounts')
      .insert(cleanAccountData)
      .select()
      .single()

    console.log('Insert result:', { account: account ? 'SUCCESS' : 'NO_DATA', error })

    if (error) {
      console.error('Database error creating email account:', error)
      return NextResponse.json({
        error: 'Failed to create email account',
        code: 'CREATE_ERROR',
        details: error.message
      }, { status: 500 })
    }

    console.log('Email account created successfully')

    const response = NextResponse.json({
      success: true,
      data: account,
      message: 'Email account created successfully'
    }, { status: 201 })
    
    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error creating email account:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})
