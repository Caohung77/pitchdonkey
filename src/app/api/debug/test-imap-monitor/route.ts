import { NextRequest, NextResponse } from 'next/server'
import { imapMonitor } from '@/lib/imap-monitor'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing IMAP monitor status...')

    // Get monitoring statistics
    const stats = await imapMonitor.getMonitoringStats()

    console.log('📊 Monitor stats:', stats)

    return NextResponse.json({
      success: true,
      message: 'IMAP monitor status retrieved',
      data: stats
    })

  } catch (error) {
    console.error('❌ Error getting monitor status:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    console.log(`🎯 Testing IMAP monitor action: ${action}`)

    switch (action) {
      case 'get_stats':
        const stats = await imapMonitor.getMonitoringStats()
        return NextResponse.json({
          success: true,
          message: 'Monitor stats retrieved',
          data: stats
        })

      case 'test_cycle':
        console.log('🔄 Running test monitoring cycle...')
        // Don't actually run the cycle to avoid errors without real email accounts
        // Just test that the monitor can be initialized
        return NextResponse.json({
          success: true,
          message: 'Monitor cycle test completed (simulated)',
          data: { 
            note: 'Actual cycle not run to avoid errors without configured email accounts',
            monitorExists: typeof imapMonitor !== 'undefined'
          }
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: get_stats, test_cycle' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error testing monitor:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}