import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

// GET /api/inbox/thread/[id] - Fetch an email and related thread messages
export const GET = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: emailId } = await params
  console.log('Thread API - Email ID from params:', emailId)
  
  if (!emailId) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }
  
  // Load base email
  const { data: email, error } = await supabase
    .from('incoming_emails')
    .select('*')
    .eq('id', emailId)
    .eq('user_id', user.id)
    .single()

  if (error || !email) {
    return NextResponse.json({ success: false, error: 'Email not found' }, { status: 404 })
  }

  const accountId = email.email_account_id
  const messageId = email.message_id
  const inReplyTo = email.in_reply_to

  // Collect thread: simplistic approach based on Message-ID links and references
  // 1) Any that reference this email's message-id
  // 2) The parent this email replies to
  // 3) Any immediate children that reply to this email
  const parts: any[] = []

  // a) Replies to this email (children)
  const { data: children } = await supabase
    .from('incoming_emails')
    .select('*')
    .eq('user_id', user.id)
    .eq('email_account_id', accountId)
    .neq('id', emailId)
    .or(`in_reply_to.eq.${messageId},email_references.ilike.%${messageId}%`)

  if (children) parts.push(...children)

  // b) Direct parent (the email this one replied to)
  if (inReplyTo) {
    const { data: parent } = await supabase
      .from('incoming_emails')
      .select('*')
      .eq('user_id', user.id)
      .eq('email_account_id', accountId)
      .eq('message_id', inReplyTo)
      .single()
    if (parent) parts.push(parent)
  }

  // c) Sibling/related by subject heuristic (optional lightweight)
  // Normalize subject by stripping common prefixes
  const norm = (s?: string) => (s || '').replace(/^\s*(re:|fwd:|fw:)\s*/i, '').trim()
  const baseSubject = norm(email.subject)
  if (baseSubject) {
    const { data: subjectRelated } = await supabase
      .from('incoming_emails')
      .select('*')
      .eq('user_id', user.id)
      .eq('email_account_id', accountId)
      .neq('id', emailId)
      .ilike('subject', `%${baseSubject}%`)
      .limit(25)
    if (subjectRelated) parts.push(...subjectRelated)
  }

  // De-dup and sort chronologically
  const map = new Map<string, any>()
  for (const p of parts) {
    // Don't include the main email in the thread parts to avoid duplication
    if (p.id !== emailId) {
      map.set(p.id, p)
    }
  }
  
  const thread = Array.from(map.values())
    .sort((a, b) => new Date(a.date_received).getTime() - new Date(b.date_received).getTime())

  const res = NextResponse.json({ success: true, email, thread })
  return addSecurityHeaders(res)
})

