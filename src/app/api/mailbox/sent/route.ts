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

    // Fetch sent emails directly from Gmail API using SENT label
    let gmailSent: any[] = []
    let gmailCount = 0
    let gmailError = null

    try {
      const { GmailIMAPSMTPServerService } = await import('@/lib/server/gmail-imap-smtp-server')
      const gmailService = new GmailIMAPSMTPServerService()

      // Get the email account to fetch from
      const { data: emailAccount } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'gmail')
        .limit(1)
        .single()

      if (emailAccount) {
        const sentEmails = await gmailService.fetchGmailEmails(emailAccount.id, 'SENT', {
          limit: limit + offset, // Fetch more to account for pagination
          unseen: false
        })

        gmailSent = sentEmails.map(email => ({
          id: email.messageId,
          subject: email.subject,
          text_content: email.textBody,
          html_content: email.htmlBody,
          date_received: email.date,
          to_address: email.to,
          from_address: email.from,
          created_at: email.date,
          email_account_id: emailAccount.id
        }))

        gmailCount = gmailSent.length
      }
    } catch (error) {
      console.error('Error fetching Gmail sent emails:', error)
      gmailError = error
    }

    // Fetch campaign emails from email_sends table
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

    const { data: campaignEmails, error: campaignError, count: campaignCount } = await campaignQuery

    // Combine both sources
    const allEmails = [
      ...(gmailSent || []).map(email => ({
        id: email.id,
        subject: email.subject,
        content: email.text_content || email.html_content,
        send_status: 'sent',
        sent_at: email.date_received,
        created_at: email.created_at,
        email_account_id: email.email_account_id,
        to_address: email.to_address,
        source: 'gmail'
      })),
      ...(campaignEmails || []).map(email => ({
        ...email,
        source: 'campaign'
      }))
    ]

    // Sort by sent date
    allEmails.sort((a, b) => {
      const dateA = new Date(a.sent_at || a.created_at).getTime()
      const dateB = new Date(b.sent_at || b.created_at).getTime()
      return dateB - dateA
    })

    // Apply pagination
    const paginatedEmails = allEmails.slice(offset, offset + limit)
    const totalCount = (gmailCount || 0) + (campaignCount || 0)

    const error = gmailError || campaignError
    const emails = paginatedEmails

    if (error) {
      console.error('Error fetching sent emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sent emails',
        code: 'FETCH_ERROR',
      }, { status: 500 })
    }

    const accountIds = (emails || [])
      .map(email => email.email_account_id)
      .filter((value): value is string => Boolean(value))

    let accountMap: Record<string, { id: string; email: string; provider: string }> = {}

    if (accountIds.length) {
      const { data: accounts, error: accountError } = await supabase
        .from('email_accounts')
        .select('id, email, provider, status, deleted_at')
        .in('id', Array.from(new Set(accountIds)))
        .eq('user_id', user.id)

      if (accountError) {
        console.error('Error fetching account metadata for sent mailbox:', accountError)
      } else if (accounts) {
        for (const account of accounts) {
          accountMap[account.id] = {
            id: account.id,
            email: account.email,
            provider: account.provider,
          }
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      emails: (emails || []).map(email => ({
        ...email,
        email_accounts: email.email_account_id ? accountMap[email.email_account_id] || null : null,
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: totalCount > offset + limit,
      },
    })

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
