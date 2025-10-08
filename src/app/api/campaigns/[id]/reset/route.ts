import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Reset Campaign Endpoint
 *
 * Resets a "completed" campaign back to "sending" status to resume batch processing.
 * Useful for campaigns that were prematurely marked as completed due to bugs.
 *
 * Usage:
 * POST /api/campaigns/{campaign_id}/reset
 *
 * Optional body parameters:
 * - confirm: boolean (required for safety - must be true)
 * - resetBatches: boolean (default: false) - reset all batch statuses to pending
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id
    const body = await request.json()
    const { confirm, resetBatches = false } = body

    // Safety check: require explicit confirmation
    if (!confirm) {
      return NextResponse.json({
        success: false,
        error: 'Confirmation required',
        message: 'Please set confirm: true in request body to reset campaign'
      }, { status: 400 })
    }

    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current campaign
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found',
        campaignId
      }, { status: 404 })
    }

    console.log(`🔄 Resetting campaign: ${campaign.name} (${campaignId})`)
    console.log(`   Current status: ${campaign.status}`)
    console.log(`   Emails sent: ${campaign.emails_sent || 0}/${campaign.total_contacts || 0}`)

    // Prepare update data
    const updateData: any = {
      status: 'sending',
      end_date: null, // Clear completion timestamp
      updated_at: new Date().toISOString()
    }

    // Reset batch schedule if requested
    if (resetBatches && campaign.batch_schedule?.batches) {
      console.log(`   🔄 Resetting batch statuses to pending`)

      const updatedBatches = campaign.batch_schedule.batches.map((batch: any) => {
        // Reset sent batches back to pending (but keep completed_at for history)
        if (batch.status === 'sent') {
          return {
            ...batch,
            status: 'pending'
          }
        }
        return batch
      })

      updateData.batch_schedule = {
        ...campaign.batch_schedule,
        batches: updatedBatches
      }

      // Set next batch time to first pending batch
      const firstPendingBatch = updatedBatches.find((b: any) => b.status === 'pending')
      if (firstPendingBatch) {
        updateData.next_batch_send_time = firstPendingBatch.scheduled_time
        console.log(`   📅 Next batch scheduled for: ${firstPendingBatch.scheduled_time}`)
      }
    } else if (campaign.batch_schedule?.batches) {
      // Just find the next pending batch without resetting statuses
      const nextPendingBatch = campaign.batch_schedule.batches.find((b: any) => b.status === 'pending')
      if (nextPendingBatch) {
        updateData.next_batch_send_time = nextPendingBatch.scheduled_time
        console.log(`   📅 Next pending batch: ${nextPendingBatch.scheduled_time}`)
      } else {
        console.log(`   ⚠️ No pending batches found - all batches already sent`)
      }
    }

    // Update campaign
    const { data: updatedCampaign, error: updateError } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      console.error(`❌ Failed to update campaign:`, updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update campaign',
        details: updateError.message
      }, { status: 500 })
    }

    console.log(`✅ Campaign reset successfully`)
    console.log(`   New status: ${updatedCampaign.status}`)
    console.log(`   Next batch: ${updatedCampaign.next_batch_send_time || 'none'}`)

    return NextResponse.json({
      success: true,
      message: 'Campaign reset successfully',
      campaign: {
        id: updatedCampaign.id,
        name: updatedCampaign.name,
        status: updatedCampaign.status,
        emails_sent: updatedCampaign.emails_sent || 0,
        total_contacts: updatedCampaign.total_contacts || 0,
        next_batch_send_time: updatedCampaign.next_batch_send_time,
        batches_reset: resetBatches
      },
      next_steps: [
        'Campaign status changed to "sending"',
        'Ubuntu cron will pick it up within 5 minutes',
        resetBatches
          ? 'All batches reset to pending - will resend emails'
          : 'Only remaining pending batches will be sent'
      ]
    })

  } catch (error) {
    console.error('❌ Error resetting campaign:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
