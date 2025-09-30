/**
 * Contact Query Executors
 *
 * Execute Gemini function calls against Supabase database.
 * Each executor corresponds to a function definition in contact-query-functions.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getOutreachAgent, previewSegment } from './outreach-agents'

type Supabase = SupabaseClient<Database>
type Contact = Database['public']['Tables']['contacts']['Row']

export interface QueryExecutionResult {
  contacts: Contact[]
  count: number
  functionName: string
  parameters: Record<string, any>
}

/**
 * Execute a contact query based on function name and parameters
 */
export async function executeContactQuery(
  functionName: string,
  parameters: Record<string, any>,
  supabase: Supabase,
  userId: string
): Promise<QueryExecutionResult> {
  console.log(`[executeContactQuery] Function: ${functionName}, Parameters:`, parameters)

  let contacts: Contact[] = []

  switch (functionName) {
    case 'query_contacts_basic':
      contacts = await executeBasicQuery(supabase, userId, parameters)
      break

    case 'query_contacts_by_engagement':
      contacts = await executeEngagementQuery(supabase, userId, parameters)
      break

    case 'query_never_contacted':
      contacts = await executeNeverContactedQuery(supabase, userId, parameters.limit || 100)
      break

    case 'query_contacts_by_agent_fit':
      contacts = await executeAgentFitQuery(supabase, userId, parameters)
      break

    case 'query_contacts_by_status':
      contacts = await executeStatusQuery(supabase, userId, parameters)
      break

    case 'query_contacts_by_recency':
      contacts = await executeRecencyQuery(supabase, userId, parameters)
      break

    case 'query_contacts_by_enrichment':
      contacts = await executeEnrichmentQuery(supabase, userId, parameters)
      break

    default:
      throw new Error(`Unknown function: ${functionName}`)
  }

  return {
    contacts,
    count: contacts.length,
    functionName,
    parameters
  }
}

/**
 * Execute basic profile filtering query
 */
async function executeBasicQuery(
  supabase: Supabase,
  userId: string,
  params: {
    countries?: string[]
    roles?: string[]
    keywords?: string[]
    includeTags?: string[]
    excludeTags?: string[]
    limit?: number
  }
): Promise<Contact[]> {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  // Country filter
  if (params.countries && params.countries.length > 0) {
    query = query.in('country', params.countries)
  }

  // Role filter (case-insensitive partial match)
  if (params.roles && params.roles.length > 0) {
    const roleConditions = params.roles.map(role => `position.ilike.%${role}%`).join(',')
    query = query.or(roleConditions)
  }

  // Keywords filter (search in company, position, custom_fields)
  if (params.keywords && params.keywords.length > 0) {
    const keywordConditions = params.keywords.map(keyword =>
      `company.ilike.%${keyword}%,position.ilike.%${keyword}%`
    ).join(',')
    query = query.or(keywordConditions)
  }

  // Include tags filter
  if (params.includeTags && params.includeTags.length > 0) {
    query = query.overlaps('tags', params.includeTags)
  }

  // Exclude tags filter (fetch all first, then filter in memory)
  const limit = params.limit || 100
  query = query.limit(limit * 2) // Fetch more to account for exclusions

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to query contacts: ${error.message}`)
  }

  let contacts = data || []

  // Apply exclude tags filter in memory
  if (params.excludeTags && params.excludeTags.length > 0) {
    contacts = contacts.filter(contact => {
      const contactTags = contact.tags || []
      return !params.excludeTags!.some(tag => contactTags.includes(tag))
    })
  }

  return contacts.slice(0, limit)
}

/**
 * Execute engagement metrics query
 */
async function executeEngagementQuery(
  supabase: Supabase,
  userId: string,
  params: {
    minEngagementScore?: number
    minOpens?: number
    minClicks?: number
    minReplies?: number
    limit?: number
  }
): Promise<Contact[]> {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (params.minEngagementScore !== undefined) {
    query = query.gte('engagement_score', params.minEngagementScore)
  }

  if (params.minOpens !== undefined) {
    query = query.gte('engagement_open_count', params.minOpens)
  }

  if (params.minClicks !== undefined) {
    query = query.gte('engagement_click_count', params.minClicks)
  }

  if (params.minReplies !== undefined) {
    query = query.gte('engagement_reply_count', params.minReplies)
  }

  query = query.limit(params.limit || 100)
  query = query.order('engagement_score', { ascending: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to query contacts by engagement: ${error.message}`)
  }

  return data || []
}

/**
 * Execute never contacted query
 */
