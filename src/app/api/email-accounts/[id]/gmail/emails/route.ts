import { NextRequest, NextResponse } from 'next/server'
import { GmailIMAPSMTPServerService } from '@/lib/server/gmail-imap-smtp-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id
    const { searchParams } = new URL(request.url)

    const mailbox = searchParams.get('mailbox') || 'INBOX'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined
    const unseen = searchParams.get('unseen') === 'true'

    const gmailService = new GmailIMAPSMTPServerService()

    const emails = await gmailService.fetchGmailEmails(accountId, mailbox, {
      limit,
      since,
      unseen
    })

    return NextResponse.json({ emails })
  } catch (error) {
    console.error('Gmail emails fetch error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}