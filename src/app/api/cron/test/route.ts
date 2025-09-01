import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to verify Vercel Cron Job functionality
 * This endpoint can be used to test if cron jobs are working correctly
 */
export async function GET(request: NextRequest) {
  console.log('🧪 Test cron endpoint called')
  
  const userAgent = request.headers.get('user-agent')
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  console.log('User Agent:', userAgent)
  console.log('Has Authorization header:', !!authHeader)
  console.log('Has CRON_SECRET:', !!cronSecret)
  
  // Security check (same as main cron job)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (!userAgent?.includes('vercel-cron')) {
      console.error('❌ Unauthorized request')
      return new Response('Unauthorized', { status: 401 })
    }
  }
  
  const timestamp = new Date().toISOString()
  
  console.log(`✅ Test cron job executed successfully at ${timestamp}`)
  
  return NextResponse.json({
    success: true,
    message: 'Cron test endpoint working',
    timestamp,
    userAgent,
    environment: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasCronSecret: !!process.env.CRON_SECRET,
      nodeEnv: process.env.NODE_ENV
    }
  })
}

/**
 * POST endpoint for manual testing
 */
export async function POST(request: NextRequest) {
  console.log('🧪 Manual test of cron endpoint')
  return GET(request)
}