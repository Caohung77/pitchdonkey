import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('🧪 Testing pixel tracking system...')
    
    // Get the most recent email tracking records with their pixel IDs
    const { data: emailRecords, error } = await supabase
      .from('email_tracking')
      .select('id, tracking_pixel_id, campaign_id, contact_id, opened_at, user_id')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('❌ Error fetching email records:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log(`📊 Found ${emailRecords?.length || 0} email tracking records`)
    
    const pixelInfo = []
    
    for (const record of emailRecords || []) {
      const pixelId = record.tracking_pixel_id
      const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tracking/pixel/${pixelId}`
      
      pixelInfo.push({
        emailId: record.id,
        pixelId: pixelId,
        trackingUrl: trackingPixelUrl,
        campaignId: record.campaign_id,
        contactId: record.contact_id,
        userId: record.user_id,
        alreadyOpened: !!record.opened_at,
        testCommand: `curl "${trackingPixelUrl}"`
      })
    }
    
    // Test one pixel if available
    let testResult = null
    if (pixelInfo.length > 0) {
      const testPixel = pixelInfo[0]
      console.log(`🎯 Testing pixel: ${testPixel.trackingUrl}`)
      
      try {
        // Import emailTracker here to test it
        const { emailTracker } = await import('@/lib/email-tracking')
        const trackResult = await emailTracker.trackOpen(testPixel.pixelId, 'test-user-agent', '127.0.0.1')
        
        testResult = {
          pixelId: testPixel.pixelId,
          success: trackResult.success,
          firstOpen: trackResult.firstOpen,
          message: trackResult.success ? 'Tracking successful' : 'Tracking failed'
        }
        
        console.log(`📈 Test result: ${JSON.stringify(testResult)}`)
        
      } catch (testError) {
        testResult = {
          pixelId: testPixel.pixelId,
          success: false,
          error: testError.message,
          message: 'Tracking test failed'
        }
        console.error('❌ Test error:', testError)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Pixel tracking test completed',
      totalRecords: emailRecords?.length || 0,
      pixelInfo: pixelInfo,
      testResult: testResult,
      instructions: [
        'Use the trackingUrl from any pixel to test email opens',
        'Copy and paste the testCommand to simulate an email open',
        'Check the opened_at field to see if tracking worked'
      ]
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