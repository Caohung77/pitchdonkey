import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imapMonitor } from '@/lib/imap-monitor'

// GET /api/admin/imap-monitor - Get monitoring status
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user (you may want to add admin check here)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get monitoring statistics
    const stats = await imapMonitor.getMonitoringStats()

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('❌ Error getting monitor status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/imap-monitor - Control monitoring service
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user (you may want to add admin check here)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, intervalMinutes, emailAccountId } = body

    switch (action) {
      case 'start':
        imapMonitor.start(intervalMinutes || 15)
        return NextResponse.json({
          success: true,
          message: `IMAP monitor started with ${intervalMinutes || 15} minute interval`
        })

      case 'stop':
        imapMonitor.stop()
        return NextResponse.json({
          success: true,
          message: 'IMAP monitor stopped'
        })

      case 'run_cycle':
        await imapMonitor.runMonitoringCycle()
        return NextResponse.json({
          success: true,
          message: 'Monitoring cycle completed'
        })

      case 'force_sync':
        if (!emailAccountId) {
          return NextResponse.json(
            { error: 'emailAccountId required for force sync' },
            { status: 400 }
          )
        }
        
        const result = await imapMonitor.forceSyncAccount(emailAccountId)
        return NextResponse.json({
          success: true,
          message: 'Force sync completed',
          data: result
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, run_cycle, or force_sync' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error controlling monitor:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}