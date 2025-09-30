import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Fix Stuck Campaign
 *
 * This endpoint fixes campaigns that are stuck in 'sending' status
 * by resetting them to 'scheduled' so they can be picked up by cron.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing stuck campaigns...')

    const supabase = createServerSupabaseClient()

    // Find campaigns stuck in 'sending' status with 0 emails sent
    const { data: stuckCampaigns, error: findError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        created_at,
        scheduled_date
      `)
      .eq('status', 'sending')

    if (findError) {
      console.error('❌ Error finding stuck campaigns:', findError)
      return NextResponse.json({
        success: false,
        error: 'Failed to find stuck campaigns',
        details: findError.message
      }, { status: 500 })
    }

    console.log(`📊 Found ${stuckCampaigns?.length || 0} campaigns in 'sending' status`)

    if (!stuckCampaigns || stuckCampaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stuck campaigns found',
        processed: 0
      })
    }

    // Reset stuck campaigns to 'scheduled' status
    const results = []

    for (const campaign of stuckCampaigns) {
      console.log(`🔄 Fixing campaign: ${campaign.name} (${campaign.id})`)

      try {
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            status: 'scheduled',
            // Reset batch tracking if fields exist
            current_batch_number: 0,
            next_batch_send_time: null,
            first_batch_sent_at: null,
            contacts_processed: [],
            contacts_remaining: [],
            contacts_failed: [],
            batch_history: []
          })
          .eq('id', campaign.id)

        if (updateError) {
          console.error(`❌ Failed to fix campaign ${campaign.name}:`, updateError)
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            success: false,
            error: updateError.message
          })
        } else {
          console.log(`✅ Fixed campaign: ${campaign.name}`)
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            success: true,
            action: 'Reset to scheduled status'
          })
        }
      } catch (err) {
        console.error(`💥 Error fixing campaign ${campaign.name}:`, err)
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length

    console.log(`📊 Fixed ${successCount}/${stuckCampaigns.length} stuck campaigns`)

    return NextResponse.json({
      success: successCount > 0,
      message: `Fixed ${successCount}/${stuckCampaigns.length} stuck campaigns`,
      processed: stuckCampaigns.length,
      successful: successCount,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Critical error fixing stuck campaigns:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fix stuck campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}