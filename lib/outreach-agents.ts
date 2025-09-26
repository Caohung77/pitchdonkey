import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './database.types'

export type Supabase = SupabaseClient<Database>

export interface KnowledgeSummary {
  total: number
  ready: number
  pending: number
  processing: number
  failed: number
}

export interface SegmentFilters {
  industries?: string[]
  companySizes?: string[]
  countries?: string[]
  roles?: string[]
  keywords?: string[]
  includeTags?: string[]
  excludeTags?: string[]
  customFields?: Array<{ key: string; values: string[] }>
}

export interface DataSignals {
  minEngagementScore?: number
  minOpens?: number
  minClicks?: number
  minReplies?: number
  maxBounceRate?: number
  recencyDays?: number
  deliverabilityScore?: number
}

export interface AdvancedRules {
  excludeOptedOut?: boolean
  excludeStatuses?: string[]
  cooldownDays?: number
  excludeWithoutEmail?: boolean
  excludeMissingCompany?: boolean
}

export interface SegmentSchedule {
  mode: 'manual' | 'daily' | 'weekly' | 'webhook'
  time?: string // HH:MM
  timezone?: string
  dayOfWeek?: number // 0 (Sunday) - 6 (Saturday)
  webhookUrl?: string
}

export interface QualityWeights {
  icpFit: number
  engagement: number
  recency: number
  deliverability: number
  enrichment: number
}

export interface SegmentConfig {
  filters: SegmentFilters
  dataSignals: DataSignals
  advancedRules: AdvancedRules
  schedule?: SegmentSchedule
  threshold?: number
  limit?: number
  qualityWeights?: QualityWeights
}

export type OutreachAgentRecord = Database['public']['Tables']['outreach_agents']['Row']

export type OutreachAgent = Omit<OutreachAgentRecord, 'segment_config' | 'quality_weights' | 'knowledge_summary'> & {
  segment_config: SegmentConfig
  quality_weights: QualityWeights
  knowledge_summary: KnowledgeSummary
  language: 'en' | 'de'
}

export interface OutreachAgentUpsertInput {
  name: string
  status?: 'draft' | 'active' | 'inactive'
  purpose?: string
  tone?: string
  language?: 'en' | 'de'
  sender_name?: string
  sender_role?: string
  company_name?: string
  product_one_liner?: string
  product_description?: string
  unique_selling_points?: string[]
  target_persona?: string
  conversation_goal?: string
  preferred_cta?: string
  follow_up_strategy?: string
  custom_prompt?: string
  prompt_override?: string
  segment_config?: Partial<SegmentConfig>
  quality_weights?: Partial<QualityWeights>
  settings?: Record<string, any>
}

export interface KnowledgeItemInput {
  type: 'pdf' | 'doc' | 'text' | 'link' | 'html'
  title: string
  description?: string
  content?: string
  url?: string
  storage_path?: string
  embedding_status?: 'pending' | 'processing' | 'ready' | 'failed'
  embedding_metadata?: Record<string, any>
}

export interface SegmentPreviewContact {
  id: string
  contact_id: string
  full_name: string
  email: string
  company?: string | null
  position?: string | null
  country?: string | null
  score: number
  reasons: string[]
  engagement?: {
    score?: number | null
    opens?: number | null
    clicks?: number | null
    replies?: number | null
    lastPositiveAt?: string | null
  }
  enrichment?: {
    status?: string | null
    updated_at?: string | null
  }
}

export interface SegmentPreviewResult {
  agent_id: string
  run_id: string
  limit: number
  threshold: number
  total_candidates: number
  total_matched: number
  contacts: SegmentPreviewContact[]
}

const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  icpFit: 0.4,
  engagement: 0.25,
  recency: 0.2,
  deliverability: 0.1,
  enrichment: 0.05,
}

const DEFAULT_LANGUAGE: 'en' | 'de' = 'en'

