import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imapProcessor } from '@/lib/imap-processor'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🔄 Testing IMAP email sync...')

    // Get the first IMAP-enabled email account
    const { data: emailAccounts, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('imap_enabled', true)
      .limit(1)

    if (error) {
      console.error('❌ Error fetching email accounts:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch email accounts'
      }, { status: 500 })
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No IMAP-enabled email accounts found'
      })
    }

    const account = emailAccounts[0]
    console.log(`📧 Testing sync for ${account.email}...`)

    // Get or create IMAP connection record
    let { data: imapConnection } = await supabase
      .from('imap_connections')
      .select('*')
      .eq('email_account_id', account.id)
      .single()

    if (!imapConnection) {
      console.log('📝 Creating IMAP connection record...')
      const { data: newConnection, error: connectionError } = await supabase
        .from('imap_connections')
        .insert({
          user_id: account.user_id,
          email_account_id: account.id,
          status: 'inactive'
        })
        .select()
        .single()

      if (connectionError) {
        console.error('❌ Error creating IMAP connection:', connectionError)
        return NextResponse.json({
          success: false,
          error: 'Failed to create IMAP connection record'
        }, { status: 500 })
      }
      imapConnection = newConnection
    }

    // Prepare IMAP config
    const imapConfig = {
      host: account.imap_host,
      port: account.imap_port || 993,
      tls: account.imap_secure ?? true,
      user: account.smtp_username || account.email,
      password: account.smtp_password || ''
    }

    console.log(`🔍 Syncing emails from ${imapConfig.host}...`)

    try {
      // Sync emails (limiting to last 10 for testing)
      const syncResult = await imapProcessor.syncEmails(
        account.user_id,
        account.id,
        imapConfig,
        imapConnection.last_processed_uid || 0
      )

      console.log(`📊 Sync results:`, syncResult)

      // Update connection status
      await imapProcessor.updateConnectionStatus(
        account.id,
        syncResult.errors.length === 0 ? 'active' : 'error',
        syncResult.errors.length > 0 ? syncResult.errors.join('; ') : undefined,
        syncResult.lastProcessedUID
      )

      return NextResponse.json({
        success: syncResult.errors.length === 0,
        message: `Email sync completed. ${syncResult.newEmails} new emails processed.`,
        details: {
          totalProcessed: syncResult.totalProcessed,
          newEmails: syncResult.newEmails,
          lastProcessedUID: syncResult.lastProcessedUID,
          errors: syncResult.errors
        }
      })

    } catch (syncError) {
      console.error('❌ Error during sync:', syncError)
      
      // Update connection status to error
      await imapProcessor.updateConnectionStatus(
        account.id,
        'error',
        syncError.message
      )

      return NextResponse.json({
        success: false,
        error: `Sync failed: ${syncError.message}`,
        details: {
          account: account.email,
          config: {
            host: imapConfig.host,
            port: imapConfig.port
          }
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Error testing email sync:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to test email sync' 
      },
      { status: 500 }
    )
  }
}