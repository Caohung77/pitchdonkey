import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { imapMonitor } from '@/lib/imap-monitor'
import { IMAPProcessor } from '@/lib/imap-processor'

// POST /api/inbox/sync - Force IMAP sync for user's email accounts
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 20, 300000) // 20 sync requests per 5 minutes (more generous)

    const body = await request.json()
    const { emailAccountId } = body

    if (emailAccountId && emailAccountId !== 'all') {
      // Verify the email account belongs to the user
      const { data: account, error } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('id', emailAccountId)
        .eq('user_id', user.id)
        .single()

      if (error || !account) {
        return NextResponse.json({
          success: false,
          error: 'Email account not found or access denied',
          code: 'NOT_FOUND'
        }, { status: 404 })
      }

      // Force sync specific account using working sync function
      try {
        const result = await syncEmailAccount(supabase, emailAccountId)
        
        const response = NextResponse.json({
          success: result.success,
          message: `Account sync completed: ${result.newEmails} new emails found`,
          data: result
        })

        return addSecurityHeaders(response)
      } catch (syncError) {
        console.error('Force sync error:', syncError)
        return NextResponse.json({
          success: false,
          error: syncError.message || 'Failed to sync account',
          code: 'SYNC_ERROR'
        }, { status: 500 })
      }
    } else {
      // Sync all accounts for user using working sync function
      try {
        // Get all user's email accounts
        const { data: accounts, error: accountsError } = await supabase
          .from('email_accounts')
          .select('id, email')
          .eq('user_id', user.id)
          
        if (accountsError) {
          throw new Error('Failed to fetch user accounts: ' + accountsError.message)
        }
        
        console.log(`🔄 Syncing ${accounts?.length || 0} accounts for user`)
        
        // Check if user has any email accounts
        if (!accounts || accounts.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No email accounts configured for sync',
            data: {
              totalNewEmails: 0,
              accountResults: []
            }
          })
        }
        
        const results = []
        let totalNewEmails = 0
        
        // Sync each account
        for (const account of accounts) {
          try {
            const result = await syncEmailAccount(supabase, account.id)
            results.push(result)
            totalNewEmails += result.newEmails
            console.log(`✅ ${account.email}: ${result.newEmails} new emails`)
          } catch (error) {
            console.error(`❌ Failed to sync ${account.email}:`, error)
            results.push({
              success: false,
              account: account.email,
              error: error.message
            })
          }
        }
        
        const response = NextResponse.json({
          success: true,
          message: `Sync completed: ${totalNewEmails} new emails found across ${accounts?.length || 0} accounts`,
          data: {
            totalNewEmails,
            accountResults: results
          }
        })

        return addSecurityHeaders(response)
      } catch (syncError) {
        console.error('All accounts sync error:', syncError)
        return NextResponse.json({
          success: false,
          error: syncError.message || 'Failed to sync accounts',
          code: 'SYNC_ERROR'
        }, { status: 500 })
      }
    }

  } catch (error) {
    console.error('❌ Error in inbox sync API:', error)
    
    // Handle rate limiting errors specifically
    if (error?.message?.includes('Rate limit exceeded') || error?.name === 'RateLimitError') {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded - please wait before syncing again',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 300 // 5 minutes in seconds
      }, { status: 429 })
    }
    
    console.error('❌ Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause
    })
    
    return NextResponse.json({
      success: false,
      error: error?.message || 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error?.stack,
        name: error?.name
      } : undefined
    }, { status: 500 })
  }
})

