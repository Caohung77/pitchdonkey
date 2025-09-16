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

    const gmailService = new GmailIMAPSMTPServerService()

    const count = await gmailService.getGmailEmailCount(accountId, mailbox)

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Gmail email count error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get email count' },
      { status: 500 }
    )
  }
}