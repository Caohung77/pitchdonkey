import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { IMAPProcessor } from '@/lib/imap-processor'

// GET /api/debug/check-deleted-emails - Check which emails should be archived
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get the specific account
    const { data: account } = await supabase
      .from('email_accounts')
      .select(`
        id,
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

    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'Account not found'
      }, { status: 404 })
    }

    // Get all non-archived emails for this account
    const { data: dbEmails, error } = await supabase
      .from('incoming_emails')
      .select('id, from_address, subject, date_received, imap_uid, message_id, archived_at')
      .eq('email_account_id', account.id)
      .is('archived_at', null)
      .order('date_received', { ascending: false })
      .limit(20)

    if (error) {
      console.error('❌ Error fetching emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch emails'
      }, { status: 500 })
    }

    console.log(`🔍 Found ${dbEmails?.length || 0} emails in database (not archived)`)

    // Try to connect to IMAP and get server UIDs
    const imapProcessor = new IMAPProcessor()
    
    // Prepare IMAP config similar to the monitor
    let password = null
    if (account.imap_password) {
      password = account.imap_password
    } else if (account.smtp_password) {
      password = account.smtp_password
    }

    const imapConfig = {
      host: account.imap_host,
      port: account.imap_port || 993,
      tls: account.imap_secure !== false,
      user: account.imap_username || account.email,
      password: password
    }

    let serverUIDs: number[] = []
    let serverMessageIds: Set<string> = new Set()
    try {
      const testResult = await imapProcessor.testConnection(imapConfig)
      if (!testResult.success) {
        throw new Error(testResult.error)
      }

      // Connect and get UIDs
      await imapProcessor.connect(imapConfig)
      await imapProcessor.openMailbox('INBOX')
      
      serverUIDs = await new Promise((resolve, reject) => {
        // @ts-ignore
        imapProcessor.imap!.search(['ALL'], (err: any, uids: number[]) => {
          if (err) reject(err)
          else resolve(uids || [])
        })
      })
      
      // Also get Message-IDs on server
      serverMessageIds = await new Promise<Set<string>>((resolve, reject) => {
        const ids = new Set<string>()
        // @ts-ignore
        const f = imapProcessor.imap!.fetch('1:*', { bodies: 'HEADER.FIELDS (MESSAGE-ID)', struct: false })
        f.on('message', (msg: any) => {
          let header = ''
          msg.on('body', (stream: any) => {
            stream.on('data', (chunk: any) => { header += chunk.toString('utf8') })
          })
          msg.once('end', () => {
            const m = header.match(/Message-ID:\s*<([^>]+)>/i)
            if (m && m[1]) ids.add(`<${m[1]}>`)
          })
        })
        f.once('error', (err: any) => reject(err))
        f.once('end', () => resolve(ids))
      })
      
      await imapProcessor.disconnect()
      
    } catch (imapError) {
      console.error('❌ IMAP connection failed:', imapError)
      return NextResponse.json({
        success: false,
        error: 'IMAP connection failed: ' + imapError.message,
        debug: {
          emails_in_db: dbEmails?.length || 0,
          config: {
            host: imapConfig.host,
            port: imapConfig.port,
            user: imapConfig.user,
            passwordLength: password?.length || 0
          }
        }
      }, { status: 500 })
    }

    console.log(`🔍 Found ${serverUIDs.length} emails on IMAP server`)

    // Compare database vs server
    const serverUIDSet = new Set(serverUIDs)
    const shouldBeArchived = (dbEmails || []).filter(email => {
      // First pass: check by UID
      if (email.imap_uid && !serverUIDSet.has(email.imap_uid)) {
        return true
      }
      // Second pass: for emails without UID, check by Message-ID
      if (!email.imap_uid && email.message_id && !serverMessageIds.has(email.message_id)) {
        return true
      }
      return false
    })

    return NextResponse.json({
      success: true,
      debug: {
        emails_in_database: dbEmails?.length || 0,
        emails_on_server: serverUIDs.length,
        emails_that_should_be_archived: shouldBeArchived.length,
        archived_candidates: shouldBeArchived.map(e => ({
          from: e.from_address,
          subject: e.subject,
          imap_uid: e.imap_uid,
          date_received: e.date_received
        })),
        server_uids: serverUIDs.slice(0, 10), // First 10 for debugging
        server_message_ids: Array.from(serverMessageIds),
        account_email: account.email,
        db_email_sample: (dbEmails || []).slice(0, 5).map(e => ({
          from: e.from_address,
          subject: e.subject?.substring(0, 50),
          imap_uid: e.imap_uid,
          message_id: e.message_id?.substring(0, 50),
          date_received: e.date_received
        }))
      }
    })

  } catch (error) {
    console.error('❌ Error in check deleted emails:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}