import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

/**
 * Debug endpoint to test batch scheduling calculations
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const { campaignId, testTime } = await request.json()

    // Get campaign with batch scheduling fields
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        daily_send_limit,
        first_batch_sent_at,
        next_batch_send_time,
        current_batch_number,
        created_at
      `)
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const now = testTime ? new Date(testTime) : new Date()

    // Calculate batch timing info
    const isFirstBatch = !campaign.first_batch_sent_at
    const currentBatchNumber = campaign.current_batch_number || 0

    let result = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        daily_send_limit: campaign.daily_send_limit
      },
      timing: {
        current_time: now.toISOString(),
        is_first_batch: isFirstBatch,
        current_batch_number: currentBatchNumber,
        first_batch_sent_at: campaign.first_batch_sent_at,
        next_batch_send_time: campaign.next_batch_send_time
      },
      calculations: {}
    }

    if (isFirstBatch) {
      // First batch calculations
      const nextBatchTime = new Date(now.getTime() + (24 * 60 * 60 * 1000))
      result.calculations = {
        action: 'start_first_batch',
        next_batch_scheduled_for: nextBatchTime.toISOString(),
        hours_until_next_batch: 24
      }
    } else if (campaign.next_batch_send_time) {
      // Subsequent batch calculations
      const nextBatchTime = new Date(campaign.next_batch_send_time)
      const timeUntilBatch = nextBatchTime.getTime() - now.getTime()
      const timeWindow = 5 * 60 * 1000 // 5 minutes

      const minutesUntilBatch = Math.round(timeUntilBatch / (60 * 1000))

      let windowStatus = 'ready'
      let canSend = true

      if (timeUntilBatch > timeWindow) {
        windowStatus = 'early'
        canSend = false
      } else if (timeUntilBatch < -timeWindow) {
        windowStatus = 'overdue'
      }

      const nextNextBatchTime = new Date(nextBatchTime.getTime() + (24 * 60 * 60 * 1000))

      result.calculations = {
        action: canSend ? 'send_batch' : 'wait',
        can_send: canSend,
        window_status: windowStatus,
        minutes_until_batch: minutesUntilBatch,
        time_window_minutes: 5,
        next_batch_after_this: nextNextBatchTime.toISOString()
      }
    } else {
      result.calculations = {
        action: 'error',
        message: 'Missing next_batch_send_time for non-first batch'
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Batch scheduling debug error:', error)
    return NextResponse.json({
      error: 'Failed to debug batch scheduling',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Get all campaigns with batch scheduling info
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        daily_send_limit,
        first_batch_sent_at,
        next_batch_send_time,
        current_batch_number,
        total_contacts,
        emails_sent,
        created_at
      `)
      .eq('user_id', user.id)
      .in('status', ['sending', 'running', 'scheduled'])
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const now = new Date()

    const campaignInfo = campaigns?.map(campaign => {
      const isFirstBatch = !campaign.first_batch_sent_at
      const timeWindow = 5 * 60 * 1000 // 5 minutes

      let batchInfo = {}

      if (isFirstBatch) {
        batchInfo = {
          batch_status: 'ready_for_first_batch',
          can_send_now: true
        }
      } else if (campaign.next_batch_send_time) {
        const nextBatchTime = new Date(campaign.next_batch_send_time)
        const timeUntilBatch = nextBatchTime.getTime() - now.getTime()
        const minutesUntilBatch = Math.round(timeUntilBatch / (60 * 1000))

        let canSend = true
        let batchStatus = 'ready'

        if (timeUntilBatch > timeWindow) {
          batchStatus = 'waiting'
          canSend = false
        } else if (timeUntilBatch < -timeWindow) {
          batchStatus = 'overdue'
        }

        batchInfo = {
          batch_status: batchStatus,
          can_send_now: canSend,
          minutes_until_next_batch: minutesUntilBatch,
          next_batch_time: campaign.next_batch_send_time
        }
      }

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        batch_number: campaign.current_batch_number || 0,
        progress: `${campaign.emails_sent || 0}/${campaign.total_contacts || 0}`,
        ...batchInfo
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        current_time: now.toISOString(),
        campaigns: campaignInfo
      }
    })

  } catch (error) {
    console.error('Batch scheduling overview error:', error)
    return NextResponse.json({
      error: 'Failed to get batch scheduling overview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})