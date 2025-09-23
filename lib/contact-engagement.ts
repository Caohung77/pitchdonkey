import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type ContactEngagementStatus = 'not_contacted' | 'pending' | 'engaged' | 'bad'

const SCORE_LIMITS = {
  open: { increment: 5, cap: 15 },
  click: { increment: 20, cap: 60 },
  reply: { increment: 50, cap: undefined as number | undefined },
}

const DECAY_WINDOW_DAYS = 30
const DECAY_FACTOR = 0.7

const HARD_STOP_STATUSES = new Set(['bounced', 'complained', 'unsubscribed'])

export interface EngagementComputationResult {
  status: ContactEngagementStatus
  score: number
  sentCount: number
  openCount: number
  clickCount: number
  replyCount: number
  bounceCount: number
  lastPositiveAt: string | null
}

export interface EngagementScoreBreakdown {
  openScore: number
  clickScore: number
  replyScore: number
  totalBeforeDecay: number
  decayFactor: number
  finalScore: number
}

export interface EngagementStatusInfo {
  status: ContactEngagementStatus
  label: string
  description: string
  color: string
  bgColor: string
  actionable: string
}

export async function recalculateContactEngagement(
  supabase: SupabaseClient<Database>,
  contactId: string
): Promise<EngagementComputationResult | null> {
  const now = new Date()

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(
      'id, status, unsubscribed_at, engagement_status, engagement_score, engagement_sent_count, engagement_last_positive_at, engagement_open_count, engagement_click_count, engagement_reply_count, engagement_bounce_count'
    )
    .eq('id', contactId)
    .single()

  if (contactError || !contact) {
    console.error('recalculateContactEngagement: contact lookup failed', contactError)
    return null
  }

  const { data: tracking, error: trackingError } = await supabase
    .from('email_tracking')
    .select(
      'sent_at, delivered_at, opened_at, clicked_at, replied_at, bounced_at, complained_at, unsubscribed_at, status'
    )
    .eq('contact_id', contactId)

  if (trackingError || !tracking) {
    console.error('recalculateContactEngagement: tracking lookup failed', trackingError)
    return null
  }

  const sentCount = tracking.filter((row) => !!row.sent_at || !!row.delivered_at).length
  const openCount = tracking.filter((row) => !!row.opened_at).length
  const clickCount = tracking.filter((row) => !!row.clicked_at).length
  const replyCount = tracking.filter((row) => !!row.replied_at).length
  const bounceCount = tracking.filter((row) => !!row.bounced_at || row.status === 'bounced').length
  const complaintCount = tracking.filter((row) => !!row.complained_at || row.status === 'complained').length

  const lastPositiveAt = tracking.reduce<Date | null>((latest, row) => {
    const candidates = [row.replied_at, row.clicked_at, row.opened_at]
    for (const ts of candidates) {
      if (!ts) continue
      const current = new Date(ts)
      if (!latest || current > latest) {
        latest = current
      }
    }
    return latest
  }, null)

  const hasBounce = tracking.some((row) => !!row.bounced_at || row.status === 'bounced')
  const hasComplaint = tracking.some((row) => !!row.complained_at || row.status === 'complained')
  const hasUnsubscribeEvent = Boolean(contact.unsubscribed_at) ||
    tracking.some((row) => !!row.unsubscribed_at || row.status === 'unsubscribed')

  const hasHardStop = hasBounce || hasComplaint || hasUnsubscribeEvent ||
    (contact.status && HARD_STOP_STATUSES.has(contact.status))

  const openScore = Math.min(openCount * SCORE_LIMITS.open.increment, SCORE_LIMITS.open.cap)
  const clickScore = Math.min(clickCount * SCORE_LIMITS.click.increment, SCORE_LIMITS.click.cap)
  const replyScore = replyCount * SCORE_LIMITS.reply.increment

  let score = openScore + clickScore + replyScore

  if (score > 0 && lastPositiveAt) {
    const diffMs = now.getTime() - lastPositiveAt.getTime()
    if (diffMs > 0) {
      const periods = Math.floor(diffMs / (DECAY_WINDOW_DAYS * 24 * 60 * 60 * 1000))
      if (periods > 0) {
        score = Math.round(score * Math.pow(DECAY_FACTOR, periods))
      }
    }
  }

  if (hasHardStop) {
    score = 0
  }

  score = Math.max(0, Math.min(100, score))

  let status: ContactEngagementStatus = 'not_contacted'

  if (hasHardStop) {
    status = 'bad'
  } else if (sentCount === 0) {
    status = 'not_contacted'
  } else {
    const qualifiesGreen = replyCount > 0 || clickCount > 0 || score >= 50
    status = qualifiesGreen ? 'engaged' : 'pending'
  }

  const lastPositiveIso = lastPositiveAt ? lastPositiveAt.toISOString() : null

  const fieldsToUpdate: Record<string, any> = {
    engagement_status: status,
    engagement_score: score,
    engagement_sent_count: sentCount,
    engagement_open_count: openCount,
    engagement_click_count: clickCount,
    engagement_reply_count: replyCount,
    engagement_bounce_count: bounceCount,
    engagement_last_positive_at: lastPositiveIso,
    engagement_updated_at: now.toISOString(),
  }

  let requiresUpdate = false
  for (const [key, value] of Object.entries(fieldsToUpdate)) {
    if ((contact as any)[key] !== value) {
      requiresUpdate = true
      break
    }
  }

  if (requiresUpdate) {
    const { error: updateError } = await supabase
      .from('contacts')
      .update(fieldsToUpdate)
      .eq('id', contactId)

    if (updateError) {
      console.error('recalculateContactEngagement: failed to update contact', updateError)
    }
  }

  return {
    status,
    score,
    sentCount,
    openCount,
    clickCount,
    replyCount,
    bounceCount,
    lastPositiveAt: lastPositiveIso,
  }
}