const DEFAULT_SEGMENT_CONFIG: SegmentConfig = {
  filters: {
    industries: [],
    companySizes: [],
    countries: [],
    roles: [],
    keywords: [],
    includeTags: [],
    excludeTags: [],
    customFields: [],
  },
  dataSignals: {
    minEngagementScore: 0,
    minOpens: 0,
    minClicks: 0,
    minReplies: 0,
    maxBounceRate: 0.25,
    recencyDays: 180,
    deliverabilityScore: 0.7,
  },
  advancedRules: {
    excludeOptedOut: true,
    excludeStatuses: ['bounced', 'unsubscribed'],
    cooldownDays: 7,
    excludeWithoutEmail: true,
    excludeMissingCompany: false,
  },
  schedule: {
    mode: 'manual',
  },
  threshold: 0.55,
  limit: 100,
}

const EPSILON = 0.00001

function normalizeWeights(weights?: Partial<QualityWeights> | null): QualityWeights {
  const merged: QualityWeights = {
    icpFit: weights?.icpFit ?? DEFAULT_QUALITY_WEIGHTS.icpFit,
    engagement: weights?.engagement ?? DEFAULT_QUALITY_WEIGHTS.engagement,
    recency: weights?.recency ?? DEFAULT_QUALITY_WEIGHTS.recency,
    deliverability: weights?.deliverability ?? DEFAULT_QUALITY_WEIGHTS.deliverability,
    enrichment: weights?.enrichment ?? DEFAULT_QUALITY_WEIGHTS.enrichment,
  }

  const total = merged.icpFit + merged.engagement + merged.recency + merged.deliverability + merged.enrichment
  if (total <= 0) {
    return { ...DEFAULT_QUALITY_WEIGHTS }
  }

  return {
    icpFit: merged.icpFit / total,
    engagement: merged.engagement / total,
    recency: merged.recency / total,
    deliverability: merged.deliverability / total,
    enrichment: merged.enrichment / total,
  }
}

function normalizeSegmentConfig(config?: Partial<SegmentConfig> | null, weights?: Partial<QualityWeights> | null): SegmentConfig {
  const base: SegmentConfig = {
    ...DEFAULT_SEGMENT_CONFIG,
    ...config,
    filters: {
      ...DEFAULT_SEGMENT_CONFIG.filters,
      ...(config?.filters ?? {}),
      industries: config?.filters?.industries ?? [],
      companySizes: config?.filters?.companySizes ?? [],
      countries: config?.filters?.countries ?? [],
      roles: config?.filters?.roles ?? [],
      keywords: config?.filters?.keywords ?? [],
      includeTags: config?.filters?.includeTags ?? [],
      excludeTags: config?.filters?.excludeTags ?? [],
      customFields: config?.filters?.customFields ?? [],
    },
    dataSignals: {
      ...DEFAULT_SEGMENT_CONFIG.dataSignals,
      ...(config?.dataSignals ?? {}),
    },
    advancedRules: {
      ...DEFAULT_SEGMENT_CONFIG.advancedRules,
      ...(config?.advancedRules ?? {}),
    },
    schedule: {
      ...DEFAULT_SEGMENT_CONFIG.schedule,
      ...(config?.schedule ?? {}),
    },
    threshold: config?.threshold ?? DEFAULT_SEGMENT_CONFIG.threshold,
    limit: config?.limit ?? DEFAULT_SEGMENT_CONFIG.limit,
  }

  // Embed normalized weights for downstream usage
  const normalizedWeights = normalizeWeights(weights)
  base.qualityWeights = normalizedWeights

  return base
}

function serializeSegmentConfig(config: SegmentConfig): Json {
  const { qualityWeights, ...rest } = config
  const copy = {
    ...rest,
  }

  return copy as unknown as Json
}

