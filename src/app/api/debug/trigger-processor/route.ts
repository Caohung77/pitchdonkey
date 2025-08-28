import { NextRequest, NextResponse } from 'next/server'
import { campaignProcessor } from '@/lib/campaign-processor'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Manually triggering campaign processor...')
    
    // Trigger campaign processing
    await campaignProcessor.processReadyCampaigns()
    
    return NextResponse.json({
      success: true,
      message: 'Campaign processor triggered successfully'
    })
    
  } catch (error) {
    console.error('💥 Trigger error:', error)
    return NextResponse.json({
      success: false,
      error: 'Trigger failed',
      details: error.message
    }, { status: 500 })
  }
}