import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { emailTracker } from '@/lib/email-tracking'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🧪 Testing email tracking system...')
    
    // Get a recent email tracking record to test with
    const { data: emailRecords, error: recordError } = await supabase
      .from('email_tracking')
      .select('id, tracking_pixel_id, campaign_id, contact_id, opened_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (recordError) {
      console.error('❌ Error fetching email records:', recordError)
      return NextResponse.json({ error: recordError.message }, { status: 500 })
    }
    
    console.log(`📊 Found ${emailRecords?.length || 0} recent email records`)
    
    const testResults = []
    
    for (const record of emailRecords || []) {
      const pixelId = record.tracking_pixel_id
      const wasAlreadyOpened = !!record.opened_at
      
      console.log(`🎯 Testing tracking for pixel ID: ${pixelId} (already opened: ${wasAlreadyOpened})`)
      
      // Test the tracking functionality
      const trackingResult = await emailTracker.trackOpen(pixelId, 'test-user-agent', '127.0.0.1')
      
      testResults.push({
        emailId: record.id,
        pixelId: pixelId,
        wasAlreadyOpened: wasAlreadyOpened,
        trackingSuccess: trackingResult.success,
        isFirstOpen: trackingResult.firstOpen,
        campaignId: record.campaign_id,
        contactId: record.contact_id
      })
      
      console.log(`📈 Tracking result: Success=${trackingResult.success}, FirstOpen=${trackingResult.firstOpen}`)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Email tracking test completed',
      results: testResults,
      trackingPixelEndpoint: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tracking/pixel/[pixelId]`,
      summary: {
        totalTested: testResults.length,
        successfulTracking: testResults.filter(r => r.trackingSuccess).length,
        firstOpens: testResults.filter(r => r.isFirstOpen).length
      }
    })
    
  } catch (error) {
    console.error('💥 Test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error.message
    }, { status: 500 })
  }
}