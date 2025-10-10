import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { addSecurityHeaders } from '@/lib/auth-middleware'
import { IMAPProcessor } from '@/lib/imap-processor'

// Configure function to run up to 60 seconds (Vercel limit)
export const maxDuration = 60 // seconds
export const dynamic = 'force-dynamic'

async function syncGmailAccount(supabase: any, account: any, syncSent: boolean = false) {
  const { GmailIMAPSMTPServerService } = await import('@/lib/server/gmail-imap-smtp-server')
  const gmailService = new GmailIMAPSMTPServerService()

  // Always sync inbox (important, time-sensitive)
  const inboxEmails = await gmailService.fetchGmailEmails(account.id, 'INBOX', {
    since: await getGmailSinceDate(supabase, account.id, 'incoming_emails', 'date_received'),
    unseen: false
  })

  const inboxResult = await persistGmailEmails(supabase, account, inboxEmails, 'incoming')

  // Only sync sent emails if syncSent=true (every 30 minutes)
  let sentResult = { success: true, newEmails: 0, errors: [] }
  if (syncSent) {
    const sentEmails = await gmailService.fetchGmailEmails(account.id, 'SENT', {
      since: await getGmailSinceDate(supabase, account.id, 'outgoing_emails', 'date_sent'),
      unseen: false
    })
    sentResult = await persistGmailEmails(supabase, account, sentEmails, 'sent')
  }

  return {
    success: inboxResult.errors.length === 0 && sentResult.errors.length === 0,
    newEmails: inboxResult.newEmails,
    newSentEmails: sentResult.newEmails,
    errors: [...inboxResult.errors, ...sentResult.errors],
    account: account.email
  }
}

async function syncImapAccount(supabase: any, account: any, syncSent: boolean = false) {
  const imapProcessor = new IMAPProcessor()

  let password = null
  let passwordSource = 'none'

  if (account.imap_password) {
    password = account.imap_password
    passwordSource = 'imap_password (raw)'
  } else if (account.smtp_password) {
    password = account.smtp_password
    passwordSource = 'smtp_password (raw)'
  }

  if (!account.imap_host) {
    throw new Error(`IMAP host not configured for account ${account.email}`)
  }

  if (!password) {
    throw new Error(`IMAP password missing for account ${account.email}`)
  }

  const imapConfig = {
    host: account.imap_host,
    port: account.imap_port || 993,
    tls: account.imap_secure !== false,
    user: account.imap_username || account.email,
    password
  }

  const { data: connection } = await supabase
    .from('imap_connections')
    .select('last_processed_uid, consecutive_failures')
    .eq('email_account_id', account.id)
    .single()

  const lastProcessedUID = connection?.last_processed_uid || 0

  // Always sync inbox (important, time-sensitive)
  const syncResult = await imapProcessor.syncEmails(
    account.user_id,
    account.id,
    imapConfig,
    lastProcessedUID
  )

  // Only sync sent emails if syncSent=true (every 30 minutes)
  let sentResult = { success: true, newEmails: 0, errors: [] }
  if (syncSent) {
    sentResult = await imapProcessor.syncSentEmails(
      account.user_id,
      account.id,
      imapConfig
    )
  }

  const combinedErrors = [...syncResult.errors, ...sentResult.errors]
  const success = combinedErrors.length === 0
  const failureCount = success ? 0 : (connection?.consecutive_failures || 0) + 1

  // ✅ FIX: Trigger classification for new IMAP emails (same as Gmail OAuth path)
  if (syncResult.newEmails > 0) {
    console.log(`🔄 Triggering classification for ${syncResult.newEmails} new IMAP emails from ${account.email}`)

    try {
      const { ReplyProcessor } = await import('@/lib/reply-processor')
      const replyProcessor = new ReplyProcessor()
      const classificationResult = await replyProcessor.processUnclassifiedEmails(account.user_id, syncResult.newEmails)

      console.log(`✅ Classification completed for ${account.email}: ${classificationResult.successful}/${classificationResult.processed} emails (${classificationResult.autonomousDraftsCreated || 0} auto-drafts created)`)

      if (classificationResult.errors.length > 0) {
        console.warn(`⚠️ Classification errors for ${account.email}:`, classificationResult.errors.slice(0, 3))
      }
    } catch (classificationError) {
      console.error(`❌ Classification failed for ${account.email}:`, classificationError)
      // Don't fail the sync - emails are stored and will be picked up by fallback cron
      combinedErrors.push(`Classification failed: ${classificationError.message}`)
    }
  }

  await supabase
    .from('imap_connections')
    .upsert({
      email_account_id: account.id,
      status: success ? 'active' : 'error',
      last_sync_at: new Date().toISOString(),
      next_sync_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      last_processed_uid: syncResult.lastProcessedUID,
      consecutive_failures: failureCount,
      last_successful_connection: success ? new Date().toISOString() : connection?.last_successful_connection,
      last_error: success ? null : combinedErrors.join('; ')
    }, { onConflict: 'email_account_id' })

  return {
    success,
    newEmails: syncResult.newEmails,
    newSentEmails: sentResult.newEmails,
    errors: combinedErrors,
    account: account.email
  }
}