function parseKnowledgeSummary(value: Json | null): KnowledgeSummary {
  if (!value || typeof value !== 'object') {
    return { total: 0, ready: 0, pending: 0, processing: 0, failed: 0 }
  }

  const obj = value as Record<string, any>
  return {
    total: Number(obj.total ?? 0),
    ready: Number(obj.ready ?? 0),
    pending: Number(obj.pending ?? 0),
    processing: Number(obj.processing ?? 0),
    failed: Number(obj.failed ?? 0),
  }
}

function mapAgent(record: OutreachAgentRecord): OutreachAgent {
  const normalizedWeights = normalizeWeights(record.quality_weights as Partial<QualityWeights> | null)
  const segmentConfig = normalizeSegmentConfig(record.segment_config as Partial<SegmentConfig> | null, normalizedWeights)

  return {
    ...record,
    unique_selling_points: record.unique_selling_points ?? [],
    segment_config: segmentConfig,
    quality_weights: normalizedWeights,
    knowledge_summary: parseKnowledgeSummary(record.knowledge_summary as Json | null),
    language: (record.language as 'en' | 'de' | null) ?? DEFAULT_LANGUAGE,
  }
}

function daysSince(dateString: string | null | undefined): number | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  return Math.max(diffMs / (1000 * 60 * 60 * 24), 0)
}

