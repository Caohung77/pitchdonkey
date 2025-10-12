import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { addSecurityHeaders } from '@/lib/auth-middleware'

// Configure function to run up to 60 seconds (Vercel limit)
export const maxDuration = 60 // seconds
export const dynamic = 'force-dynamic'

/**
 * Reconcile Gmail state with database (detect deletions)
 */
async function reconcileGmailAccount(supabase: any, account: any) {
  try {
    console.log(`🔄 Reconciling ${account.email}...`)

    const { GmailIMAPSMTPServerService } = await import('@/lib/server/gmail-imap-smtp-server')
    const gmailService = new GmailIMAPSMTPServerService()

    // 1. Fetch ONLY inbox message IDs from Gmail (lightweight query)
    // NOTE: We do NOT reconcile sent emails because:
    // - Sent emails are historical records that should be preserved
    // - Gmail's SENT folder uses different IDs than our stored message_id
    // - Users expect sent emails to remain even if deleted from Gmail
    const gmailInboxIds = await gmailService.fetchGmailMessageIds(account.id, 'INBOX')

    console.log(`📧 ${account.email}: Gmail has ${gmailInboxIds.length} inbox emails`)

    // 2. Get all non-archived emails from database
    const { data: dbInboxEmails, error: inboxError } = await supabase
      .from('incoming_emails')
      .select('id, gmail_message_id, subject')
      .eq('email_account_id', account.id)
      .is('archived_at', null)

    if (inboxError) {
      console.error(`❌ ${account.email}: Failed to fetch DB inbox:`, inboxError)
      return { success: false, archivedInbox: 0, archivedSent: 0, error: inboxError.message }
    }

    console.log(`💾 ${account.email}: DB has ${dbInboxEmails?.length || 0} active inbox emails`)

    // 3. Find emails in DB but NOT in Gmail (deleted)
    const gmailInboxSet = new Set(gmailInboxIds)

    const deletedInboxEmails = (dbInboxEmails || []).filter(e =>
      e.gmail_message_id && !gmailInboxSet.has(e.gmail_message_id)
    )

    console.log(`🗑️  ${account.email}: Found ${deletedInboxEmails.length} deleted inbox emails`)

    // 4. Mark deleted inbox emails as archived
    if (deletedInboxEmails.length > 0) {
      const { error: archiveError } = await supabase
        .from('incoming_emails')
        .update({ archived_at: new Date().toISOString() })
        .in('id', deletedInboxEmails.map(e => e.id))

      if (archiveError) {
        console.error(`❌ ${account.email}: Failed to archive:`, archiveError)
      } else {
        console.log(`✅ ${account.email}: Archived ${deletedInboxEmails.length} emails`)
      }
    }

    // 5. Update last reconciliation timestamp
    await supabase
      .from('imap_connections')
      .upsert({
        email_account_id: account.id,
        last_full_reconciliation_at: new Date().toISOString()
      }, {
        onConflict: 'email_account_id',
        ignoreDuplicates: false
      })

    return {
      success: true,
      archivedInbox: deletedInboxEmails.length,
      archivedSent: 0, // We don't delete sent emails
      account: account.email
    }
  } catch (error: any) {
    console.error(`❌ ${account.email}: Reconciliation error:`, error)
    return {
      success: false,
      archivedInbox: 0,
      archivedSent: 0,
      error: error.message,
      account: account.email
    }
  }
}

/**
 * POST /api/cron/reconcile-emails
 * Daily cron job to reconcile Gmail state with database
 *
 * This detects emails that were deleted in Gmail and marks them as archived in the database
 * Should be run once per day
 *
 * Security: Uses CRON_SECRET for authentication
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🕐 Cron: Email reconciliation triggered')

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

    // Create Supabase client with service role
    const supabase = createServerSupabaseClient()

    // Fetch only Gmail OAuth accounts (IMAP/SMTP don't support this reconciliation)
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('provider', 'gmail')
      .not('access_token', 'is', null)

    if (accountsError) {
      throw new Error(`Failed to fetch Gmail accounts: ${accountsError.message}`)
    }

    console.log(`📧 Found ${accounts?.length || 0} Gmail OAuth accounts to reconcile`)

    const results = []
    let totalArchivedInbox = 0
    let totalArchivedSent = 0

    for (const account of accounts || []) {
      const result = await reconcileGmailAccount(supabase, account)
      results.push(result)

      if (result.success) {
        totalArchivedInbox += result.archivedInbox
        totalArchivedSent += result.archivedSent
      }
    }

    const summary = {
      totalAccounts: accounts?.length || 0,
      successfulAccounts: results.filter(r => r.success).length,
      failedAccounts: results.filter(r => !r.success).length,
      totalArchivedInbox,
      totalArchivedSent,
      results
    }

    console.log(`✅ Cron: Reconciled ${summary.successfulAccounts}/${summary.totalAccounts} accounts`)
    console.log(`   - Archived ${totalArchivedInbox} inbox emails`)
    console.log(`   - Deleted ${totalArchivedSent} sent emails`)

    const response = NextResponse.json({
      success: true,
      data: summary,
      message: `Reconciled ${summary.successfulAccounts}/${summary.totalAccounts} accounts. Archived ${totalArchivedInbox} inbox, deleted ${totalArchivedSent} sent.`,
      timestamp: new Date().toISOString()
    })

    return addSecurityHeaders(response)

  } catch (error: any) {
    console.error('❌ Cron: Error reconciling emails:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET /api/cron/reconcile-emails
 * Health check and status endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    // Get reconciliation stats
    const { data: connections, error } = await supabase
      .from('imap_connections')
      .select('email_account_id, last_full_reconciliation_at')
      .not('last_full_reconciliation_at', 'is', null)
      .order('last_full_reconciliation_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching reconciliation stats:', error)
    }

    // Count archived emails in last 24 hours
    const { data: recentlyArchived, error: archivedError } = await supabase
      .from('incoming_emails')
      .select('id')
      .gte('archived_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('archived_at', 'is', null)

    const response = NextResponse.json({
      status: 'healthy',
      endpoint: '/api/cron/reconcile-emails',
      stats: {
        accounts_with_reconciliation: connections?.length || 0,
        last_reconciliation_times: connections?.map(c => c.last_full_reconciliation_at) || [],
        archived_last_24h: recentlyArchived?.length || 0
      },
      timestamp: new Date().toISOString(),
      cron_secret_configured: !!cronSecret
    })

    return addSecurityHeaders(response)

  } catch (error: any) {
    console.error('Error in reconciliation health check:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