// Working sync function with Gmail OAuth support
async function syncEmailAccount(supabase: any, accountId: string) {
  // Get the account details
  const { data: account, error: accountError } = await supabase
    .from('email_accounts')
    .select(`
      id,
      user_id,
      email,
      provider,
      imap_host,
      imap_port,
      imap_username,
      imap_password,
      imap_secure,
      smtp_password,
      access_token,
      refresh_token,
      token_expires_at
    `)
    .eq('id', accountId)
    .single()

  if (accountError) {
    throw new Error('Database error: ' + accountError.message)
  }

  if (!account) {
    throw new Error('Email account not found or user does not have permission')
  }

  console.log('🔄 Syncing account:', account.email, 'Provider:', account.provider)

  // Check if this is a Gmail OAuth account
  const isGmailOAuth = account.provider === 'gmail' && account.access_token && account.refresh_token

  if (isGmailOAuth) {
    console.log('📧 Using Gmail API for OAuth account')
    return await syncGmailOAuthAccount(supabase, account)
  }

  // Traditional IMAP sync for non-OAuth accounts
  console.log('📧 Using traditional IMAP')

  // Prepare IMAP config using working logic
  let password = null
  let passwordSource = 'none'

  if (account.imap_password) {
    password = account.imap_password
    passwordSource = 'imap_password (raw)'
  } else if (account.smtp_password) {
    password = account.smtp_password
    passwordSource = 'smtp_password (raw)'
  }

  console.log(`🔐 Password source: ${passwordSource} (length: ${password?.length || 0})`)

  // Validate IMAP configuration
  if (!account.imap_host) {
    throw new Error(`IMAP host not configured for account ${account.email}`)
  }

  if (!password) {
    throw new Error(`IMAP password not available for account ${account.email}`)
  }

  const imapConfig = {
    host: account.imap_host,
    port: account.imap_port || 993,
    tls: account.imap_secure !== false,
    user: account.imap_username || account.email,
    password: password
  }

  // Get current IMAP connection to find last processed UID
  const { data: connection } = await supabase
    .from('imap_connections')
    .select('last_processed_uid')
    .eq('email_account_id', account.id)
    .single()

  const lastProcessedUID = connection?.last_processed_uid || 0
  console.log(`📧 Last processed UID: ${lastProcessedUID}`)

  // Create IMAP processor and sync
  const imapProcessor = new IMAPProcessor()

  const syncResult = await imapProcessor.syncEmails(
    account.user_id,
    account.id,
    imapConfig,
    lastProcessedUID
  )

  console.log(`✅ Sync completed: ${syncResult.newEmails} new emails, ${syncResult.errors.length} errors`)

  if (syncResult.errors.length > 0) {
    console.error('❌ Sync errors:', syncResult.errors)
  }

  // Update connection status if sync succeeded
  if (syncResult.errors.length === 0) {
    await supabase
      .from('imap_connections')
      .update({
        status: 'active',
        last_sync_at: new Date().toISOString(),
        next_sync_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        last_processed_uid: syncResult.lastProcessedUID,
        consecutive_failures: 0,
        last_successful_connection: new Date().toISOString(),
        last_error: null
      })
      .eq('email_account_id', account.id)
  } else {
    await supabase
      .from('imap_connections')
      .update({
        status: 'error',
        last_sync_at: new Date().toISOString(),
        last_error: syncResult.errors.join('; ')
      })
      .eq('email_account_id', account.id)
  }

  return {
    success: syncResult.errors.length === 0,
    newEmails: syncResult.newEmails,
    totalProcessed: syncResult.totalProcessed,
    errors: syncResult.errors,
    account: account.email
  }
}

