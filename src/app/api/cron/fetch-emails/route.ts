import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { addSecurityHeaders } from '@/lib/auth-middleware'

// Import the working sync function from manual sync endpoint
async function syncEmailAccount(supabase: any, accountId: string) {
  const syncModule = await import('@/app/api/inbox/sync/route')
  // The sync function is not exported, so we need to call the endpoint logic directly
  // For now, we'll import the IMAPProcessor which has the working logic
  const { IMAPProcessor } = await import('@/lib/imap-processor')
  const { GmailIMAPSMTPServerService } = await import('@/lib/server/gmail-imap-smtp-server')

  // Get account details
  const { data: account, error: accountError } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (accountError || !account) {
    throw new Error('Account not found')
  }

  // Use Gmail OAuth sync for Gmail accounts (WORKING CODE from manual sync)
  if (account.provider === 'gmail' && account.access_token) {
    const gmailService = new GmailIMAPSMTPServerService()

    // Fetch emails using working Gmail sync logic
    const [inboxEmails] = await Promise.all([
      gmailService.fetchGmailEmails(account.id, 'INBOX', { unseen: false })
    ])

    let newEmailsCount = 0
    const errors: string[] = []
    const newEmailIds: string[] = []

    for (const email of inboxEmails) {
      try {
        // Skip self-sent emails
        const isFromSelf = email.from && email.from.toLowerCase().includes(account.email.toLowerCase())
        if (isFromSelf) continue

        // Check if exists
        const { data: existing } = await supabase
          .from('incoming_emails')
          .select('id')
          .eq('gmail_message_id', email.gmailMessageId)
          .eq('user_id', account.user_id)
          .maybeSingle()

        if (existing) continue

        // Insert with null-safety (CRITICAL FIX)
        const { data: inserted, error: insertError } = await supabase
          .from('incoming_emails')
          .insert({
            user_id: account.user_id,
            email_account_id: account.id,
            message_id: email.messageId || `missing-${Date.now()}`,
            gmail_message_id: email.gmailMessageId || null,
            from_address: email.from || 'unknown@unknown.com',
            to_address: email.to || account.email,
            subject: email.subject || '(No Subject)',
            date_received: email.date || new Date().toISOString(),
            text_content: email.textBody || null,
            html_content: email.htmlBody || null,
            processing_status: 'pending',
            classification_status: 'unclassified',
            imap_uid: email.uid || null
          })
          .select('id')
          .single()

        if (insertError) {
          errors.push(`Failed to save: ${insertError.message}`)
        } else {
          newEmailsCount++
          newEmailIds.push(inserted.id)
        }
      } catch (error: any) {
        errors.push(error.message)
      }
    }

    // Classify new emails
    if (newEmailIds.length > 0) {
      const { ReplyProcessor } = await import('@/lib/reply-processor')
      const replyProcessor = new ReplyProcessor()
      await replyProcessor.processUnclassifiedEmails(account.user_id, newEmailIds.length)
    }

    return {
      success: errors.length === 0,
      newEmails: newEmailsCount,
      errors,
      account: account.email
    }
  }

  throw new Error(`Provider ${account.provider} not supported in cron`)
}

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

    // Get all Gmail accounts (use working manual sync logic)
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('provider', 'gmail')

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`)
    }

    const results = []
    let totalNewEmails = 0

    for (const account of accounts || []) {
      try {
        const result = await syncEmailAccount(supabase, account.id)
        results.push(result)
        totalNewEmails += result.newEmails
      } catch (error: any) {
        results.push({
          success: false,
          account: account.email,
          error: error.message
        })
      }
    }

    const result = {
      totalAccounts: accounts?.length || 0,
      successfulAccounts: results.filter(r => r.success).length,
      failedAccounts: results.filter(r => !r.success).length,
      totalNewEmails,
      results
    }

    console.log(`✅ Cron: Fetched ${result.totalNewEmails} new emails from ${result.successfulAccounts}/${result.totalAccounts} accounts`)

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
    // Note: Removed is_verified check as column doesn't exist in production DB yet
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('provider')

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
