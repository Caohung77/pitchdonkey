import { NextRequest, NextResponse } from 'next/server'
import { GmailIMAPSMTPServerService } from '@/lib/server/gmail-imap-smtp-server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id
    const gmailService = new GmailIMAPSMTPServerService()

    const result = await gmailService.testGmailConnection(accountId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Gmail connection test error:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          imap: false,
          smtp: false
        }
      },
      { status: 500 }
    )
  }
}