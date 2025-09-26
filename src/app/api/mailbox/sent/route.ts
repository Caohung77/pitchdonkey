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

    let query = supabase
      .from('email_sends')
      .select(baseSelect, { count: 'exact' })
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false, nullsLast: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (accountId && accountId !== 'all') {
      query = query.eq('email_account_id', accountId)
    }

    if (status && status !== 'all') {
      query = query.eq('send_status', status)
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,content.ilike.%${search}%`)
    }

    const { data: emails, error, count } = await query

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
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
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
