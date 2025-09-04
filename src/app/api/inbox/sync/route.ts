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
    await withRateLimit(user, 10, 60000) // 10 sync requests per minute

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
        
        const results = []
        let totalNewEmails = 0
        
        // Sync each account
        for (const account of accounts || []) {
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
    console.error('Error in inbox sync API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 })
  }
})

// Working sync function using fixed IMAP processor
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
      smtp_password
    `)
    .eq('id', accountId)
    .single()

  if (accountError || !account) {
    throw new Error('Account not found: ' + accountError?.message)
  }

  console.log('🔄 Syncing account:', account.email)
  
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