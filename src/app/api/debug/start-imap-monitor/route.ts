import { NextRequest, NextResponse } from 'next/server'
import { imapMonitor } from '@/lib/imap-monitor'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { intervalMinutes = 15 } = body

    console.log(`🚀 Starting IMAP monitor with ${intervalMinutes} minute interval...`)

    // Start the monitoring service
    imapMonitor.start(intervalMinutes)

    // Wait a moment and get stats
    await new Promise(resolve => setTimeout(resolve, 1000))
    const stats = await imapMonitor.getMonitoringStats()

    console.log('📊 Monitor started. Current stats:', stats)

    return NextResponse.json({
      success: true,
      message: `IMAP monitor started with ${intervalMinutes} minute interval`,
      stats
    })

  } catch (error) {
    console.error('❌ Error starting IMAP monitor:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to start IMAP monitor' 
      },
      { status: 500 }
    )
  }
}