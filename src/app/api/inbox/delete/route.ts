import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { IMAPProcessor } from '@/lib/imap-processor'

// POST /api/inbox/delete - Move email(s) to IMAP Trash and remove from local DB
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
    const { data: emails, error: fetchErr } = await supabase
      .from('incoming_emails')
      .select('id, imap_uid, message_id, email_account_id')
      .in('id', emailIds)
      .eq('user_id', user.id)

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
    const deletedIds: string[] = []

    for (const [accountId, items] of byAccount.entries()) {
      // Load account config
      const { data: account, error: accountErr } = await supabase
        .from('email_accounts')
        .select('id, user_id, email, imap_host, imap_port, imap_username, imap_password, imap_secure, smtp_password')
        .eq('id', accountId)
        .single()

      if (accountErr || !account) {
        results.push({ accountId, success: false, error: accountErr?.message || 'Account not found' })
        continue
      }

      let password = account.imap_password || account.smtp_password
      if (!account.imap_host || !password) {
        results.push({ accountId, success: false, error: 'IMAP not configured' })
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
            results.push({ accountId, emailId: msg.id, success: false, error: 'UID not found' })
            continue
          }
          try {
            await imap.moveToTrashByUid(uid, 'INBOX')
            deletedIds.push(msg.id)
            results.push({ accountId, emailId: msg.id, success: true })
          } catch (moveErr: any) {
            results.push({ accountId, emailId: msg.id, success: false, error: moveErr?.message || 'Move failed' })
          }
        }
      } finally {
        await imap.disconnect()
      }
    }

    // Remove from local DB (no local Trash)
    if (deletedIds.length > 0) {
      const { error: delErr } = await supabase
        .from('incoming_emails')
        .delete()
        .in('id', deletedIds)
        .eq('user_id', user.id)
      if (delErr) {
        return NextResponse.json({ success: false, error: delErr.message, results }, { status: 500 })
      }
    }

    const response = NextResponse.json({ success: true, deleted: deletedIds.length, results })
    return addSecurityHeaders(response)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 })
  }
})

