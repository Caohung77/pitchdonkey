import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createEmailFetchService } from '@/lib/email-fetch-service'
import { addSecurityHeaders } from '@/lib/auth-middleware'

/**
 * POST /api/cron/fetch-emails
 * Cron job to fetch emails from all connected email accounts
 *
 * This endpoint should be called by a cron service (e.g., Ubuntu cron or GitHub Actions)
 * Recommended schedule: Every 5 minutes
 *
 * Security: Uses CRON_SECRET for authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🕐 Cron: Fetch emails triggered')

    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request - invalid or missing CRON_SECRET')
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    // Create Supabase client with service role for cron operations
    const supabase = createServerSupabaseClient()

    // Create email fetch service
    const emailFetchService = createEmailFetchService(supabase)

    // Fetch emails from all accounts
    const result = await emailFetchService.fetchAllAccounts()

    console.log(`✅ Cron: Fetched ${result.totalNewEmails} new emails from ${result.successfulAccounts}/${result.totalAccounts} accounts`)

    if (result.errors.length > 0) {
      console.error('⚠️ Cron: Errors occurred during email fetch:', result.errors)
    }

    const response = NextResponse.json({
      success: true,
      data: {
        totalAccounts: result.totalAccounts,
        successfulAccounts: result.successfulAccounts,
        failedAccounts: result.failedAccounts,
        totalNewEmails: result.totalNewEmails,
        results: result.results,
        errors: result.errors,
      },
      message: `Fetched ${result.totalNewEmails} new emails from ${result.successfulAccounts}/${result.totalAccounts} accounts`,
      timestamp: new Date().toISOString(),
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('❌ Cron: Error fetching emails:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

/**
 * GET /api/cron/fetch-emails
 * Health check endpoint for the email fetch cron job
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    // Get stats about email accounts
    const supabase = createServerSupabaseClient()

    // Count active email accounts by provider
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('provider, is_verified')
      .eq('is_verified', true)

    if (error) {
      console.error('Error fetching email account stats:', error)
    }

    const accountsByProvider = accounts?.reduce((acc, account) => {
      acc[account.provider] = (acc[account.provider] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Count recent incoming emails (last 24 hours)
    const { data: recentEmails, error: recentError } = await supabase
      .from('incoming_emails')
      .select('id')
      .gte('date_received', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const response = NextResponse.json({
      status: 'healthy',
      endpoint: '/api/cron/fetch-emails',
      stats: {
        active_accounts: accounts?.length || 0,
        accounts_by_provider: accountsByProvider,
        last_24h_emails: recentEmails?.length || 0,
      },
      timestamp: new Date().toISOString(),
      cron_secret_configured: !!cronSecret,
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error in cron health check:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
