import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing click tracking API endpoint accessibility...')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Test data
    const testClickId = 'test_click_123456'
    const testClickUrl = `${baseUrl}/api/tracking/click/${testClickId}`

    console.log(`🎯 Testing click URL: ${testClickUrl}`)

    // Test if we can make a request to our own click tracking endpoint
    try {
      const response = await fetch(testClickUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Test Bot)',
          'X-Forwarded-For': '127.0.0.1'
        }
      })

      const responseText = await response.text()

      return NextResponse.json({
        success: true,
        message: 'Click tracking API test completed',
        timestamp: new Date().toISOString(),
        testUrl: testClickUrl,
        testResult: {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          headers: Object.fromEntries(response.headers.entries())
        },
        analysis: {
          apiAccessible: response.status !== 500,
          expectedBehavior: response.status === 404 ? 'Expected - test click ID not found' :
                           response.status === 302 ? 'Unexpected - should not redirect for invalid ID' :
                           response.status === 500 ? 'Error - API has issues' : 'Unknown',
          recommendation: response.status === 404 ? 'API is working correctly (404 for invalid ID is expected)' :
                         response.status === 500 ? 'API has internal errors - check implementation' :
                         'API response needs investigation'
        }
      })

    } catch (fetchError) {
      return NextResponse.json({
        success: false,
        message: 'Click tracking API is not accessible',
        timestamp: new Date().toISOString(),
        testUrl: testClickUrl,
        error: fetchError.message,
        recommendation: 'Check if the API endpoint exists and is properly configured'
      })
    }

  } catch (error) {
    console.error('💥 Click API test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Click API test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}