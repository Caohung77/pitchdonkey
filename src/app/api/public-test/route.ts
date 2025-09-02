import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple test endpoint that doesn't require complex routing
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Campaign testing endpoint is working',
      timestamp: new Date().toISOString(),
      deploymentStatus: 'active'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing campaign processing system')
    
    // Import campaign processor
    const { campaignProcessor } = await import('@/lib/campaign-processor')
    
    // Test the processor
    console.log('🚀 Running campaign processor test...')
    await campaignProcessor.processReadyCampaigns()
    
    return NextResponse.json({
      success: true,
      message: 'Campaign processor test completed',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Test error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Campaign processor test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}