function clamp(value: number, min = 0, max = 1): number {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function computeIcpFit(contact: Database['public']['Tables']['contacts']['Row'], filters: SegmentFilters, reasons: string[]): number {
  let score = 0
  let totalWeight = 0

  if (filters.countries && filters.countries.length > 0) {
    totalWeight += 1
    if (contact.country && filters.countries.includes(contact.country)) {
      score += 1
      reasons.push(`Country match (${contact.country})`)
    }
  }

  if (filters.roles && filters.roles.length > 0) {
    totalWeight += 1
    const role = contact.position || ''
    const matchesRole = filters.roles.some((r) => role.toLowerCase().includes(r.toLowerCase()))
    if (matchesRole) {
      score += 1
      reasons.push(`Role match (${role || 'unknown'})`)
    }
  }

  if (filters.keywords && filters.keywords.length > 0) {
    totalWeight += 1
    const haystack = `${contact.company || ''} ${contact.position || ''} ${contact.custom_fields ? JSON.stringify(contact.custom_fields) : ''}`.toLowerCase()
    const keywordMatch = filters.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
    if (keywordMatch) {
      score += 1
      reasons.push('Keyword match')
    }
  }

  if (filters.includeTags && filters.includeTags.length > 0) {
    totalWeight += 1
    const contactTags = contact.tags || []
    const tagMatch = contactTags.some((tag) => filters.includeTags!.includes(tag))
    if (tagMatch) {
      score += 1
      reasons.push('Tag match')
    }
  }

  if (filters.customFields && filters.customFields.length > 0) {
    totalWeight += 1
    const customFields = contact.custom_fields as Record<string, any> | null
    if (customFields) {
      const allMatch = filters.customFields.every(({ key, values }) => {
        const raw = customFields[key]
        if (!raw) return false
        const rawString = Array.isArray(raw) ? raw.join(' ').toLowerCase() : String(raw).toLowerCase()
        return values.some((value) => rawString.includes(value.toLowerCase()))
      })
      if (allMatch) {
        score += 1
        reasons.push('Custom field alignment')
      }
    }
  }

  if (totalWeight === 0) {
    return 0.5 // neutral baseline when no filters are provided
  }

  return clamp(score / totalWeight)
}

function computeEngagementScore(contact: Database['public']['Tables']['contacts']['Row'], signals: DataSignals, reasons: string[]): number {
  const engagementScore = contact.engagement_score ?? 0
  const opens = contact.engagement_open_count ?? 0
  const clicks = contact.engagement_click_count ?? 0
  const replies = contact.engagement_reply_count ?? 0

  if (signals.minEngagementScore && engagementScore < signals.minEngagementScore) {
    reasons.push(`Below target engagement score (${engagementScore.toFixed(2)})`)
  } else if (engagementScore > 0) {
    reasons.push(`Engagement score ${engagementScore.toFixed(2)}`)
  }

  if (signals.minOpens && opens < signals.minOpens) {
    reasons.push(`Fewer than ${signals.minOpens} opens`)
  }

  if (signals.minClicks && clicks < signals.minClicks) {
    reasons.push(`Fewer than ${signals.minClicks} clicks`)
  }

  if (signals.minReplies && replies < signals.minReplies) {
    reasons.push(`Fewer than ${signals.minReplies} replies`)
  }

  const normalized = clamp(
    (engagementScore / 100) + (opens * 0.05) + (clicks * 0.1) + (replies * 0.2)
  )

  return normalized
}

function computeRecencyScore(contact: Database['public']['Tables']['contacts']['Row'], signals: DataSignals, reasons: string[]): number {
  const recencyDays = signals.recencyDays ?? DEFAULT_SEGMENT_CONFIG.dataSignals.recencyDays!

  const lastPositive = daysSince(contact.engagement_last_positive_at || contact.last_replied_at)
  if (lastPositive != null && lastPositive <= recencyDays) {
    reasons.push(`Positive engagement ${Math.round(lastPositive)} days ago`)
    return clamp(1 - lastPositive / recencyDays)
  }

  const lastOpened = daysSince(contact.last_opened_at)
  if (lastOpened != null && lastOpened <= recencyDays) {
    reasons.push(`Last opened ${Math.round(lastOpened)} days ago`)
    return clamp(0.7 - lastOpened / (recencyDays * 1.5))
  }

  const lastContacted = daysSince(contact.last_contacted_at)
  if (lastContacted != null) {
    if (signals.recencyDays && lastContacted < signals.recencyDays) {
      reasons.push(`Contacted ${Math.round(lastContacted)} days ago`)
      return clamp(0.5 - lastContacted / (recencyDays * 2))
    }
  }

  return 0.25
}

function computeDeliverabilityScore(contact: Database['public']['Tables']['contacts']['Row'], signals: DataSignals, reasons: string[]): number {
  const bounceCount = contact.engagement_bounce_count ?? 0
  if (bounceCount > 0) {
    reasons.push('Previous bounce detected')
    return 0.1
  }

  const status = contact.status || 'active'
  if (status === 'unsubscribed') {
    reasons.push('Contact unsubscribed')
    return 0.05
  }

  const deliverability = signals.deliverabilityScore ?? DEFAULT_SEGMENT_CONFIG.dataSignals.deliverabilityScore!
  if (deliverability <= 0) {
    return 0.5
  }

  return clamp(deliverability)
}

function computeEnrichmentScore(contact: Database['public']['Tables']['contacts']['Row'], reasons: string[]): number {
  const enrichmentStatus = contact.enrichment_status || 'unknown'
  if (enrichmentStatus === 'complete' || enrichmentStatus === 'enriched') {
    reasons.push('Enrichment complete')
    return 1
  }

  if (enrichmentStatus === 'partial') {
    reasons.push('Partial enrichment available')
    return 0.6
  }

  if (enrichmentStatus === 'failed') {
    reasons.push('Enrichment failed previously')
    return 0.2
  }

  return 0.4
}

function satisfiesAdvancedRules(contact: Database['public']['Tables']['contacts']['Row'], rules: AdvancedRules): boolean {
  if (rules.excludeOptedOut && contact.status === 'unsubscribed') {
    return false
  }

  if (rules.excludeStatuses && rules.excludeStatuses.length > 0) {
    if (contact.status && rules.excludeStatuses.includes(contact.status)) {
      return false
    }
  }

  if (rules.excludeWithoutEmail && !contact.email) {
    return false
  }

  if (rules.excludeMissingCompany && !contact.company) {
    return false
  }

  if (rules.cooldownDays && rules.cooldownDays > 0) {
    const lastContacted = daysSince(contact.last_contacted_at)
    if (lastContacted !== null && lastContacted < rules.cooldownDays) {
      return false
    }
  }

  return true
}

function passesFilters(contact: Database['public']['Tables']['contacts']['Row'], config: SegmentConfig): boolean {
  const { filters, advancedRules } = config

  if (filters.countries && filters.countries.length > 0) {
    if (!contact.country || !filters.countries.includes(contact.country)) {
      return false
    }
  }

  if (filters.roles && filters.roles.length > 0) {
    const role = contact.position || ''
    if (!filters.roles.some((r) => role.toLowerCase().includes(r.toLowerCase()))) {
      return false
    }
  }

  if (filters.includeTags && filters.includeTags.length > 0) {
    const contactTags = contact.tags || []
    const hasMatch = contactTags.some((tag) => filters.includeTags!.includes(tag))
    if (!hasMatch) {
      return false
    }
  }

  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const contactTags = contact.tags || []
    const hasExcluded = contactTags.some((tag) => filters.excludeTags!.includes(tag))
    if (hasExcluded) {
      return false
    }
  }

  if (filters.customFields && filters.customFields.length > 0) {
    const customFields = contact.custom_fields as Record<string, any> | null
    if (!customFields) {
      return false
    }

    const meetsCustom = filters.customFields.every(({ key, values }) => {
      const raw = customFields[key]
      if (!raw) return false
      const rawString = Array.isArray(raw) ? raw.join(' ').toLowerCase() : String(raw).toLowerCase()
      return values.some((value) => rawString.includes(value.toLowerCase()))
    })

    if (!meetsCustom) {
      return false
    }
  }

  return satisfiesAdvancedRules(contact, advancedRules)
}