// Gmail OAuth sync function using Gmail API
async function syncGmailOAuthAccount(supabase: any, account: any) {
  try {
    const { GmailIMAPSMTPServerService } = await import('@/lib/server/gmail-imap-smtp-server')
    const gmailService = new GmailIMAPSMTPServerService()

    // Determine lookback window
    // For initial sync (no emails in DB), fetch last 30 days
    // For subsequent syncs, use 7-day safety window to catch any gaps
    const INITIAL_SYNC_DAYS = 30
    const LOOKBACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days safety window

    const [latestIncomingResult, latestSentResult] = await Promise.all([
      supabase
        .from('incoming_emails')
        .select('date_received')
        .eq('email_account_id', account.id)
        .order('date_received', { ascending: false })
        .limit(1),
      supabase
        .from('outgoing_emails')
        .select('date_sent')
        .eq('email_account_id', account.id)
        .order('date_sent', { ascending: false })
        .limit(1)
    ])

    if (latestIncomingResult.error) {
      console.error('⚠️ Failed to read latest incoming email timestamp:', latestIncomingResult.error)
    }
    if (latestSentResult.error) {
      console.error('⚠️ Failed to read latest sent email timestamp:', latestSentResult.error)
    }

    let inboxSince: Date | undefined
    const latestIncomingDate = latestIncomingResult.data?.[0]?.date_received
    if (latestIncomingDate) {
      const parsed = new Date(latestIncomingDate)
      if (!Number.isNaN(parsed.getTime())) {
        inboxSince = new Date(parsed.getTime() - LOOKBACK_WINDOW_MS)
        console.log(`📧 Incremental sync: fetching emails since ${inboxSince.toISOString()}`)
      }
    } else {
      // First sync - fetch last 30 days
      inboxSince = new Date(Date.now() - (INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000))
      console.log(`📧 Initial sync: fetching last ${INITIAL_SYNC_DAYS} days of emails since ${inboxSince.toISOString()}`)
    }

    let sentSince: Date | undefined
    const latestSentDate = latestSentResult.data?.[0]?.date_sent
    if (latestSentDate) {
      const parsed = new Date(latestSentDate)
      if (!Number.isNaN(parsed.getTime())) {
        sentSince = new Date(parsed.getTime() - LOOKBACK_WINDOW_MS)
        console.log(`📤 Incremental sync: fetching sent emails since ${sentSince.toISOString()}`)
      }
    } else {
      // First sync - fetch last 30 days
      sentSince = new Date(Date.now() - (INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000))
      console.log(`📤 Initial sync: fetching last ${INITIAL_SYNC_DAYS} days of sent emails since ${sentSince.toISOString()}`)
    }

    // OPTIMIZATION: Fetch INBOX and SENT folders in parallel
    console.log('📧 Fetching inbox and sent emails in parallel...')
    const [inboxEmails, sentEmails] = await Promise.all([
      gmailService.fetchGmailEmails(account.id, 'INBOX', {
        unseen: false,
        since: inboxSince
      }),
      gmailService.fetchGmailEmails(account.id, 'SENT', {
        unseen: false,
        since: sentSince
      })
    ])

    console.log(`📧 Fetched ${inboxEmails.length} inbox emails and ${sentEmails.length} sent emails`)

    // DEBUG: Log all fetched emails to understand what's being filtered
    console.log('🔍 DEBUG: All fetched INBOX emails:')
    inboxEmails.forEach((email, index) => {
      const isFromSelf = email.from && email.from.toLowerCase().includes(account.email.toLowerCase())
      console.log(`  ${index + 1}. "${email.subject}" | From: ${email.from} | Date: ${email.date} | Self-sent: ${isFromSelf}`)
    })

    const emails = inboxEmails

    // Store emails in incoming_emails table
    let newEmailsCount = 0
    let skippedSelfSent = 0
    let skippedAlreadyExists = 0
    let skippedArchived = 0
    const errors: string[] = []
    const newEmailIds: string[] = []

    for (const email of emails) {
      try {
        // CRITICAL: Skip emails sent from user's own email address
        // These are SENT emails that Gmail incorrectly labeled as INBOX
        const isFromSelf = email.from && email.from.toLowerCase().includes(account.email.toLowerCase())
        if (isFromSelf) {
          console.log(`⏭️  Skipping self-sent email: "${email.subject}" from ${email.from}`)
          skippedSelfSent++
          continue
        }

        // Check if email already exists by message_id (excluding archived)
        let existing: { id: string; archived_at: string | null } | null = null

        if (email.gmailMessageId) {
          const { data: existingByGmailId, error: existingByGmailError } = await supabase
            .from('incoming_emails')
            .select('id, archived_at, user_id')
            .eq('gmail_message_id', email.gmailMessageId)
            .eq('user_id', account.user_id) // CRITICAL: Only check for THIS user's emails
            .maybeSingle()

          if (existingByGmailError && existingByGmailError.code !== 'PGRST116') {
            console.error(`⚠️ Failed to lookup incoming email by gmail_message_id ${email.gmailMessageId}:`, existingByGmailError)
          }

          existing = existingByGmailId
        }

        if (!existing && email.messageId) {
          const { data: existingByMessageId, error: existingByMessageError } = await supabase
            .from('incoming_emails')
            .select('id, archived_at, user_id')
            .eq('message_id', email.messageId)
            .eq('user_id', account.user_id) // CRITICAL: Only check for THIS user's emails
            .maybeSingle()

          if (existingByMessageError && existingByMessageError.code !== 'PGRST116') {
            console.error(`⚠️ Failed to lookup incoming email by message_id ${email.messageId}:`, existingByMessageError)
          }

          existing = existingByMessageId
        }

        if (existing) {
          // If email was previously archived (deleted), skip re-importing it
          if (existing.archived_at) {
            console.log(`⏭️  Email ${email.messageId} was deleted, skipping re-import`)
            skippedArchived++
            continue
          }
          console.log(`⏭️  Email ${email.messageId} already exists, skipping`)
          skippedAlreadyExists++
          continue
        }

        // Insert new email (only received emails, not sent)
        // Add null-safety for all fields to handle missing data
        const { data: inserted, error: insertError} = await supabase
          .from('incoming_emails')
          .insert({
            user_id: account.user_id,
            email_account_id: account.id,
            message_id: email.messageId || `missing-${Date.now()}`,
            gmail_message_id: email.gmailMessageId || null, // Store Gmail API message ID for trash/delete
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
          console.error(`❌ Failed to insert email "${email.subject || '(No Subject)'}":`, {
            messageId: email.messageId,
            from: email.from,
            to: email.to,
            subject: email.subject,
            date: email.date,
            error: insertError,
            errorCode: insertError.code,
            errorMessage: insertError.message,
            errorDetails: insertError.details,
            errorHint: insertError.hint
          })
          errors.push(`Failed to save email ${email.subject || email.messageId || 'undefined'}`)
        } else {
          newEmailsCount++
          newEmailIds.push(inserted.id)
          console.log(`✅ Inserted email: ${email.subject}`)
        }
      } catch (error) {
        console.error(`❌ Error processing email:`, error)
        errors.push(error.message || 'Unknown error')
      }
    }

    // Classify and process new emails automatically
    if (newEmailIds.length > 0) {
      console.log(`🔄 Classifying ${newEmailIds.length} new emails...`)
      try {
        const { ReplyProcessor } = await import('@/lib/reply-processor')
        const replyProcessor = new ReplyProcessor()

        // Process unclassified emails for this user
        const processingResult = await replyProcessor.processUnclassifiedEmails(account.user_id, newEmailIds.length)
        console.log(`✅ Classified ${processingResult.successful}/${processingResult.processed} emails`)

        if (processingResult.errors.length > 0) {
          console.error('⚠️ Classification errors:', processingResult.errors.slice(0, 3))
        }
      } catch (classifyError) {
        console.error('❌ Error classifying emails:', classifyError)
        errors.push(`Classification failed: ${classifyError.message}`)
      }
    }

    // Store sent emails in outgoing_emails table
    let newSentCount = 0
    console.log(`📤 Processing ${sentEmails.length} sent emails...`)

    for (const email of sentEmails) {
      try {
        // Check if sent email already exists by message_id
        let existingSent: { id: string } | null = null

        const { data: existingSentByUid, error: existingSentByUidError } = await supabase
          .from('outgoing_emails')
          .select('id')
          .eq('email_account_id', account.id)
          .eq('imap_uid', email.uid)
          .maybeSingle()

        if (existingSentByUidError && existingSentByUidError.code !== 'PGRST116') {
          console.error(`⚠️ Failed to lookup outgoing email by imap_uid ${email.uid}:`, existingSentByUidError)
        }

        existingSent = existingSentByUid

        if (!existingSent && email.messageId) {
          const { data: existingSentByMessageId, error: existingSentByMessageIdError } = await supabase
            .from('outgoing_emails')
            .select('id')
            .eq('message_id', email.messageId)
            .maybeSingle()

          if (existingSentByMessageIdError && existingSentByMessageIdError.code !== 'PGRST116') {
            console.error(`⚠️ Failed to lookup outgoing email by message_id ${email.messageId}:`, existingSentByMessageIdError)
          }

          existingSent = existingSentByMessageId
        }

        if (existingSent) {
          console.log(`⏭️  Sent email ${email.messageId} already exists, skipping`)
          continue
        }

        // Insert new sent email
        const { error: sentInsertError } = await supabase
          .from('outgoing_emails')
          .insert({
            user_id: account.user_id,
            email_account_id: account.id,
            message_id: email.messageId,
            from_address: email.from,
            to_address: email.to,
            subject: email.subject,
            date_sent: email.date,
            text_content: email.textBody,
            html_content: email.htmlBody,
            imap_uid: email.uid
          })

        if (sentInsertError) {
          console.error(`❌ Failed to insert sent email ${email.messageId}:`, sentInsertError)
          errors.push(`Sent insert failed: ${sentInsertError.message}`)
        } else {
          newSentCount++
          console.log(`✅ Inserted sent email: ${email.subject}`)
        }
      } catch (error) {
        console.error(`❌ Error processing sent email:`, error)
        errors.push(error.message || 'Unknown sent error')
      }
    }

    console.log(`📊 Sync complete: ${newEmailsCount} new inbox, ${newSentCount} new sent`)
    console.log(`📊 Sync statistics:`)
    console.log(`   - Total fetched from INBOX: ${inboxEmails.length}`)
    console.log(`   - Skipped (self-sent): ${skippedSelfSent}`)
    console.log(`   - Skipped (already exists): ${skippedAlreadyExists}`)
    console.log(`   - Skipped (archived): ${skippedArchived}`)
    console.log(`   - New emails inserted: ${newEmailsCount}`)
    console.log(`   - Errors: ${errors.length}`)

    if (errors.length > 0) {
      console.log(`\n❌ INSERT ERRORS (first 5):`)
      errors.slice(0, 5).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`)
      })
    }

    // Verify database state after sync
    const { data: dbEmails, count: dbCount } = await supabase
      .from('incoming_emails')
      .select('id, subject, archived_at', { count: 'exact' })
      .eq('email_account_id', account.id)
      .is('archived_at', null)
      .order('date_received', { ascending: false })
      .limit(50)

    console.log(`🔍 Post-sync DB verification:`)
    console.log(`   - Total non-archived emails in DB for this account: ${dbCount}`)
    console.log(`   - Sample emails (first 5):`)
    if (dbEmails && dbEmails.length > 0) {
      dbEmails.slice(0, 5).forEach((email, idx) => {
        console.log(`     ${idx + 1}. ${email.subject?.slice(0, 50) || '(no subject)'}`)
      })
    } else {
      console.log(`     (No emails found in database)`)
    }

    // Update connection status
    await supabase
      .from('imap_connections')
      .upsert({
        user_id: account.user_id,
        email_account_id: account.id,
        status: 'active',
        last_sync_at: new Date().toISOString(),
        next_sync_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        total_emails_processed: (await supabase
          .from('incoming_emails')
          .select('id', { count: 'exact', head: true })
          .eq('email_account_id', account.id)).count || 0,
        consecutive_failures: 0,
        last_successful_connection: new Date().toISOString(),
        last_error: null
      }, {
        onConflict: 'email_account_id'
      })

    return {
      success: errors.length === 0,
      newEmails: newEmailsCount,
      newSentEmails: newSentCount,
      totalProcessed: emails.length + sentEmails.length,
      errors: errors,
      account: account.email
    }
  } catch (error) {
    console.error('❌ Gmail OAuth sync error:', error)

    // Update connection with error
    await supabase
      .from('imap_connections')
      .upsert({
        user_id: account.user_id,
        email_account_id: account.id,
        status: 'error',
        last_sync_at: new Date().toISOString(),
        last_error: error.message || 'Unknown error',
        consecutive_failures: 1
      }, {
        onConflict: 'email_account_id'
      })

    throw error
  }
}
