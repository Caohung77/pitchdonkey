import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { EmailLinkRewriter } from '@/lib/email-link-rewriter'
import { emailTracker } from '@/lib/email-tracking'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    console.log('🧪 Testing click tracking functionality...')

    const testResults = {
      linkRewriting: null,
      trackingUrlGeneration: null,
      clickTracking: null,
      databaseRecords: null,
      errors: []
    }

    // Test 1: Link Rewriting
    console.log('🔗 Testing link rewriting...')
    try {
      const testHtml = `
        <html>
          <body>
            <p>Check out our <a href="https://example.com/products">products</a></p>
            <p>Visit our <a href="https://blog.example.com">blog</a></p>
            <p>Contact us at <a href="mailto:support@example.com">support</a></p>
            <p><a href="https://example.com/unsubscribe">Unsubscribe</a></p>
          </body>
        </html>
      `

      const processedHtml = await EmailLinkRewriter.rewriteLinksForTracking(
        testHtml,
        'test_msg_123',
        'test@example.com',
        'test_campaign_123',
        'test_contact_123'
      )

      const trackingUrlCount = (processedHtml.match(/\/api\/tracking\/click\//g) || []).length

      testResults.linkRewriting = {
        success: trackingUrlCount > 0,
        trackingUrlsGenerated: trackingUrlCount,
        expectedCount: 2, // products and blog links should be rewritten
        originalHtml: testHtml,
        processedHtml: processedHtml
      }

      console.log(`✅ Link rewriting test: ${trackingUrlCount} tracking URLs generated`)

    } catch (error) {
      testResults.errors.push(`Link rewriting failed: ${error.message}`)
      testResults.linkRewriting = { success: false, error: error.message }
      console.error('❌ Link rewriting test failed:', error)
    }

    // Test 2: Direct Tracking URL Generation
    console.log('🎯 Testing tracking URL generation...')
    try {
      const trackingUrl = await emailTracker.generateClickTrackingUrl(
        'test_msg_456',
        'test@example.com',
        'https://example.com/test',
        'test_campaign_123',
        'test_contact_123'
      )

      testResults.trackingUrlGeneration = {
        success: !!trackingUrl,
        trackingUrl: trackingUrl,
        containsTrackingPath: trackingUrl.includes('/api/tracking/click/')
      }

      console.log(`✅ Tracking URL generated: ${trackingUrl}`)

    } catch (error) {
      testResults.errors.push(`Tracking URL generation failed: ${error.message}`)
      testResults.trackingUrlGeneration = { success: false, error: error.message }
      console.error('❌ Tracking URL generation failed:', error)
    }

    // Test 3: Click Tracking (if we have a tracking URL)
    if (testResults.trackingUrlGeneration?.success) {
      console.log('👆 Testing click tracking...')
      try {
        // Extract click ID from the tracking URL
        const trackingUrl = testResults.trackingUrlGeneration.trackingUrl
        const clickIdMatch = trackingUrl.match(/\/api\/tracking\/click\/([^\/\?]+)/)

        if (clickIdMatch) {
          const clickId = clickIdMatch[1]
          console.log(`🎯 Testing click tracking for ID: ${clickId}`)

          const clickResult = await emailTracker.trackClick(
            clickId,
            'Mozilla/5.0 (Test User Agent)',
            '127.0.0.1'
          )

          testResults.clickTracking = {
            success: clickResult.success,
            clickId: clickId,
            redirectUrl: clickResult.redirectUrl,
            firstClick: clickResult.firstClick,
            result: clickResult
          }

          console.log(`✅ Click tracking test: Success=${clickResult.success}, Redirect=${clickResult.redirectUrl}`)

        } else {
          testResults.errors.push('Could not extract click ID from tracking URL')
          testResults.clickTracking = { success: false, error: 'Invalid tracking URL format' }
        }

      } catch (error) {
        testResults.errors.push(`Click tracking failed: ${error.message}`)
        testResults.clickTracking = { success: false, error: error.message }
        console.error('❌ Click tracking test failed:', error)
      }
    }

    // Test 4: Check Database Records
    console.log('📊 Checking database records...')
    try {
      // Check recent click_tracking records
      const { data: clickRecords, error: clickError } = await supabase
        .from('click_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      // Check recent email_events for clicks
      const { data: eventRecords, error: eventError } = await supabase
        .from('email_events')
        .select('*')
        .eq('type', 'clicked')
        .order('timestamp', { ascending: false })
        .limit(5)

      testResults.databaseRecords = {
        clickTrackingRecords: clickRecords?.length || 0,
        clickEventRecords: eventRecords?.length || 0,
        latestClickRecord: clickRecords?.[0] || null,
        latestClickEvent: eventRecords?.[0] || null,
        clickError: clickError?.message || null,
        eventError: eventError?.message || null
      }

      console.log(`📊 Database check: ${clickRecords?.length || 0} click records, ${eventRecords?.length || 0} click events`)

    } catch (error) {
      testResults.errors.push(`Database check failed: ${error.message}`)
      testResults.databaseRecords = { error: error.message }
      console.error('❌ Database check failed:', error)
    }

    // Overall assessment
    const allTestsPassed = testResults.linkRewriting?.success &&
                          testResults.trackingUrlGeneration?.success &&
                          testResults.clickTracking?.success

    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed ? 'All click tracking tests passed!' : 'Some click tracking tests failed',
      timestamp: new Date().toISOString(),
      testResults,
      summary: {
        linkRewritingWorks: testResults.linkRewriting?.success || false,
        trackingUrlGenerationWorks: testResults.trackingUrlGeneration?.success || false,
        clickTrackingWorks: testResults.clickTracking?.success || false,
        databaseAccessible: !testResults.databaseRecords?.error,
        totalErrors: testResults.errors.length
      },
      nextSteps: allTestsPassed ? [
        'Click tracking is working correctly',
        'Test with real email campaign',
        'Check campaign analytics for click data'
      ] : [
        'Review error messages above',
        'Check database schema and permissions',
        'Verify environment variables are set',
        'Test individual components that failed'
      ]
    })

  } catch (error) {
    console.error('💥 Click tracking test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Click tracking test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}