export async function listOutreachAgents(supabase: Supabase, userId: string): Promise<OutreachAgent[]> {
  const { data, error } = await supabase
    .from('outreach_agents')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch outreach agents: ${error.message}`)
  }

  return (data || []).map(mapAgent)
}

export async function getOutreachAgent(supabase: Supabase, userId: string, agentId: string): Promise<OutreachAgent | null> {
  const { data, error } = await supabase
    .from('outreach_agents')
    .select('*')
    .eq('user_id', userId)
    .eq('id', agentId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load outreach agent: ${error.message}`)
  }

  return data ? mapAgent(data) : null
}

export async function createOutreachAgent(supabase: Supabase, userId: string, input: OutreachAgentUpsertInput): Promise<OutreachAgent> {
  const weights = normalizeWeights(input.quality_weights)
  const segmentConfig = normalizeSegmentConfig(input.segment_config, weights)

  const payload: Database['public']['Tables']['outreach_agents']['Insert'] = {
    user_id: userId,
    name: input.name,
    status: input.status ?? 'draft',
    language: input.language ?? DEFAULT_LANGUAGE,
    purpose: input.purpose,
    tone: input.tone,
    sender_name: input.sender_name,
    sender_role: input.sender_role,
    company_name: input.company_name,
    product_one_liner: input.product_one_liner,
    product_description: input.product_description,
    unique_selling_points: input.unique_selling_points ?? [],
    target_persona: input.target_persona,
    conversation_goal: input.conversation_goal,
    preferred_cta: input.preferred_cta,
    follow_up_strategy: input.follow_up_strategy,
    custom_prompt: input.custom_prompt,
    prompt_override: input.prompt_override,
    segment_config: serializeSegmentConfig(segmentConfig),
    quality_weights: weights as unknown as Json,
    settings: (input.settings ?? {}) as Json,
  }

  const { data, error } = await supabase
    .from('outreach_agents')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create outreach agent: ${error.message}`)
  }

  return mapAgent(data)
}

export async function updateOutreachAgent(
  supabase: Supabase,
  userId: string,
  agentId: string,
  input: Partial<OutreachAgentUpsertInput>
): Promise<OutreachAgent> {
  const current = await getOutreachAgent(supabase, userId, agentId)
  if (!current) {
    throw new Error('Outreach agent not found')
  }

  const mergedWeights = normalizeWeights({ ...current.quality_weights, ...input.quality_weights })
  const mergedConfig = normalizeSegmentConfig(
    {
      ...current.segment_config,
      ...input.segment_config,
      filters: {
        ...current.segment_config.filters,
        ...(input.segment_config?.filters ?? {}),
      },
      dataSignals: {
        ...current.segment_config.dataSignals,
        ...(input.segment_config?.dataSignals ?? {}),
      },
      advancedRules: {
        ...current.segment_config.advancedRules,
        ...(input.segment_config?.advancedRules ?? {}),
      },
      schedule: {
        ...current.segment_config.schedule,
        ...(input.segment_config?.schedule ?? {}),
      },
      threshold: input.segment_config?.threshold ?? current.segment_config.threshold,
      limit: input.segment_config?.limit ?? current.segment_config.limit,
    },
    mergedWeights
  )

  const payload: Database['public']['Tables']['outreach_agents']['Update'] = {
    name: input.name ?? current.name,
    status: input.status ?? current.status,
    language: input.language ?? current.language ?? DEFAULT_LANGUAGE,
    purpose: input.purpose ?? current.purpose,
    tone: input.tone ?? current.tone,
    sender_name: input.sender_name ?? current.sender_name,
    sender_role: input.sender_role ?? current.sender_role,
    company_name: input.company_name ?? current.company_name,
    product_one_liner: input.product_one_liner ?? current.product_one_liner,
    product_description: input.product_description ?? current.product_description,
    unique_selling_points: input.unique_selling_points ?? current.unique_selling_points,
    target_persona: input.target_persona ?? current.target_persona,
    conversation_goal: input.conversation_goal ?? current.conversation_goal,
    preferred_cta: input.preferred_cta ?? current.preferred_cta,
    follow_up_strategy: input.follow_up_strategy ?? current.follow_up_strategy,
    custom_prompt: input.custom_prompt ?? current.custom_prompt,
    prompt_override: input.prompt_override ?? current.prompt_override,
    segment_config: serializeSegmentConfig(mergedConfig),
    quality_weights: mergedWeights as unknown as Json,
    settings: (input.settings ?? current.settings ?? {}) as Json,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('outreach_agents')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', agentId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update outreach agent: ${error.message}`)
  }

  return mapAgent(data)
}

