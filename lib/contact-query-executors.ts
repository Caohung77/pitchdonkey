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

    case 'query_contact_by_name':
      contacts = await executeContactByNameQuery(supabase, userId, parameters)
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
 * Execute contact name/email search query
 */
async function executeContactByNameQuery(
  supabase: Supabase,
  userId: string,
  params: {
    searchName: string
    limit?: number
  }
): Promise<Contact[]> {
  const searchTerm = params.searchName.trim()
  const limit = params.limit || 5

  if (!searchTerm) {
    return []
  }

  // Split search term into parts (handles "Jim Betterman" → ["Jim", "Betterman"])
  const nameParts = searchTerm.split(/\s+/).filter(Boolean)

  // Build a comprehensive OR query that searches across multiple fields
  const conditions: string[] = []

  // 1. Email exact match (highest priority)
  conditions.push(`email.ilike.%${searchTerm}%`)

  // 2. Full name match (first + last combined)
  if (nameParts.length > 1) {
    // Try matching all parts together
    nameParts.forEach(part => {
      conditions.push(`first_name.ilike.%${part}%`)
      conditions.push(`last_name.ilike.%${part}%`)
    })
  } else {
    // Single name - could be first or last
    conditions.push(`first_name.ilike.%${searchTerm}%`)
    conditions.push(`last_name.ilike.%${searchTerm}%`)
  }

  // 3. Company name match (in case they're asking about company contact)
  conditions.push(`company.ilike.%${searchTerm}%`)

  // Execute query with all conditions
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .or(conditions.join(','))
    .limit(limit * 2) // Fetch more for scoring

  if (error) {
    console.error('Name search error:', error)
    throw new Error(`Failed to search contacts by name: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  // Score and rank results by match quality
  const scoredContacts = data.map(contact => {
    let score = 0
    const lowerSearch = searchTerm.toLowerCase()
    const lowerFirst = (contact.first_name || '').toLowerCase()
    const lowerLast = (contact.last_name || '').toLowerCase()
    const lowerEmail = (contact.email || '').toLowerCase()
    const fullName = `${lowerFirst} ${lowerLast}`.trim()

    // Exact email match = highest priority
    if (lowerEmail === lowerSearch) {
      score += 100
    } else if (lowerEmail.includes(lowerSearch)) {
      score += 80
    }

    // Exact full name match
    if (fullName === lowerSearch) {
      score += 90
    }

    // Exact first or last name match
    if (lowerFirst === lowerSearch || lowerLast === lowerSearch) {
      score += 85
    }

    // Partial name matches
    if (lowerFirst.includes(lowerSearch) || lowerLast.includes(lowerSearch)) {
      score += 70
    }

    // Full name contains all parts
    if (nameParts.length > 1) {
      const allPartsMatch = nameParts.every(part =>
        fullName.includes(part.toLowerCase())
      )
      if (allPartsMatch) {
        score += 75
      }
    }

    // Company match (lower priority)
    if ((contact.company || '').toLowerCase().includes(lowerSearch)) {
      score += 40
    }

    return { contact, score }
  })

  // Sort by score (descending) and return top matches
  const sortedContacts = scoredContacts
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.contact)

  console.log(`Name search for "${searchTerm}" returned ${sortedContacts.length} contacts`)

  return sortedContacts
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