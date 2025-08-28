import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Reset the achnö campaign to sending status for testing
    const campaignId = "2025835a-355d-49e3-b9b2-71d7b4f3fbe0"
    
    console.log(`🔄 Resetting campaign ${campaignId} to sending status for testing...`)
    
    // Clear existing tracking records for this campaign
    const { error: deleteError } = await supabase
      .from('email_tracking')
      .delete()
      .eq('campaign_id', campaignId)
    
    if (deleteError) {
      console.error('⚠️ Error clearing tracking records:', deleteError)
    } else {
      console.log('✅ Cleared existing tracking records')
    }
    
    // Reset campaign status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'sending'
      })
      .eq('id', campaignId)
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    
    console.log('✅ Campaign status reset to sending')
    
    return NextResponse.json({
      success: true,
      message: `Campaign ${campaignId} reset to sending status`,
      next_steps: [
        'Trigger the campaign processor to test the fix',
        'Check if email tracking records are created properly'
      ]
    })
    
  } catch (error) {
    console.error('💥 Reset error:', error)
    return NextResponse.json({
      success: false,
      error: 'Reset failed',
      details: error.message
    }, { status: 500 })
  }
}