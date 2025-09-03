import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const GET = withAuth(async (request: NextRequest, user, { params }) => {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const campaignId = params.id

    const page = Number(searchParams.get('page') || '1')
    const pageSize = Math.min(Number(searchParams.get('pageSize') || '50'), 200)
    const status = searchParams.get('status') || 'all'
    const q = (searchParams.get('q') || '').toLowerCase()

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign || campaign.user_id !== user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Base query
    let query = supabase
      .from('email_tracking')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false })

    // Filter by derived status using timestamps if requested
    if (status && status !== 'all') {
      switch (status) {
        case 'sent':
          query = query.not('sent_at', 'is', null)
          break
        case 'delivered':
          query = query.or('delivered_at.not.is.null,opened_at.not.is.null,clicked_at.not.is.null,replied_at.not.is.null')
          break
        case 'opened':
          query = query.not('opened_at', 'is', null)
          break
        case 'clicked':
          query = query.not('clicked_at', 'is', null)
          break
        case 'replied':
          query = query.not('replied_at', 'is', null)
          break
        case 'bounced':
          query = query.or('bounced_at.not.is.null,bounce_reason.not.is.null')
          break
      }
    }

    // Pagination range
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: rows, error } = await query.range(from, to)
    if (error) throw error

    // Build contact map
    const contactIds = Array.from(new Set((rows || []).map(r => r.contact_id).filter(Boolean)))
    let contactMap: Record<string, any> = {}
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, company_name')
        .in('id', contactIds as string[])
      contactMap = Object.fromEntries((contacts || []).map(c => [c.id, c]))
    }

    // Enrich rows
    const details = (rows || []).map(r => {
      const c = contactMap[r.contact_id] || {}
      const derivedStatus = r.replied_at ? 'replied' : r.clicked_at ? 'clicked' : r.opened_at ? 'opened' : (r.delivered_at || r.opened_at || r.clicked_at || r.replied_at) ? 'delivered' : r.sent_at ? 'sent' : (r.bounced_at || r.bounce_reason) ? 'bounced' : r.status || 'pending'
      return {
        id: r.id,
        recipient_email: c.email || r.recipient_email || 'Unknown',
        subject: r.subject || '',
        status: derivedStatus,
        sent_at: r.sent_at,
        delivered_at: r.delivered_at,
        opened_at: r.opened_at,
        clicked_at: r.clicked_at,
        replied_at: r.replied_at,
        bounce_reason: r.bounce_reason || null,
        contact_name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
        contact_company: c.company_name || null,
      }
    })

    // Optional search filter applied after enrichment (covers email/name/subject)
    const filtered = q
      ? details.filter(d =>
          (d.recipient_email || '').toLowerCase().includes(q) ||
          (d.contact_name || '').toLowerCase().includes(q) ||
          (d.subject || '').toLowerCase().includes(q)
        )
      : details

    return createSuccessResponse({
      page,
      pageSize,
      count: filtered.length,
      items: filtered,
    })

  } catch (error) {
    return handleApiError(error)
  }
})

