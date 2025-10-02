import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    console.log('🔧 Running database migrations...')

    // 1. Check if batch_schedule column exists
    const { data: columnCheck, error: columnError } = await supabase
      .rpc('get_column_info', { table_name: 'campaigns', column_name: 'batch_schedule' })
      .single()

    if (columnError && !columnError.message.includes('not found')) {
      console.log('⚠️ Could not check column, proceeding with migration...')
    }

    // 2. Backfill batch schedules for existing campaigns
    console.log('📅 Backfilling batch schedules for existing campaigns...')

    const { data: campaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, total_contacts, daily_send_limit, scheduled_date, created_at, status, emails_sent')
      .in('status', ['sending', 'scheduled'])
      .is('batch_schedule', null)
      .gt('total_contacts', 0)

    if (fetchError) {
      console.error('Error fetching campaigns:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    console.log(`Found ${campaigns?.length || 0} campaigns to backfill`)

    let backfilled = 0
    for (const campaign of campaigns || []) {
      const batchSize = campaign.daily_send_limit || 5
      const totalContacts = campaign.total_contacts
      const totalBatches = Math.ceil(totalContacts / batchSize)
      const startTime = new Date(campaign.scheduled_date || campaign.created_at)
      const BATCH_INTERVAL_MINUTES = 20

      // Create batch schedule
      const batches = []
      let contactsRemaining = totalContacts

      for (let i = 0; i < totalBatches; i++) {
        const batchTime = new Date(startTime.getTime() + (i * BATCH_INTERVAL_MINUTES * 60 * 1000))
        const batchContactCount = Math.min(batchSize, contactsRemaining)

        batches.push({
          batch_number: i + 1,
          scheduled_time: batchTime.toISOString(),
          contact_ids: [], // Empty for backfill
          contact_count: batchContactCount,
          status: i === 0 ? 'sent' : 'pending' // First batch already sent for 'sending' campaigns
        })

        contactsRemaining -= batchContactCount
      }

      const batchSchedule = {
        batches,
        batch_size: batchSize,
        batch_interval_minutes: BATCH_INTERVAL_MINUTES,
        total_batches: totalBatches,
        total_contacts: totalContacts,
        estimated_completion: batches[batches.length - 1]?.scheduled_time
      }

      // Determine next batch time
      const nextPendingBatch = batches.find(b => b.status === 'pending')
      const nextBatchTime = nextPendingBatch ? nextPendingBatch.scheduled_time : null

      // Update campaign
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          batch_schedule: batchSchedule,
          next_batch_send_time: nextBatchTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id)

      if (updateError) {
        console.error(`Error updating campaign ${campaign.id}:`, updateError)
      } else {
        console.log(`✅ Backfilled batch schedule for campaign ${campaign.id} (${totalBatches} batches)`)
        backfilled++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfilled ${backfilled} campaigns with batch schedules`,
      backfilled,
      total: campaigns?.length || 0
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
})
