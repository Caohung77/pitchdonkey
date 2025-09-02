import { NextRequest, NextResponse } from 'next/server'
import { campaignProcessor } from '@/lib/campaign-processor'

/**
 * Test endpoint to manually trigger campaign processing
 * This helps debug campaign processing issues
 */
export async function POST(request: NextRequest) {
  console.log('🧪 Manual campaign processing test triggered')
  
  try {
    console.log('🚀 Starting campaign processor...')
    
    // Wait for the processor to complete (instead of running in background)
    await campaignProcessor.processReadyCampaigns()
    
    console.log('✅ Campaign processing completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Campaign processing completed',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error in campaign processing test:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Campaign processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}