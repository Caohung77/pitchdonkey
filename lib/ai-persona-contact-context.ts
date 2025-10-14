import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { recalculateContactEngagement } from './contact-engagement'
import { processAIContactQuery, type AIQueryResult } from './ai-contact-query-service'

type Supabase = SupabaseClient<Database>

export interface ContactCampaignTouch {
  campaignId: string
  campaignName: string | null
  status: string | null
  personalizedSubject: string | null
  personalizedBodyPreview: string | null
  lastUpdatedAt: string | null
  createdAt: string | null
}

export interface ContactEmailEvent {
  messageId: string
  subject: string | null
  status: string | null
  sentAt: string | null
  openedAt: string | null
  clickedAt: string | null
  repliedAt: string | null
  bouncedAt: string | null
  lastEventAt: string | null
}

export interface ContactEngagementSnapshot {
  status: string | null
  score: number | null
  sentCount: number | null
  openCount: number | null
  clickCount: number | null
  replyCount: number | null
  bounceCount: number | null
  lastPositiveAt: string | null
  updatedAt: string | null
}

export interface ContactKnowledgeSummary {
  id: string
  fullName: string
  email: string
  company?: string | null
  position?: string | null
  website?: string | null
  phone?: string | null
  tags: string[]
  lists: string[]
  segments: string[]
  notes?: string | null
  notesUpdatedAt?: string | null
  enrichmentStatus?: string | null
  enrichmentUpdatedAt?: string | null
  linkedinUrl?: string | null
  source?: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactContext {
  contact: ContactKnowledgeSummary
  engagement: ContactEngagementSnapshot | null
  campaigns: ContactCampaignTouch[]
  recentEmails: ContactEmailEvent[]
}

const RECENT_EMAIL_LIMIT = 20
const PERSONALIZED_BODY_PREVIEW_LENGTH = 180

export async function buildContactContext(
  supabase: Supabase,
  userId: string,
  contactId: string
): Promise<ContactContext | null> {
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select(
      [
        'id',
        'user_id',
        'email',
        'first_name',
        'last_name',
        'company',
        'position',
        'website',
        'phone',
        'tags',
        'source',
        'lists',
        'segments',
        'notes',
        'notes_updated_at',
        'enrichment_status',
        'enrichment_updated_at',
        'linkedin_url',
        'created_at',
        'updated_at',
        'engagement_status',
        'engagement_score',
        'engagement_sent_count',
        'engagement_open_count',
        'engagement_click_count',
        'engagement_reply_count',
        'engagement_bounce_count',
        'engagement_last_positive_at',
        'engagement_updated_at',
      ].join(',')
    )
    .eq('id', contactId)
    .eq('user_id', userId)
    .single()

  if (contactError || !contact) {
    console.error('buildContactContext: failed to load contact', contactError)
    return null
  }

  const knowledge: ContactKnowledgeSummary = {
    id: contact.id,
    fullName: [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || contact.email,
    email: contact.email,
    company: contact.company,
    position: contact.position,
    website: contact.website,
    phone: contact.phone,
    tags: contact.tags || [],
    lists: Array.isArray(contact.lists) ? (contact.lists as string[]) : [],
    segments: Array.isArray(contact.segments) ? (contact.segments as string[]) : [],
    notes: contact.notes,
    notesUpdatedAt: contact.notes_updated_at || null,
    enrichmentStatus: contact.enrichment_status || null,
    enrichmentUpdatedAt: contact.enrichment_updated_at || null,
    linkedinUrl: contact.linkedin_url || null,
    source: contact.source || null,
    createdAt: contact.created_at || new Date().toISOString(),
    updatedAt: contact.updated_at || new Date().toISOString(),
  }

  const engagement = await ensureEngagementSnapshot(supabase, contact.id, contact)

  const campaigns = await loadCampaignTouches(supabase, userId, contact.id)
  const recentEmails = await loadRecentEmailActivity(supabase, userId, contact.id)

  return {
    contact: knowledge,
    engagement,
    campaigns,
    recentEmails,
  }
}

async function ensureEngagementSnapshot(
  supabase: Supabase,
  contactId: string,
  row: Database['public']['Tables']['contacts']['Row']
): Promise<ContactEngagementSnapshot | null> {
  if (
    row.engagement_status &&
    row.engagement_score !== null &&
    row.engagement_updated_at
  ) {
    return {
      status: row.engagement_status,
      score: row.engagement_score,
      sentCount: row.engagement_sent_count,
      openCount: row.engagement_open_count,
      clickCount: row.engagement_click_count,
      replyCount: row.engagement_reply_count,
      bounceCount: row.engagement_bounce_count,
      lastPositiveAt: row.engagement_last_positive_at,
      updatedAt: row.engagement_updated_at,
    }
  }

  const recomputed = await recalculateContactEngagement(supabase, contactId)
  if (!recomputed) {
    return null
  }

  return {
    status: recomputed.status,
    score: recomputed.score,
    sentCount: recomputed.sentCount,
    openCount: recomputed.openCount,
    clickCount: recomputed.clickCount,
    replyCount: recomputed.replyCount,
    bounceCount: recomputed.bounceCount,
    lastPositiveAt: recomputed.lastPositiveAt,
    updatedAt: new Date().toISOString(),
  }
}

async function loadCampaignTouches(
  supabase: Supabase,
  userId: string,
  contactId: string
): Promise<ContactCampaignTouch[]> {
  const { data, error } = await supabase
    .from('campaign_contacts')
    .select(
      `
        campaign_id,
        status,
        personalized_subject,
        personalized_body,
        created_at,
        updated_at,
        campaign:campaigns!inner (
          id,
          name,
          user_id
        )
      `
    )
    .eq('contact_id', contactId)
    .eq('campaign.user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error || !data) {
    if (error) {
      console.error('buildContactContext: failed campaign query', error)
    }
    return []
  }

  return data.map(row => ({
    campaignId: row.campaign_id || row.campaign?.id || '',
    campaignName: row.campaign?.name || null,
    status: row.status,
    personalizedSubject: row.personalized_subject,
    personalizedBodyPreview: row.personalized_body
      ? row.personalized_body.slice(0, PERSONALIZED_BODY_PREVIEW_LENGTH).trim()
      : null,
    createdAt: row.created_at,
    lastUpdatedAt: row.updated_at,
  }))
}

async function loadRecentEmailActivity(
  supabase: Supabase,
  userId: string,
  contactId: string
): Promise<ContactEmailEvent[]> {
  const { data, error } = await supabase
    .from('email_tracking')
    .select(
      [
        'message_id',
        'subject_line',
        'status',
        'sent_at',
        'opened_at',
        'clicked_at',
        'replied_at',
        'bounced_at',
        'updated_at',
        'created_at',
        'user_id',
      ].join(',')
    )
    .eq('contact_id', contactId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(RECENT_EMAIL_LIMIT)

  if (error || !data) {
    if (error) {
      console.error('buildContactContext: failed email activity', error)
    }
    return []
  }

  return data.map(row => ({
    messageId: row.message_id,
    subject: row.subject_line,
    status: row.status,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
    clickedAt: row.clicked_at,
    repliedAt: row.replied_at,
    bouncedAt: row.bounced_at,
    lastEventAt: row.updated_at || row.created_at,
  }))
}

export async function runPersonaContactQuery(
  supabase: Supabase,
  userId: string,
  personaId: string,
  query: string,
  maxResults = 25
): Promise<AIQueryResult | null> {
  try {
    return await processAIContactQuery(query, personaId, userId, supabase, maxResults)
  } catch (error) {
    console.error('runPersonaContactQuery error:', error)
    return null
  }
}
