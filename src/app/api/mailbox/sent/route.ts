import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    await withRateLimit(user, 60, 60000)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')
    const accountId = searchParams.get('account_id')
    const status = searchParams.get('status')

    // OPTIMIZATION: Query from outgoing_emails database (like inbox)
    // This gives us the same fast performance as inbox (~100ms vs ~3000ms with Gmail API)

    // Build query for outgoing_emails (Gmail sent emails stored in DB)
    // Using LEFT JOIN to show emails even if email_account is deleted/inactive
    let outgoingQuery = supabase
      .from('outgoing_emails')
      .select(`
        id,
        from_address,
        to_address,
        subject,
        date_sent,
        text_content,
        html_content,
        created_at,
        email_account_id,
        contact_id,
        contact_id,
        contact:contacts!outgoing_emails_contact_id_fkey (
          id,
          first_name,
          last_name,
          email
        ),
        email_accounts!left (
          id,
          email,
          provider
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('date_sent', { ascending: false })

    if (accountId && accountId !== 'all') {
      outgoingQuery = outgoingQuery.eq('email_account_id', accountId)
    }

    if (search) {
      outgoingQuery = outgoingQuery.or(`to_address.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    // Build query for campaign emails (from email_sends table)
    const baseSelect = `
      id,
      subject,
      content,
      send_status,
      sent_at,
      created_at,
      email_account_id,
      contact_id,
      campaign_id,
      contacts (
        id,
        first_name,
        last_name,
        email
      ),
      campaigns (
        id,
        name
      )
    `

    let campaignQuery = supabase
      .from('email_sends')
      .select(baseSelect, { count: 'exact' })
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false, nullsLast: false })
      .order('created_at', { ascending: false })

    if (accountId && accountId !== 'all') {
      campaignQuery = campaignQuery.eq('email_account_id', accountId)
    }

    if (status && status !== 'all') {
      campaignQuery = campaignQuery.eq('send_status', status)
    }

    if (search) {
      campaignQuery = campaignQuery.or(`subject.ilike.%${search}%,content.ilike.%${search}%`)
    }

    // Fetch both in parallel
    const [outgoingResult, campaignResult] = await Promise.all([
      outgoingQuery,
      campaignQuery
    ])

    const { data: outgoingEmails, error: outgoingError, count: outgoingCount } = outgoingResult
    const { data: campaignEmails, error: campaignError, count: campaignCount } = campaignResult

    // Diagnostic logging for debugging
    console.log(`📧 Sent emails query results:
  - User ID: ${user.id}
  - Account ID filter: ${accountId || 'all'}
  - Outgoing emails count: ${outgoingCount || 0}
  - Campaign emails count: ${campaignCount || 0}
  - Outgoing emails fetched: ${outgoingEmails?.length || 0}
  - Campaign emails fetched: ${campaignEmails?.length || 0}
  - Search filter: ${search || 'none'}
  - Status filter: ${status || 'all'}`)

    // Build contact lookup for outgoing emails
    let outgoingContactMap: Record<string, any> = {}
    if (outgoingEmails && outgoingEmails.length > 0) {
      const contactIds = Array.from(
        new Set(
          outgoingEmails
            .map(email => email.contact_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      if (contactIds.length > 0) {
        const { data: outgoingContacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email')
          .in('id', contactIds)

        if (outgoingContacts && outgoingContacts.length > 0) {
          outgoingContactMap = outgoingContacts.reduce<Record<string, any>>((acc, contact) => {
            acc[contact.id] = contact
            return acc
          }, {})
        }
      }
    }

    // Combine both sources
    const allEmails = [
      ...(outgoingEmails || []).map(email => ({
        id: email.id,
        subject: email.subject,
        content: email.text_content || email.html_content,
        send_status: 'sent',
        sent_at: email.date_sent,
        created_at: email.created_at,
        email_account_id: email.email_account_id,
        to_address: email.to_address,
        from_address: email.from_address,
        email_accounts: email.email_accounts,
        contact_id: email.contact_id,
        contacts: email.contact_id ? outgoingContactMap[email.contact_id] || null : null,
        source: 'gmail'
      })),
      ...(campaignEmails || []).map(email => ({
        ...email,
        source: 'campaign'
      }))
    ]

    // Sort by sent date (most recent first)
    allEmails.sort((a, b) => {
      const dateA = new Date(a.sent_at || a.created_at).getTime()
      const dateB = new Date(b.sent_at || b.created_at).getTime()
      return dateB - dateA
    })

    // Apply pagination
    const paginatedEmails = allEmails.slice(offset, offset + limit)
    const totalCount = (outgoingCount || 0) + (campaignCount || 0)

    const error = outgoingError || campaignError
    const emails = paginatedEmails

    if (error) {
      console.error('Error fetching sent emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sent emails',
        code: 'FETCH_ERROR',
      }, { status: 500 })
    }

    const response = NextResponse.json({
      success: true,
      emails: emails || [],
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: totalCount > offset + limit,
      },
    })

    // Add cache headers (browser caching for 5 minutes)
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error in sent mailbox API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    }, { status: 500 })
  }
})
