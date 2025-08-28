import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing AI outreach generation...')
    
    // Test data
    const testData = {
      purpose: "invite marketing managers to test our new lead generation SaaS tool that helps automate prospecting",
      language: "English" as const,
      signature: "John Doe\nCEO, TechCorp\njohn@techcorp.com\n+1-555-0123"
    }
    
    console.log('📨 Sending test request to AI generation endpoint...')
    
    // Make request to our AI generation endpoint
    const baseUrl = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const fullUrl = `${protocol}://${baseUrl}/api/ai/generate-outreach`
    
    console.log('🌐 Request URL:', fullUrl)
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth headers
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify(testData)
    })
    
    const result = await response.json()
    
    console.log('📋 AI generation result:', {
      status: response.status,
      success: result.success,
      hasSubject: !!result.data?.subject,
      hasHtmlContent: !!result.data?.htmlContent,
      subjectLength: result.data?.subject?.length || 0,
      contentLength: result.data?.htmlContent?.length || 0
    })
    
    return NextResponse.json({
      success: true,
      testData: testData,
      aiResponse: result,
      status: response.status,
      message: 'AI generation test completed'
    })
    
  } catch (error: any) {
    console.error('💥 Test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error.message
    }, { status: 500 })
  }
}