import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { IMAPProcessor } from '@/lib/imap-processor'

// POST /api/inbox/delete - Move email(s) to IMAP Trash and mark as archived in local DB
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    await withRateLimit(user, 30, 60000) // 30 deletes per minute

    const body = await request.json()
    const emailIds: string[] = body?.emailIds

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json({ success: false, error: 'emailIds is required' }, { status: 400 })
    }

    // Load emails and group by account
    const { data: emails, error: fetchErr} = await supabase
      .from('incoming_emails')
      .select('id, imap_uid, message_id, email_account_id, gmail_message_id')
      .in('id', emailIds)
      .eq('user_id', user.id)
      .is('archived_at', null) // Only process non-archived emails

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ success: false, error: 'No emails found for user' }, { status: 404 })
    }

    const byAccount = new Map<string, typeof emails>()
    for (const e of emails) {
      const list = byAccount.get(e.email_account_id) || []
      list.push(e)
      byAccount.set(e.email_account_id, list)
    }

    const results: any[] = []
    const archivedIds: string[] = []

    for (const [accountId, items] of byAccount.entries()) {
      // Load account config
      const { data: account, error: accountErr } = await supabase
        .from('email_accounts')
        .select('id, user_id, email, provider, imap_host, imap_port, imap_username, imap_password, imap_secure, smtp_password')
        .eq('id', accountId)
        .single()

      if (accountErr || !account) {
        results.push({ accountId, success: false, error: accountErr?.message || 'Account not found' })
        continue
      }

      // Check if this is a Gmail OAuth account (use Gmail API for delete)
      const isGmailOAuth = account.provider === 'gmail' && !account.imap_host

      if (isGmailOAuth) {
        // For Gmail OAuth, use Gmail API to trash messages
        console.log(`📧 Gmail OAuth account - using Gmail API to trash messages`)
        try {
          const { GmailIMAPSMTPService } = await import('@/lib/gmail-imap-smtp')
          const { data: accountTokens } = await supabase
            .from('email_accounts')
            .select('access_token, refresh_token, token_expires_at')
            .eq('id', accountId)
            .single()

          if (!accountTokens?.access_token || !accountTokens?.refresh_token) {
            console.error(`⚠️ Gmail OAuth tokens not found for account ${account.email}`)
            // Fallback to local archive only
            for (const msg of items) {
              archivedIds.push(msg.id)
              results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: 'OAuth tokens missing' })
            }
            continue
          }

          const gmailService = new GmailIMAPSMTPService(
            {
              access_token: accountTokens.access_token,
              refresh_token: accountTokens.refresh_token,
              expires_at: accountTokens.token_expires_at,
              scope: 'https://www.googleapis.com/auth/gmail.modify'
            },
            account.email
          )

          for (const msg of items) {
            const gmailMsgId = msg.gmail_message_id
            if (!gmailMsgId) {
              console.warn(`⚠️ No Gmail message ID for email ${msg.id}, archiving locally only`)
              archivedIds.push(msg.id)
              results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: 'Gmail message ID missing' })
              continue
            }

            try {
              // Use Gmail API to trash the message
              const trashed = await gmailService.trashEmail(gmailMsgId)
              if (trashed) {
                archivedIds.push(msg.id)
                results.push({ accountId, emailId: msg.id, success: true, method: 'gmail-api-trash' })
              } else {
                // If Gmail API fails, still archive locally
                archivedIds.push(msg.id)
                results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: 'Gmail API trash failed' })
              }
            } catch (gmailErr: any) {
              console.error(`⚠️ Gmail API error for ${msg.id}:`, gmailErr?.message)
              archivedIds.push(msg.id)
              results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: gmailErr?.message })
            }
          }
        } catch (importErr: any) {
          console.error(`⚠️ Failed to import Gmail service:`, importErr?.message)
          // Fallback to local archive
          for (const msg of items) {
            archivedIds.push(msg.id)
            results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: 'Gmail service unavailable' })
          }
        }
        continue
      }

      // For IMAP accounts, move to trash on server
      let password = account.imap_password || account.smtp_password
      if (!account.imap_host || !password) {
        // No IMAP config, just archive locally
        console.log(`⚠️ No IMAP config for ${account.email} - archiving locally only`)
        for (const msg of items) {
          archivedIds.push(msg.id)
          results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: 'IMAP not configured' })
        }
        continue
      }

      const imapConfig = {
        host: account.imap_host as string,
        port: (account.imap_port as number) || 993,
        tls: account.imap_secure !== false,
        user: account.imap_username || account.email,
        password: password as string,
      }

      const imap = new IMAPProcessor()
      try {
        await imap.connect(imapConfig)
        for (const msg of items) {
          let uid = msg.imap_uid as number | null
          if (!uid && msg.message_id) {
            try {
              uid = await imap.findUidByMessageId(msg.message_id)
            } catch {}
          }
          if (!uid) {
            // No UID found, just archive locally
            archivedIds.push(msg.id)
            results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: 'UID not found' })
            continue
          }
          try {
            await imap.moveToTrashByUid(uid, 'INBOX')
            archivedIds.push(msg.id)
            results.push({ accountId, emailId: msg.id, success: true, method: 'imap-trash' })
          } catch (moveErr: any) {
            // If IMAP move fails, still archive locally
            console.error(`⚠️ IMAP move failed for email ${msg.id}, archiving locally:`, moveErr?.message)
            archivedIds.push(msg.id)
            results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: moveErr?.message })
          }
        }
      } catch (imapErr: any) {
        console.error(`⚠️ IMAP connection failed for account ${accountId}, archiving locally:`, imapErr?.message)
        // If IMAP connection fails, archive all items locally
        for (const msg of items) {
          archivedIds.push(msg.id)
          results.push({ accountId, emailId: msg.id, success: true, method: 'local-archive', warning: 'IMAP connection failed' })
        }
      } finally {
        await imap.disconnect()
      }
    }

    // Mark as archived in local DB (soft delete)
    if (archivedIds.length > 0) {
      const { error: archiveErr } = await supabase
        .from('incoming_emails')
        .update({ archived_at: new Date().toISOString() })
        .in('id', archivedIds)
        .eq('user_id', user.id)

      if (archiveErr) {
        console.error('❌ Failed to archive emails:', archiveErr)
        return NextResponse.json({ success: false, error: archiveErr.message, results }, { status: 500 })
      }
    }

    const response = NextResponse.json({
      success: true,
      archived: archivedIds.length,
      results,
      message: `Successfully archived ${archivedIds.length} email(s)`
    })
    return addSecurityHeaders(response)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 })
  }
})

