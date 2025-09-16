import { NextRequest, NextResponse } from 'next/server'
import { GmailIMAPSMTPServerService } from '@/lib/server/gmail-imap-smtp-server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id
    const emailOptions = await request.json()

    const gmailService = new GmailIMAPSMTPServerService()

    const result = await gmailService.sendGmailEmail(accountId, emailOptions)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Gmail email send error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}