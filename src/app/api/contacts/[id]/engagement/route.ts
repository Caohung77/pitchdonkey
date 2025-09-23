import { NextRequest } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: contactId } = await params

  if (!contactId) {
    return addSecurityHeaders(
      new Response(JSON.stringify({ success: false, error: 'Missing contact id' }), { status: 400 })
    )
  }

  const { data: tracking, error } = await supabase
    .from('email_tracking')
    .select(`
      status,
      subject_line,
      sent_at,
      delivered_at,
      opened_at,
      clicked_at,
      replied_at,
      bounced_at,
      complained_at,
      unsubscribed_at,
      created_at
    `)
    .eq('user_id', user.id)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load engagement events:', error)
    return addSecurityHeaders(
      new Response(JSON.stringify({ success: false, error: 'Failed to load engagement events' }), { status: 500 })
    )
  }

  const events: Array<{ type: string; timestamp: string; details?: string }> = []

  for (const row of tracking || []) {
    const addEvent = (type: string, timestamp: string | null | undefined) => {
      if (!timestamp) return
      events.push({
        type,
        timestamp,
        details: row.subject_line || undefined,
      })
    }

    addEvent('sent', row.sent_at)
    addEvent('delivered', row.delivered_at)
    addEvent('opened', row.opened_at)
    addEvent('clicked', row.clicked_at)
    addEvent('replied', row.replied_at)
    addEvent('bounced', row.bounced_at)
    addEvent('complained', row.complained_at)
    addEvent('unsubscribed', row.unsubscribed_at)
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return addSecurityHeaders(
    new Response(JSON.stringify({ success: true, events }), { status: 200 })
  )
})