async function getGmailSinceDate(supabase: any, accountId: string, table: string, column: string) {
  const { data } = await supabase
    .from(table)
    .select(column)
    .eq('email_account_id', accountId)
    .order(column, { ascending: false })
    .limit(1)

  const lookbackDays = table === 'incoming_emails' ? 30 : 30
  if (!data || data.length === 0 || !data[0][column]) {
    return new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  }
  const parsed = new Date(data[0][column])
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  }
  return new Date(parsed.getTime() - 5 * 24 * 60 * 60 * 1000) // 5-day safety window
}

async function persistGmailEmails(supabase: any, account: any, emails: any[], type: 'incoming' | 'sent') {
  const errors: string[] = []
  let newEmailsCount = 0
  const newEmailIds: string[] = []

  for (const email of emails) {
    try {
      if (type === 'incoming') {
        const isFromSelf = email.from && email.from.toLowerCase().includes(account.email.toLowerCase())
        if (isFromSelf) continue
      }

      const { data: existing } = await supabase
        .from(type === 'incoming' ? 'incoming_emails' : 'outgoing_emails')
        .select('id, archived_at')
        .eq('gmail_message_id', email.gmailMessageId)
        .eq('user_id', account.user_id)
        .maybeSingle()

      if (existing) {
        continue
      }

      const payload: any = {
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
        imap_uid: email.uid || null
      }

      if (type === 'incoming') {
        payload.processing_status = 'pending'
        payload.classification_status = 'unclassified'
      } else {
        payload.date_sent = email.date || new Date().toISOString()
      }

      const table = type === 'incoming' ? 'incoming_emails' : 'outgoing_emails'
      const { data: inserted, error: insertError } = await supabase
        .from(table)
        .insert(payload)
        .select('id')
        .single()

      if (insertError) {
        errors.push(`Failed to save ${type} email ${email.messageId}: ${insertError.message}`)
      } else {
        newEmailsCount++
        if (type === 'incoming' && inserted?.id) {
          newEmailIds.push(inserted.id)
        }
      }
    } catch (error: any) {
      errors.push(error.message)
    }
  }

  if (type === 'incoming' && newEmailIds.length > 0) {
    const { ReplyProcessor } = await import('@/lib/reply-processor')
    const replyProcessor = new ReplyProcessor()
    await replyProcessor.processUnclassifiedEmails(account.user_id, newEmailIds.length)
  }

  return {
    success: errors.length === 0,
    newEmails: newEmailsCount,
    errors
  }
}

/**
 * POST /api/cron/fetch-emails
 * Cron job to fetch emails from all connected email accounts
 *
 * This endpoint should be called by a cron service (e.g., Ubuntu cron or GitHub Actions)
 * Recommended schedule:
 * - Every 5 minutes for inbox emails (time-sensitive)
 * - Every 30 minutes for sent emails (less critical)
 *
 * Query param: ?sync_sent=true to include sent emails sync
 *
 * Security: Uses CRON_SECRET for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Check if this is a sent email sync (every 30 minutes)
    const { searchParams } = new URL(request.url)
    const syncSent = searchParams.get('sync_sent') === 'true'

    console.log(`🕐 Cron: Fetch emails triggered (sync_sent=${syncSent})`)

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

    // Fetch active accounts (gmail + imap/smtp)
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .in('provider', ['gmail', 'smtp', 'gmail-imap-smtp'])

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`)
    }

    const results = []
    let totalNewEmails = 0

    for (const account of accounts || []) {
      try {
        let result
        if (account.provider === 'gmail' && account.access_token) {
          result = await syncGmailAccount(supabase, account, syncSent)
        } else if (account.provider === 'gmail' && !account.access_token) {
          result = await syncImapAccount(supabase, account, syncSent)
        } else if (account.provider === 'smtp' || account.provider === 'gmail-imap-smtp') {
          result = await syncImapAccount(supabase, account, syncSent)
        } else {
          results.push({
            success: false,
            account: account.email,
            error: `Provider ${account.provider} not supported by cron`
          })
          continue
        }

        results.push(result)
        totalNewEmails += (result.newEmails || 0) + (result.newSentEmails || 0)
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