export function getEngagementStatusInfo(status: ContactEngagementStatus): EngagementStatusInfo {
  switch (status) {
    case 'not_contacted':
      return {
        status: 'not_contacted',
        label: 'Not Contacted',
        description: 'Fresh leads ready for first outreach',
        color: 'text-blue-800',
        bgColor: 'bg-blue-100',
        actionable: 'Ready for outreach'
      }
    case 'pending':
      return {
        status: 'pending',
        label: 'No Response Yet',
        description: 'Contacted but needs follow-ups (nurture-able)',
        color: 'text-yellow-800',
        bgColor: 'bg-yellow-100',
        actionable: 'Continue follow-ups'
      }
    case 'engaged':
      return {
        status: 'engaged',
        label: 'Engaged',
        description: 'Active engagement - prioritize for sales',
        color: 'text-green-800',
        bgColor: 'bg-green-100',
        actionable: 'Prioritize for sales'
      }
    case 'bad':
      return {
        status: 'bad',
        label: 'Do Not Contact',
        description: 'Bounced, complained, or unsubscribed',
        color: 'text-red-800',
        bgColor: 'bg-red-100',
        actionable: 'Suppress from campaigns'
      }
    default:
      return {
        status: 'not_contacted',
        label: 'Unknown',
        description: 'Status unknown',
        color: 'text-gray-800',
        bgColor: 'bg-gray-100',
        actionable: 'Review status'
      }
  }
}

export function calculateEngagementScoreBreakdown(
  openCount: number,
  clickCount: number,
  replyCount: number,
  lastPositiveAt: string | null
): EngagementScoreBreakdown {
  const openScore = Math.min(openCount * SCORE_LIMITS.open.increment, SCORE_LIMITS.open.cap)
  const clickScore = Math.min(clickCount * SCORE_LIMITS.click.increment, SCORE_LIMITS.click.cap)
  const replyScore = replyCount * SCORE_LIMITS.reply.increment

  const totalBeforeDecay = openScore + clickScore + replyScore

  let decayFactor = 1
  let finalScore = totalBeforeDecay

  if (totalBeforeDecay > 0 && lastPositiveAt) {
    const now = new Date()
    const lastPositive = new Date(lastPositiveAt)
    const diffMs = now.getTime() - lastPositive.getTime()

    if (diffMs > 0) {
      const periods = Math.floor(diffMs / (DECAY_WINDOW_DAYS * 24 * 60 * 60 * 1000))
      if (periods > 0) {
        decayFactor = Math.pow(DECAY_FACTOR, periods)
        finalScore = Math.round(totalBeforeDecay * decayFactor)
      }
    }
  }

  finalScore = Math.max(0, Math.min(100, finalScore))

  return {
    openScore,
    clickScore,
    replyScore,
    totalBeforeDecay,
    decayFactor,
    finalScore
  }
}

export async function bulkRecalculateEngagement(
  supabase: SupabaseClient<Database>,
  userId: string,
  contactIds?: string[]
): Promise<{ success: number; failed: number }> {
  let query = supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)

  if (contactIds && contactIds.length > 0) {
    query = query.in('id', contactIds)
  }

  const { data: contacts, error } = await query

  if (error || !contacts) {
    console.error('bulkRecalculateEngagement: failed to fetch contacts', error)
    return { success: 0, failed: 0 }
  }

  let success = 0
  let failed = 0

  for (const contact of contacts) {
    try {
      const result = await recalculateContactEngagement(supabase, contact.id)
      if (result) {
        success++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`Failed to recalculate engagement for contact ${contact.id}:`, error)
      failed++
    }
  }

  return { success, failed }
}

export function getEngagementScoreColor(score: number): { color: string; bgColor: string } {
  if (score >= 75) {
    return { color: 'text-green-800', bgColor: 'bg-green-100' }
  } else if (score >= 50) {
    return { color: 'text-blue-800', bgColor: 'bg-blue-100' }
  } else if (score >= 25) {
    return { color: 'text-yellow-800', bgColor: 'bg-yellow-100' }
  } else {
    return { color: 'text-gray-800', bgColor: 'bg-gray-100' }
  }
}