export async function deleteOutreachAgent(supabase: Supabase, userId: string, agentId: string): Promise<void> {
  const { error } = await supabase
    .from('outreach_agents')
    .delete()
    .eq('user_id', userId)
    .eq('id', agentId)

  if (error) {
    throw new Error(`Failed to delete outreach agent: ${error.message}`)
  }
}

export function buildAgentPreview(
  agent: OutreachAgent,
  overrides: Partial<OutreachAgentUpsertInput> = {}
): OutreachAgent {
  const mergedWeights = normalizeWeights({ ...agent.quality_weights, ...overrides.quality_weights })

  const mergedConfig = normalizeSegmentConfig(
    {
      ...agent.segment_config,
      ...overrides.segment_config,
      filters: {
        ...agent.segment_config.filters,
        ...(overrides.segment_config?.filters ?? {}),
      },
      dataSignals: {
        ...agent.segment_config.dataSignals,
        ...(overrides.segment_config?.dataSignals ?? {}),
      },
      advancedRules: {
        ...agent.segment_config.advancedRules,
        ...(overrides.segment_config?.advancedRules ?? {}),
      },
      schedule: {
        ...agent.segment_config.schedule,
        ...(overrides.segment_config?.schedule ?? {}),
      },
      threshold: overrides.segment_config?.threshold ?? agent.segment_config.threshold,
      limit: overrides.segment_config?.limit ?? agent.segment_config.limit,
    },
    mergedWeights
  )

  return {
    ...agent,
    quality_weights: mergedWeights,
    segment_config: mergedConfig,
  }
}

