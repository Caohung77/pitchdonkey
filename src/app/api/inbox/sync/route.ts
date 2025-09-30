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

    // OPTIMIZATION: Fetch INBOX and SENT folders in parallel
    console.log('📧 Fetching inbox and sent emails in parallel...')
    const [inboxEmails, sentEmails] = await Promise.all([
      gmailService.fetchGmailEmails(account.id, 'INBOX', {
        limit: 100,
        unseen: false
      }),
      gmailService.fetchGmailEmails(account.id, 'SENT', {
        limit: 100,
        unseen: false
      })
    ])

    console.log(`📧 Fetched ${inboxEmails.length} inbox emails and ${sentEmails.length} sent emails`)

    const emails = inboxEmails

    // Store emails in incoming_emails table
    let newEmailsCount = 0
    const errors: string[] = []
    const newEmailIds: string[] = []

    for (const email of emails) {
      try {
        // CRITICAL: Skip emails sent from user's own email address
        // These are SENT emails that Gmail incorrectly labeled as INBOX
        const isFromSelf = email.from && email.from.toLowerCase().includes(account.email.toLowerCase())
        if (isFromSelf) {
          console.log(`⏭️  Skipping self-sent email: "${email.subject}" from ${email.from}`)
          continue
        }

        // Check if email already exists by message_id
        const { data: existing } = await supabase
          .from('incoming_emails')
          .select('id')
          .eq('message_id', email.messageId)
          .single()

        if (existing) {
          console.log(`⏭️  Email ${email.messageId} already exists, skipping`)
          continue
        }

        // Insert new email (only received emails, not sent)
        const { data: inserted, error: insertError } = await supabase
          .from('incoming_emails')
          .insert({
            user_id: account.user_id,
            email_account_id: account.id,
            message_id: email.messageId,
            from_address: email.from,
            to_address: email.to,
            subject: email.subject,
            date_received: email.date,
            text_content: email.textBody,
            html_content: email.htmlBody,
            processing_status: 'pending',
            classification_status: 'unclassified',
            imap_uid: email.uid
          })
          .select('id')
          .single()

        if (insertError) {
          console.error(`❌ Failed to insert email ${email.messageId}:`, insertError)
          errors.push(`Insert failed: ${insertError.message}`)
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
        const { data: existingSent } = await supabase
          .from('outgoing_emails')
          .select('id')
          .eq('message_id', email.messageId)
          .single()

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