import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

// GET /api/inbox/debug-fetch - Debug email fetching to see what's being filtered
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }
) => {
  try {
    const url = new URL(request.url)
    const emailAccountId = url.searchParams.get('accountId')

    if (!emailAccountId) {
      return NextResponse.json({
        success: false,
        error: 'Missing accountId parameter',
        code: 'MISSING_PARAMETER'
      }, { status: 400 })
    }

    // Verify the email account belongs to the user
    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('id, email, provider')
      .eq('id', emailAccountId)
      .eq('user_id', user.id)
      .single()

    if (error || !account) {
      return NextResponse.json({
        success: false,
        error: 'Email account not found or access denied',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    console.log('🔍 DEBUG: Fetching emails for account:', account.email)

    // Fetch emails using Gmail API with NO filters or limits
    const { GmailIMAPSMTPServerService } = await import('@/lib/server/gmail-imap-smtp-server')
    const gmailService = new GmailIMAPSMTPServerService()

    // Fetch last 30 days with NO limit to see everything
    const since = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))

    console.log(`🔍 DEBUG: Fetching INBOX emails since ${since.toISOString()}`)
    const inboxEmails = await gmailService.fetchGmailEmails(account.id, 'INBOX', {
      unseen: false,
      since: since,
      limit: 1000 // Fetch up to 1000 emails for debugging
    })

    console.log(`🔍 DEBUG: Fetched ${inboxEmails.length} total emails from INBOX`)

    // Analyze the emails
    const analysis = {
      totalFetched: inboxEmails.length,
      emails: inboxEmails.map(email => ({
        subject: email.subject,
        from: email.from,
        to: email.to,
        date: email.date,
        messageId: email.messageId,
        gmailMessageId: email.gmailMessageId,
        isFromSelf: email.from && email.from.toLowerCase().includes(account.email.toLowerCase()),
        fromDomain: email.from ? email.from.split('@')[1]?.replace('>', '') : 'unknown'
      })),
      byDomain: {} as Record<string, number>,
      selfSentCount: 0,
      externalCount: 0
    }

    // Count by domain and self-sent
    for (const email of analysis.emails) {
      const domain = email.fromDomain || 'unknown'
      analysis.byDomain[domain] = (analysis.byDomain[domain] || 0) + 1

      if (email.isFromSelf) {
        analysis.selfSentCount++
      } else {
        analysis.externalCount++
      }
    }

    console.log('🔍 DEBUG: Analysis:', {
      total: analysis.totalFetched,
      selfSent: analysis.selfSentCount,
      external: analysis.externalCount,
      domains: analysis.byDomain
    })

    const response = NextResponse.json({
      success: true,
      account: account.email,
      analysis: analysis
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('❌ Error in debug fetch API:', error)

    return NextResponse.json({
      success: false,
      error: error?.message || 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error?.stack,
        name: error?.name
      } : undefined
    }, { status: 500 })
  }
})
