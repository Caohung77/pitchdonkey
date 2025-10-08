import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to verify Ubuntu cron job is reaching the server
 *
 * This endpoint logs every request with timestamp and headers
 * to help verify the cron job is working correctly.
 */
export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString()
  const authHeader = request.headers.get('authorization')
  const userAgent = request.headers.get('user-agent')
  const host = request.headers.get('host')

  console.log('🔔 Cron Health Check Request Received:')
  console.log(`   ⏰ Timestamp: ${timestamp}`)
  console.log(`   🔐 Auth Header: ${authHeader ? 'Present (Bearer ...)' : 'Missing'}`)
  console.log(`   🌐 User Agent: ${userAgent}`)
  console.log(`   🏠 Host: ${host}`)
  console.log(`   📍 URL: ${request.url}`)

  // Verify CRON_SECRET if present
  const cronSecret = process.env.CRON_SECRET
  const isAuthorized = cronSecret ? authHeader === `Bearer ${cronSecret}` : true

  return NextResponse.json({
    success: true,
    message: 'Cron health check received successfully',
    timestamp,
    isAuthorized,
    headers: {
      authorization: authHeader ? 'Present' : 'Missing',
      userAgent: userAgent || 'None',
      host: host || 'Unknown'
    },
    environment: {
      hasCronSecret: !!cronSecret,
      nodeEnv: process.env.NODE_ENV
    }
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