export async function duplicateOutreachAgent(supabase: Supabase, userId: string, agentId: string): Promise<OutreachAgent> {
  const original = await getOutreachAgent(supabase, userId, agentId)
  if (!original) {
    throw new Error('Outreach agent not found')
  }

  const cloned = await createOutreachAgent(supabase, userId, {
    name: `${original.name} Copy`,
    status: 'draft',
    language: original.language,
    purpose: original.purpose ?? undefined,
    tone: original.tone ?? undefined,
    sender_name: original.sender_name ?? undefined,
    sender_role: original.sender_role ?? undefined,
    company_name: original.company_name ?? undefined,
    product_one_liner: original.product_one_liner ?? undefined,
    product_description: original.product_description ?? undefined,
    unique_selling_points: original.unique_selling_points ?? undefined,
    target_persona: original.target_persona ?? undefined,
    conversation_goal: original.conversation_goal ?? undefined,
    preferred_cta: original.preferred_cta ?? undefined,
    follow_up_strategy: original.follow_up_strategy ?? undefined,
    custom_prompt: original.custom_prompt ?? undefined,
    prompt_override: original.prompt_override ?? undefined,
    segment_config: original.segment_config,
    quality_weights: original.quality_weights,
    settings: (original.settings as Record<string, any> | null) ?? undefined,
  })

  // Copy knowledge attachments metadata (not binary content)
  const { data: knowledgeItems, error: knowledgeError } = await supabase
    .from('outreach_agent_knowledge')
    .select('*')
    .eq('agent_id', agentId)
    .eq('user_id', userId)

  if (!knowledgeError && knowledgeItems && knowledgeItems.length > 0) {
    const clonedItems = knowledgeItems.map((item) => ({
      agent_id: cloned.id,
      user_id: userId,
      type: item.type,
      title: item.title,
      description: item.description,
      content: item.content,
      url: item.url,
      storage_path: item.storage_path,
      embedding_status: 'pending',
      embedding_metadata: item.embedding_metadata,
    }))

    await supabase.from('outreach_agent_knowledge').insert(clonedItems)
  }

  return cloned
}

export async function addKnowledgeItem(
  supabase: Supabase,
  userId: string,
  agentId: string,
  input: KnowledgeItemInput
) {
  const agent = await getOutreachAgent(supabase, userId, agentId)
  if (!agent) {
    throw new Error('Outreach agent not found')
  }

  if (input.type !== 'text' && !input.url && !input.storage_path) {
    throw new Error('Document uploads must include a storage_path or URL reference')
  }

  const payload: Database['public']['Tables']['outreach_agent_knowledge']['Insert'] = {
    agent_id: agentId,
    user_id: userId,
    type: input.type,
    title: input.title,
    description: input.description,
    content: input.type === 'text' || input.type === 'html' ? input.content ?? '' : null,
    url: input.url,
    storage_path: input.storage_path,
    embedding_status: input.embedding_status ?? 'pending',
    embedding_metadata: (input.embedding_metadata ?? {}) as Json,
  }

  const { data, error } = await supabase
    .from('outreach_agent_knowledge')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to add knowledge item: ${error.message}`)
  }

  return data
}

export async function updateKnowledgeItem(
  supabase: Supabase,
  userId: string,
  agentId: string,
  knowledgeId: string,
  updates: Partial<KnowledgeItemInput>
) {
  const payload: Database['public']['Tables']['outreach_agent_knowledge']['Update'] = {
    title: updates.title,
    description: updates.description,
    content: updates.content,
    url: updates.url,
    storage_path: updates.storage_path,
    embedding_status: updates.embedding_status,
    embedding_metadata: updates.embedding_metadata as Json,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('outreach_agent_knowledge')
    .update(payload)
    .eq('id', knowledgeId)
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update knowledge item: ${error.message}`)
  }

  return data
}

