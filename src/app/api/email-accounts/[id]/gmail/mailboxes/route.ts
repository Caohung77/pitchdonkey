import { NextRequest, NextResponse } from 'next/server'
import { GmailIMAPSMTPServerService } from '@/lib/server/gmail-imap-smtp-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id
    const gmailService = new GmailIMAPSMTPServerService()

    const mailboxes = await gmailService.getGmailMailboxes(accountId)

    return NextResponse.json({ mailboxes })
  } catch (error) {
    console.error('Gmail mailboxes fetch error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch mailboxes' },
      { status: 500 }
    )
  }
}