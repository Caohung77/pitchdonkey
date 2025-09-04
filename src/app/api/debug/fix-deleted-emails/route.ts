import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/debug/fix-deleted-emails - Manually archive emails that should be deleted
export async function POST(request: NextRequest) {
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

    if (error) {
      console.error('❌ Error fetching emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch emails'
      }, { status: 500 })
    }

    console.log(`🔍 Found ${dbEmails?.length || 0} emails in database (not archived)`)

    // Get server UIDs and Message-IDs (using the same logic as check-deleted-emails)
    const { IMAPProcessor } = await import('@/lib/imap-processor')
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
      // Connect and get server state
      await imapProcessor.connect(imapConfig)
      await imapProcessor.openMailbox('INBOX')
      
      // Get UIDs on server
      serverUIDs = await new Promise((resolve, reject) => {
        // @ts-ignore
        imapProcessor.imap!.search(['ALL'], (err: any, uids: number[]) => {
          if (err) reject(err)
          else resolve(uids || [])
        })
      })
      
      // Get Message-IDs on server
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
        error: 'IMAP connection failed: ' + imapError.message
      }, { status: 500 })
    }

    console.log(`🔍 Found ${serverUIDs.length} emails on server, ${serverMessageIds.size} message IDs`)

    // Identify emails to archive (same logic as reconcileDeletions)
    const serverUIDSet = new Set(serverUIDs)
    const toArchiveByUID = (dbEmails || [])
      .filter(e => typeof e.imap_uid === 'number' && !serverUIDSet.has(e.imap_uid))
      .map(e => e.id)

    const toArchiveByMsgId = (dbEmails || [])
      .filter(e => !e.imap_uid && e.message_id && !serverMessageIds.has(e.message_id))
      .map(e => e.id)

    const allToArchive = [...toArchiveByUID, ...toArchiveByMsgId]

    console.log(`🧹 Found ${allToArchive.length} emails to archive (${toArchiveByUID.length} by UID, ${toArchiveByMsgId.length} by Message-ID)`)

    if (allToArchive.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails need to be archived',
        archived: 0
      })
    }

    // Archive the emails
    const { data: updatedEmails, error: updateError } = await supabase
      .from('incoming_emails')
      .update({ archived_at: new Date().toISOString() })
      .in('id', allToArchive)
      .select('from_address, subject')

    if (updateError) {
      console.error('❌ Error archiving emails:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to archive emails: ' + updateError.message
      }, { status: 500 })
    }

    console.log(`✅ Successfully archived ${allToArchive.length} emails`)

    return NextResponse.json({
      success: true,
      message: `Successfully archived ${allToArchive.length} emails that were deleted from the server`,
      archived: allToArchive.length,
      details: {
        by_uid: toArchiveByUID.length,
        by_message_id: toArchiveByMsgId.length,
        archived_emails: (updatedEmails || []).map(e => ({
          from: e.from_address,
          subject: e.subject
        }))
      }
    })

  } catch (error) {
    console.error('❌ Error in fix deleted emails:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}