export async function removeKnowledgeItem(
  supabase: Supabase,
  userId: string,
  agentId: string,
  knowledgeId: string
) {
  const { error } = await supabase
    .from('outreach_agent_knowledge')
    .delete()
    .eq('id', knowledgeId)
    .eq('agent_id', agentId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete knowledge item: ${error.message}`)
  }
}

export async function previewSegment(
  supabase: Supabase,
  userId: string,
  agent: OutreachAgent,
  options: { persist?: boolean; limit?: number; threshold?: number } = {}
): Promise<SegmentPreviewResult> {
  const limit = options.limit ?? agent.segment_config.limit ?? DEFAULT_SEGMENT_CONFIG.limit!
  const threshold = options.threshold ?? agent.segment_config.threshold ?? DEFAULT_SEGMENT_CONFIG.threshold!

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .limit(Math.max(limit * 4, 200))

  if (error) {
    throw new Error(`Failed to load contacts for segment preview: ${error.message}`)
  }

  const config = agent.segment_config
  const weights = agent.quality_weights

  const scored = (contacts || [])
    .filter((contact) => passesFilters(contact, config))
    .map((contact) => {
      const reasons: string[] = []
      const icp = computeIcpFit(contact, config.filters, reasons)
      const engagement = computeEngagementScore(contact, config.dataSignals, reasons)
      const recency = computeRecencyScore(contact, config.dataSignals, reasons)
      const deliverability = computeDeliverabilityScore(contact, config.dataSignals, reasons)
      const enrichment = computeEnrichmentScore(contact, reasons)

      const score = clamp(
        (weights.icpFit + EPSILON) * icp +
        (weights.engagement + EPSILON) * engagement +
        (weights.recency + EPSILON) * recency +
        (weights.deliverability + EPSILON) * deliverability +
        (weights.enrichment + EPSILON) * enrichment
      )

      return {
        contact,
        score,
        reasons,
      }
    })

  const matches = scored
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const runId = crypto.randomUUID()

  if (options.persist && matches.length > 0) {
    const scoreRows = matches.map((entry) => ({
      agent_id: agent.id,
      user_id: userId,
      contact_id: entry.contact.id,
      run_id: runId,
      score: Number(entry.score.toFixed(4)),
      reasons: entry.reasons as unknown as Json,
    }))

    await supabase.from('agent_contact_scores').insert(scoreRows)

    const segmentRows = matches.map((entry) => ({
      agent_id: agent.id,
      user_id: userId,
      contact_id: entry.contact.id,
      status: 'selected',
      score: Number(entry.score.toFixed(4)),
      reasons: entry.reasons as unknown as Json,
      run_id: runId,
      added_at: new Date().toISOString(),
      metadata: {
        preview: true,
      } as Json,
    }))

    await supabase
      .from('agent_segment_members')
      .upsert(segmentRows, { onConflict: 'agent_id,contact_id' })
  }

  const previewContacts: SegmentPreviewContact[] = matches.map((entry) => ({
    id: entry.contact.id,
    contact_id: entry.contact.id,
    full_name: `${entry.contact.first_name ?? ''} ${entry.contact.last_name ?? ''}`.trim() || entry.contact.email,
    email: entry.contact.email,
    company: entry.contact.company,
    position: entry.contact.position,
    country: entry.contact.country,
    score: Number(entry.score.toFixed(4)),
    reasons: entry.reasons,
    engagement: {
      score: entry.contact.engagement_score,
      opens: entry.contact.engagement_open_count,
      clicks: entry.contact.engagement_click_count,
      replies: entry.contact.engagement_reply_count,
      lastPositiveAt: entry.contact.engagement_last_positive_at,
    },
    enrichment: {
      status: entry.contact.enrichment_status,
      updated_at: entry.contact.enrichment_updated_at,
    },
  }))

  return {
    agent_id: agent.id,
    run_id: runId,
    limit,
    threshold,
    total_candidates: contacts?.length ?? 0,
    total_matched: previewContacts.length,
    contacts: previewContacts,
  }
}
