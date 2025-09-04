import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imapProcessor } from '@/lib/imap-processor'
import { replyProcessor } from '@/lib/reply-processor'
import { decryptSMTPConfig } from '@/lib/encryption'
import { z } from 'zod'

const syncSchema = z.object({
  emailAccountId: z.string().optional(),
  processEmails: z.boolean().default(true)
})

// POST /api/admin/imap-sync - Manually trigger IMAP sync
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emailAccountId, processEmails } = syncSchema.parse(body)

    const results = []

    // Get email accounts to sync
    let query = supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('imap_host', 'is', null) // Only accounts with IMAP configured

    if (emailAccountId) {
      query = query.eq('id', emailAccountId)
    }

    const { data: emailAccounts, error } = await query

    if (error) {
      throw error
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No IMAP-configured email accounts found',
        results: []
      })
    }

    console.log(`🔄 Starting IMAP sync for ${emailAccounts.length} accounts`)

    // Sync each email account
    for (const account of emailAccounts) {
      try {
        console.log(`📧 Syncing ${account.email}...`)

        // Decrypt IMAP credentials
        const imapConfig = {
          host: account.imap_host,
          port: account.imap_port || 993,
          tls: account.imap_secure !== false,
          user: account.imap_username || account.email,
          password: account.imap_password ? decryptSMTPConfig(account.imap_password).password : account.smtp_password
        }

        // Get last processed UID for this account
        const { data: connection } = await supabase
          .from('imap_connections')
          .select('last_processed_uid')
          .eq('email_account_id', account.id)
          .single()

        const lastProcessedUID = connection?.last_processed_uid || 0

        // Update connection status to 'connecting'
        await imapProcessor.updateConnectionStatus(account.id, 'connecting')

        // Perform IMAP sync
        const syncResult = await imapProcessor.syncEmails(
          user.id,
          account.id,
          imapConfig,
          lastProcessedUID
        )

        // Update connection status based on result
        if (syncResult.errors.length === 0) {
          await imapProcessor.updateConnectionStatus(
            account.id,
            'active',
            undefined,
            syncResult.lastProcessedUID
          )
        } else {
          await imapProcessor.updateConnectionStatus(
            account.id,
            'error',
            syncResult.errors.join('; ')
          )
        }

        results.push({
          emailAccount: account.email,
          success: syncResult.errors.length === 0,
          ...syncResult
        })

        console.log(`✅ Sync completed for ${account.email}: ${syncResult.newEmails} new emails`)

      } catch (error) {
        console.error(`❌ Error syncing ${account.email}:`, error)
        
        await imapProcessor.updateConnectionStatus(account.id, 'error', error.message)
        
        results.push({
          emailAccount: account.email,
          success: false,
          error: error.message,
          totalProcessed: 0,
          newEmails: 0,
          errors: [error.message]
        })
      }
    }

    // Process unclassified emails if requested
    let processingResult = null
    if (processEmails) {
      try {
        console.log('🔄 Processing unclassified emails...')
        processingResult = await replyProcessor.processUnclassifiedEmails(user.id, 200)
        console.log(`✅ Processed ${processingResult.successful}/${processingResult.processed} emails`)
      } catch (error) {
        console.error('❌ Error processing emails:', error)
        processingResult = {
          processed: 0,
          successful: 0,
          failed: 0,
          errors: [error.message]
        }
      }
    }

    const summary = {
      accountsProcessed: results.length,
      accountsSuccessful: results.filter(r => r.success).length,
      totalNewEmails: results.reduce((sum, r) => sum + (r.newEmails || 0), 0),
      totalErrors: results.reduce((sum, r) => sum + (r.errors?.length || 0), 0)
    }

    return NextResponse.json({
      success: true,
      message: `IMAP sync completed for ${emailAccounts.length} accounts`,
      summary,
      results,
      processing: processingResult
    })

  } catch (error) {
    console.error('❌ Error in IMAP sync:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}