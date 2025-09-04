import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { imapMonitor } from '@/lib/imap-monitor'

// POST /api/inbox/reconcile - Run a reconciliation pass (UID + Message-ID) for all active accounts
export const POST = withAuth(async (request: NextRequest, user, ctx) => {
  try {
    await imapMonitor.runMonitoringCycle() // triggers sync + reconcile per connection
    return NextResponse.json({ success: true, message: 'Reconciliation cycle triggered' })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed' }, { status: 500 })
  }
})

