import { NextRequest, NextResponse } from 'next/server'
import { imapMonitor } from '@/lib/imap-monitor'

// POST /api/debug/force-imap-cycle - Force run IMAP cycle for debugging
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Force triggering IMAP monitoring cycle for debugging...')
    
    // Force run the monitoring cycle
    await imapMonitor.runMonitoringCycle()
    
    // Get updated stats
    const stats = await imapMonitor.getMonitoringStats()

    return NextResponse.json({
      success: true,
      message: 'IMAP monitoring cycle completed',
      stats
    })

  } catch (error) {
    console.error('❌ Error in force IMAP cycle:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to run IMAP cycle' 
      },
      { status: 500 }
    )
  }
}