async function executeNeverContactedQuery(
  supabase: Supabase,
  userId: string,
  limit: number
): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .eq('engagement_status', 'not_contacted')
    .limit(limit)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Never contacted query error:', error)
    throw new Error(`Failed to query never contacted: ${error.message}`)
  }

  console.log(`Never contacted query returned ${data?.length || 0} contacts for user ${userId}`)

  return data || []
}

/**
 * Execute agent ICP fit scoring query
 */
async function executeAgentFitQuery(
  supabase: Supabase,
  userId: string,
  params: {
    agentId: string
    threshold?: number
    limit?: number
  }
): Promise<Contact[]> {
  console.log('Executing agent fit query with params:', params)

  const agent = await getOutreachAgent(supabase, userId, params.agentId)

  if (!agent) {
    throw new Error('Outreach agent not found')
  }

  console.log('Agent loaded:', agent.name, 'segment_config:', agent.segment_config)

  const result = await previewSegment(supabase, userId, agent, {
    limit: params.limit || 100,
    threshold: params.threshold || 0.55,
    persist: false
  })

  console.log(`previewSegment returned ${result.contacts.length} contacts`)

  // Convert SegmentPreviewContact to Contact
  // We need to fetch full contact records
  if (result.contacts.length === 0) {
    console.log('No contacts matched the agent ICP fit criteria')
    return []
  }

  const contactIds = result.contacts.map(c => c.contact_id)

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .in('id', contactIds)

  if (error) {
    throw new Error(`Failed to fetch scored contacts: ${error.message}`)
  }

  // Sort by the original score order
  const scoreMap = new Map(result.contacts.map(c => [c.contact_id, c.score]))
  const sorted = (data || []).sort((a, b) => {
    const scoreA = scoreMap.get(a.id) || 0
    const scoreB = scoreMap.get(b.id) || 0
    return scoreB - scoreA
  })

  return sorted
}

/**
 * Execute status filter query
 */
async function executeStatusQuery(
  supabase: Supabase,
  userId: string,
  params: {
    statuses: string[]
    exclude?: boolean
    limit?: number
  }
): Promise<Contact[]> {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (params.exclude) {
    query = query.not('status', 'in', `(${params.statuses.join(',')})`)
  } else {
    query = query.in('status', params.statuses)
  }

  query = query.limit(params.limit || 100)
  query = query.order('updated_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to query contacts by status: ${error.message}`)
  }

  return data || []
}

/**
 * Execute recency-based query
 */
async function executeRecencyQuery(
  supabase: Supabase,
  userId: string,
  params: {
    lastContactedDays?: number
    lastEngagedDays?: number
    neverContacted?: boolean
    limit?: number
  }
): Promise<Contact[]> {
  if (params.neverContacted) {
    return executeNeverContactedQuery(supabase, userId, params.limit || 100)
  }

  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (params.lastContactedDays !== undefined) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - params.lastContactedDays)
    query = query.gte('last_contacted_at', cutoffDate.toISOString())
  }

  if (params.lastEngagedDays !== undefined) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - params.lastEngagedDays)
    query = query.gte('engagement_last_positive_at', cutoffDate.toISOString())
  }

  query = query.limit(params.limit || 100)
  query = query.order('last_contacted_at', { ascending: false, nullsFirst: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to query contacts by recency: ${error.message}`)
  }

  return data || []
}

/**
 * Execute enrichment status query
 */
async function executeEnrichmentQuery(
  supabase: Supabase,
  userId: string,
  params: {
    enrichmentStatus?: string
    hasLinkedIn?: boolean
    hasCompanyData?: boolean
    limit?: number
  }
): Promise<Contact[]> {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (params.enrichmentStatus) {
    query = query.eq('enrichment_status', params.enrichmentStatus)
  }

  if (params.hasLinkedIn !== undefined) {
    if (params.hasLinkedIn) {
      query = query.not('linkedin_url', 'is', null)
    } else {
      query = query.is('linkedin_url', null)
    }
  }

  if (params.hasCompanyData !== undefined) {
    if (params.hasCompanyData) {
      query = query.not('company', 'is', null)
    } else {
      query = query.is('company', null)
    }
  }

  query = query.limit(params.limit || 100)
  query = query.order('enrichment_updated_at', { ascending: false, nullsFirst: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to query contacts by enrichment: ${error.message}`)
  }

  return data || []
}

/**
 * Deduplicate contacts by ID (in case multiple functions return overlapping results)
 */
export function deduplicateContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>()
  const unique: Contact[] = []

  for (const contact of contacts) {
    if (!seen.has(contact.id)) {
      seen.add(contact.id)
      unique.push(contact)
    }
  }

  return unique
}