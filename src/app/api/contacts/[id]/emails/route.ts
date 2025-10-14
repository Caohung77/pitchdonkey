import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

interface ContactEmailMessage {
  id: string
  direction: 'inbound' | 'outbound'
  source: 'incoming' | 'outgoing' | 'campaign'
  subject: string | null
  preview: string | null
  timestamp: string
  from_address: string | null
  to_address: string | null
  thread_id: string | null
  message_id: string | null
  email_account?: {
    id: string
    email: string | null
  } | null
}

const buildPreview = (text?: string | null, html?: string | null): string | null => {
  if (text && text.trim()) {
    return text.trim().slice(0, 400)
  }
  if (!html) return null
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400) || null
}

export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await withRateLimit(user, 60, 60000)

    const { id: contactId } = await params

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, email')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      )
    }

    const incomingPromise = supabase
      .from('incoming_emails')
      .select(`
        id,
        subject,
        text_content,
        html_content,
        date_received,
        from_address,
        to_address,
        thread_id,
        message_id,
        email_account_id,
        email_accounts (
          id,
          email
        )
      `)
      .eq('user_id', user.id)
      .eq('contact_id', contactId)
      .order('date_received', { ascending: true })

    const outgoingPromise = supabase
      .from('outgoing_emails')
      .select(`
        id,
        subject,
        text_content,
        html_content,
        date_sent,
        from_address,
        to_address,
        message_id,
        email_account_id,
        email_accounts (
          id,
          email
        )
      `)
      .eq('user_id', user.id)
      .eq('contact_id', contactId)
      .order('date_sent', { ascending: true })

    const campaignPromise = supabase
      .from('email_sends')
      .select(`
        id,
        subject,
        content,
        send_status,
        sent_at,
        created_at,
        message_id,
        email_account_id,
        email_accounts (
          id,
          email
        )
      `)
      .eq('user_id', user.id)
      .eq('contact_id', contactId)
      .order('sent_at', { ascending: true, nullsLast: false })
      .order('created_at', { ascending: true })

    const [incomingResult, outgoingResult, campaignResult] = await Promise.all([
      incomingPromise,
      outgoingPromise,
      campaignPromise,
    ])

    const incoming = incomingResult.data || []
    const outgoing = outgoingResult.data || []
    const campaign = campaignResult.data || []

    const messages: ContactEmailMessage[] = [
      ...incoming.map((email) => ({
        id: `incoming-${email.id}`,
        direction: 'inbound' as const,
        source: 'incoming' as const,
        subject: email.subject,
        preview: buildPreview(email.text_content, email.html_content),
        timestamp: email.date_received,
        from_address: email.from_address,
        to_address: email.to_address,
        thread_id: email.thread_id,
        message_id: email.message_id,
        email_account: email.email_accounts ? {
          id: email.email_accounts.id,
          email: email.email_accounts.email,
        } : null,
      })),
      ...outgoing.map((email) => ({
        id: `outgoing-${email.id}`,
        direction: 'outbound' as const,
        source: 'outgoing' as const,
        subject: email.subject,
        preview: buildPreview(email.text_content, email.html_content),
        timestamp: email.date_sent,
        from_address: email.from_address,
        to_address: email.to_address,
        thread_id: null,
        message_id: email.message_id,
        email_account: email.email_accounts ? {
          id: email.email_accounts.id,
          email: email.email_accounts.email,
        } : null,
      })),
      ...campaign.map((email) => ({
        id: `campaign-${email.id}`,
        direction: 'outbound' as const,
        source: 'campaign' as const,
        subject: email.subject,
        preview: buildPreview(email.content, null),
        timestamp: email.sent_at || email.created_at,
        from_address: email.email_accounts?.email || null,
        to_address: contact.email,
        thread_id: null,
        message_id: email.message_id,
        email_account: email.email_accounts ? {
          id: email.email_accounts.id,
          email: email.email_accounts.email,
        } : null,
      })),
    ].filter((message) => Boolean(message.timestamp))

    messages.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeA - timeB
    })

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: { messages },
      })
    )
  } catch (error) {
    console.error('GET /api/contacts/[id]/emails error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load contact emails'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})
