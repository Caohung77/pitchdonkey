import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { IMAPProcessor } from '@/lib/imap-processor'

// POST /api/debug/manual-sync - Manually sync emails using working IMAP logic
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get the specific account with user_id
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
      .eq('email', 'hung@theaiwhisperer.de')
      .single()

    if (accountError || !account) {
      return NextResponse.json({
        success: false,
        error: 'Account not found',
        details: accountError?.message
      }, { status: 404 })
    }

    // Get user ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id || 'system')
      .single()

    console.log('🔍 Manual sync starting for account:', account.email)
    
    // Prepare IMAP config using the same logic as the working direct test
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
    
    console.log(`📧 IMAP Config: ${account.email}@${imapConfig.host}:${imapConfig.port} (TLS: ${imapConfig.tls})`)

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
    
    try {
      // Use the exact same sync logic as the monitor would use
      console.log(`🔄 Starting sync with lastProcessedUID: ${lastProcessedUID}`)
      
      const syncResult = await imapProcessor.syncEmails(
        account.user_id, // Correct user ID
        account.id,      // Email account ID
        imapConfig,
        lastProcessedUID
      )

      console.log(`✅ Sync completed:`)
      console.log(`   - Total processed: ${syncResult.totalProcessed}`) 
      console.log(`   - New emails: ${syncResult.newEmails}`)
      console.log(`   - Last processed UID: ${syncResult.lastProcessedUID}`)
      console.log(`   - Errors: ${syncResult.errors.length}`)
      
      if (syncResult.errors.length > 0) {
        console.error('❌ Sync errors:', syncResult.errors)
      }

      // Update connection status if sync succeeded
      if (syncResult.errors.length === 0) {
        const { error: updateError } = await supabase
          .from('imap_connections')
          .update({
            status: 'active',
            last_sync_at: new Date().toISOString(),
            next_sync_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // Next sync in 15 min
            last_processed_uid: syncResult.lastProcessedUID,
            consecutive_failures: 0,
            last_successful_connection: new Date().toISOString(),
            last_error: null
          })
          .eq('email_account_id', account.id)

        if (updateError) {
          console.error('❌ Error updating connection status:', updateError)
        }
      }

      return NextResponse.json({
        success: syncResult.errors.length === 0,
        message: `Sync completed: ${syncResult.newEmails} new emails found`,
        details: {
          totalProcessed: syncResult.totalProcessed,
          newEmails: syncResult.newEmails,
          lastProcessedUID: syncResult.lastProcessedUID,
          errors: syncResult.errors,
          config: {
            host: imapConfig.host,
            port: imapConfig.port,
            user: imapConfig.user,
            passwordSource,
            passwordLength: password?.length || 0
          }
        }
      })

    } catch (syncError) {
      console.error('❌ IMAP sync failed:', syncError)
      
      // Update connection status on error
      await supabase
        .from('imap_connections')
        .update({
          status: 'error',
          last_sync_at: new Date().toISOString(),
          last_error: syncError.message
        })
        .eq('email_account_id', account.id)

      return NextResponse.json({
        success: false,
        error: 'IMAP sync failed: ' + syncError.message,
        config: {
          host: imapConfig.host,
          port: imapConfig.port,
          user: imapConfig.user,
          passwordSource,
          passwordLength: password?.length || 0
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Error in manual sync:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}