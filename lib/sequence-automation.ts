import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { SequenceLinkRecord } from './sequences'

type Supabase = SupabaseClient<Database>

interface CampaignContactRow {
  contact_id: string
  status: string
  reply_received_at: string | null
  unsubscribed_at: string | null
}

interface ContactInfoRow {
  id: string
  status: string | null
  auto_reply_until: string | null
}

interface TrackingStats {
  openedCount: number
  clickedCount: number
  replied: boolean
  bounced: boolean
}

const FINAL_STATUSES = new Set(['completed', 'stopped', 'paused'])

export async function advanceSequenceForCampaign(
  supabase: Supabase,
  campaignId: string,
): Promise<void> {
  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id, sequence_id, sequence_position, status, name')
      .eq('id', campaignId)
      .single()

    if (campaignError) {
      console.error('❌ Sequence automation: failed to load campaign', campaignError)
      return
    }

    if (!campaign?.sequence_id) {
      return
    }

    const { data: sequence, error: sequenceError } = await supabase
      .from('sequences')
      .select('id, status, name')
      .eq('id', campaign.sequence_id)
      .single()

    if (sequenceError) {
      console.error('❌ Sequence automation: failed to load sequence', sequenceError)
      return
    }

    if (!sequence || sequence.status !== 'active') {
      console.log(
        `ℹ️ Sequence automation skipped: sequence ${campaign.sequence_id} inactive or missing`,
      )
      return
    }

    const { data: sequenceLinks, error: linksError } = await supabase
      .from('sequence_links')
      .select('*')
      .eq('sequence_id', sequence.id as string)
      .eq('parent_campaign_id', campaign.id)

    if (linksError) {
      console.error('❌ Sequence automation: failed to load sequence links', linksError)
      return
    }

    const { data: campaignContacts, error: contactsError } = await supabase
      .from('campaign_contacts')
      .select('contact_id, status, reply_received_at, unsubscribed_at')
      .eq('campaign_id', campaign.id)

    if (contactsError) {
      console.error('❌ Sequence automation: failed to load campaign contacts', contactsError)
      return
    }

    const contactRows: CampaignContactRow[] = campaignContacts || []
    const contactIds = contactRows.map((row) => row.contact_id)

    if (!contactIds.length) {
      if (!sequenceLinks?.length) {
        await markEnrollmentsCompleted(supabase, sequence.id as string, campaign.id, [])
      }
      return
    }

    // Load supporting data for filtering
    const [contactInfoResult, trackingResult, enrollmentResult] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, status, auto_reply_until')
        .in('id', contactIds),
      supabase
        .from('email_tracking')
        .select('contact_id, status, opened_at, clicked_at, replied_at, bounced_at')
        .eq('campaign_id', campaign.id),
      supabase
        .from('sequence_enrollments')
        .select('sequence_id, contact_id, status, current_campaign_id, id, completed_at')
        .eq('sequence_id', campaign.sequence_id)
        .in('contact_id', contactIds),
    ])

    if (contactInfoResult.error) {
      console.error('⚠️ Sequence automation: failed to load contact info', contactInfoResult.error)
    }

    if (trackingResult.error) {
      console.error('⚠️ Sequence automation: failed to load email tracking data', trackingResult.error)
    }

    if (enrollmentResult.error) {
      console.error('⚠️ Sequence automation: failed to load existing enrollments', enrollmentResult.error)
    }

    const contactInfoMap = new Map<string, ContactInfoRow>()
    ;(contactInfoResult.data || []).forEach((row) => {
      contactInfoMap.set(row.id, row)
    })

    const trackingMap = new Map<string, TrackingStats>()
    ;(trackingResult.data || []).forEach((row) => {
      const stats = trackingMap.get(row.contact_id) || {
        openedCount: 0,
        clickedCount: 0,
        replied: false,
        bounced: false,
      }
      if (row.opened_at !== null || row.status === 'opened') {
        stats.openedCount += 1
      }
      if (row.clicked_at !== null || row.status === 'clicked') {
        stats.clickedCount += 1
      }
      if (row.replied_at !== null || row.status === 'replied') {
        stats.replied = true
      }
      if (row.bounced_at !== null || row.status === 'bounced' || row.status === 'failed') {
        stats.bounced = true
      }
      trackingMap.set(row.contact_id, stats)
    })

    const enrollmentMap = new Map<string, any>()
    ;(enrollmentResult.data || []).forEach((row) => {
      enrollmentMap.set(row.contact_id, row)
    })

    await ensureEnrollmentsExist(
      supabase,
      sequence.id as string,
      campaign.id,
      campaign.sequence_position ?? 1,
      contactRows,
      enrollmentMap,
    )

    if (!sequenceLinks?.length) {
      await markEnrollmentsCompleted(
        supabase,
        sequence.id as string,
        campaign.id,
        contactRows.map((row) => row.contact_id),
      )
      return
    }

    for (const link of sequenceLinks) {
      await processLinkTransition({
        supabase,
        link,
        campaign,
        sequenceId: sequence.id as string,
        contactRows,
        contactInfoMap,
        trackingMap,
        enrollmentMap,
      })
    }
  } catch (error) {
    console.error('❌ Sequence automation: unexpected error advancing sequence', error)
  }
}

async function ensureEnrollmentsExist(
  supabase: Supabase,
  sequenceId: string,
  campaignId: string,
  sequencePosition: number,
  contacts: CampaignContactRow[],
  enrollmentMap: Map<string, any>,
) {
  const timestamp = new Date().toISOString()
  const newEnrollments = contacts
    .filter((contact) => !enrollmentMap.has(contact.contact_id))
    .map((contact) => ({
      sequence_id: sequenceId,
      contact_id: contact.contact_id,
      current_campaign_id: campaignId,
      current_link_id: null,
      status: 'in_progress',
      last_transition_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    }))

  if (newEnrollments.length > 0) {
    const { error } = await supabase
      .from('sequence_enrollments')
      .upsert(newEnrollments, { onConflict: 'sequence_id,contact_id' })

    if (error) {
      console.error('❌ Sequence automation: failed to create enrollments', error)
    } else {
      newEnrollments.forEach((row) => {
        enrollmentMap.set(row.contact_id, row)
      })
    }
  }

  // Ensure the campaign itself knows its position within the sequence
  if (!sequencePosition || sequencePosition < 1) {
    await supabase
      .from('campaigns')
      .update({ sequence_position: 1, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
  }
}

async function markEnrollmentsCompleted(
  supabase: Supabase,
  sequenceId: string,
  campaignId: string,
  contactIds: string[],
) {
  if (!contactIds.length) return

  const timestamp = new Date().toISOString()
  const updates = contactIds.map((contactId) => ({
    sequence_id: sequenceId,
    contact_id: contactId,
    current_campaign_id: null,
    current_link_id: null,
    status: 'completed',
    completed_at: timestamp,
    last_transition_at: timestamp,
    updated_at: timestamp,
  }))

  const { error } = await supabase
    .from('sequence_enrollments')
    .upsert(updates, { onConflict: 'sequence_id,contact_id' })

  if (error) {
    console.error('❌ Sequence automation: failed to complete enrollments', error)
  } else {
    console.log(
      `✅ Sequence automation: marked ${updates.length} contacts as completed for campaign ${campaignId}`,
    )
  }
}

async function processLinkTransition(params: {
  supabase: Supabase
  link: SequenceLinkRecord
  campaign: { id: string; sequence_position?: number | null }
  sequenceId: string
  contactRows: CampaignContactRow[]
  contactInfoMap: Map<string, ContactInfoRow>
  trackingMap: Map<string, TrackingStats>
  enrollmentMap: Map<string, any>
}) {
  const {
    supabase,
    link,
    campaign,
    sequenceId,
    contactRows,
    contactInfoMap,
    trackingMap,
    enrollmentMap,
  } = params

  if (!link.next_campaign_id) {
    return
  }

  const eligibleContacts = contactRows.filter((contactRow) => {
    const enrollment = enrollmentMap.get(contactRow.contact_id)
    if (enrollment && FINAL_STATUSES.has(enrollment.status)) {
      return false
    }

    if (['bounced', 'unsubscribed', 'stopped'].includes(contactRow.status)) {
      return false
    }

    const contactInfo = contactInfoMap.get(contactRow.contact_id)
    const filterAutoReply = link.filter_auto_reply !== false
    const filterBounced = link.filter_bounced !== false
    const filterUnsubscribed = link.filter_unsubscribed !== false

    if (filterUnsubscribed && contactInfo?.status === 'unsubscribed') {
      return false
    }

    if (filterAutoReply && contactInfo?.auto_reply_until) {
      if (new Date(contactInfo.auto_reply_until) > new Date()) {
        return false
      }
    }

    if (filterBounced && contactInfo?.status === 'bounced') {
      return false
    }

    const stats = trackingMap.get(contactRow.contact_id) || {
      openedCount: 0,
      clickedCount: 0,
      replied: false,
      bounced: false,
    }

    if (filterBounced && stats.bounced) {
      return false
    }

    return evaluateLinkCondition(link, stats)
  })

  if (!eligibleContacts.length) {
    console.log(
      `ℹ️ Sequence automation: no contacts qualified for follow-up via link ${link.id}`,
    )
    return
  }

  const timestamp = new Date().toISOString()
  const delayMs =
    ((link.delay_days || 0) * 24 * 60 * 60 * 1000) + ((link.delay_hours || 0) * 60 * 60 * 1000)
  const scheduledTime = new Date(Date.now() + delayMs)

  const enrollmentUpdates = eligibleContacts.map((row) => ({
    sequence_id: sequenceId,
    contact_id: row.contact_id,
    current_campaign_id: link.next_campaign_id,
    current_link_id: link.id,
    status: 'in_progress',
    last_transition_at: timestamp,
    updated_at: timestamp,
  }))

  const { error: enrollmentError } = await supabase
    .from('sequence_enrollments')
    .upsert(enrollmentUpdates, { onConflict: 'sequence_id,contact_id' })

  if (enrollmentError) {
    console.error('❌ Sequence automation: failed to update enrollments', enrollmentError)
  }

  const nextCampaignIds = eligibleContacts.map((row) => row.contact_id)

  // Fetch existing entries in the next campaign to avoid duplicate inserts
  const { data: existingNext, error: existingError } = await supabase
    .from('campaign_contacts')
    .select('contact_id')
    .eq('campaign_id', link.next_campaign_id)
    .in('contact_id', nextCampaignIds)

  if (existingError) {
    console.error('⚠️ Sequence automation: failed to load existing contacts for next campaign', existingError)
  }

  const existingSet = new Set<string>((existingNext || []).map((row) => row.contact_id))
  const newContactInserts = eligibleContacts
    .filter((row) => !existingSet.has(row.contact_id))
    .map((row) => ({
      campaign_id: link.next_campaign_id,
      contact_id: row.contact_id,
      status: 'pending' as const,
      created_at: timestamp,
      updated_at: timestamp,
    }))

  if (newContactInserts.length) {
    const { error: insertError } = await supabase
      .from('campaign_contacts')
      .upsert(newContactInserts, { onConflict: 'campaign_id,contact_id' })

    if (insertError) {
      console.error('❌ Sequence automation: failed to add contacts to next campaign', insertError)
    }
  }

  await updateNextCampaignMetadata(
    supabase,
    link.next_campaign_id,
    scheduledTime,
    (campaign.sequence_position ?? 1) + 1,
  )

  console.log(
    `✅ Sequence automation: moved ${eligibleContacts.length} contacts from campaign ${campaign.id} to next campaign ${link.next_campaign_id}`,
  )
}

function evaluateLinkCondition(link: SequenceLinkRecord, stats: TrackingStats): boolean {
  if (link.min_opens > stats.openedCount) {
    return false
  }

  if (link.min_clicks > stats.clickedCount) {
    return false
  }

  if (link.engagement_required && stats.openedCount === 0 && stats.clickedCount === 0) {
    return false
  }

  switch (link.condition_type) {
    case 'no_reply':
      return !stats.replied
    case 'opened_no_reply':
      return stats.openedCount > 0 && !stats.replied
    case 'always':
    case 'custom':
    default:
      return true
  }
}

async function updateNextCampaignMetadata(
  supabase: Supabase,
  campaignId: string,
  scheduledTime: Date,
  desiredPosition: number,
) {
  const { data: nextCampaign, error: nextCampaignError } = await supabase
    .from('campaigns')
    .select('id, status, scheduled_date, sequence_position, total_contacts')
    .eq('id', campaignId)
    .single()

  if (nextCampaignError) {
    console.error('❌ Sequence automation: failed to load next campaign', nextCampaignError)
    return
  }

  if (!nextCampaign) {
    return
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (!nextCampaign.sequence_position || nextCampaign.sequence_position < desiredPosition) {
    updates.sequence_position = desiredPosition
  }

  if (nextCampaign.status === 'draft') {
    updates.status = 'scheduled'
    updates.scheduled_date = scheduledTime.toISOString()
  } else if (nextCampaign.status === 'scheduled') {
    if (!nextCampaign.scheduled_date) {
      updates.scheduled_date = scheduledTime.toISOString()
    } else {
      const existing = new Date(nextCampaign.scheduled_date)
      if (scheduledTime < existing) {
        updates.scheduled_date = scheduledTime.toISOString()
      }
    }
  }

  const { count, error: countError } = await supabase
    .from('campaign_contacts')
    .select('contact_id', { head: true, count: 'exact' })
    .eq('campaign_id', campaignId)

  if (!countError) {
    updates.total_contacts = count || 0
  }

  if (Object.keys(updates).length > 1) {
    const { error: updateError } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)

    if (updateError) {
      console.error('❌ Sequence automation: failed to update next campaign metadata', updateError)
    }
  }
}
