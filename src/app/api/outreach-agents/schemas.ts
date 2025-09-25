import { z } from 'zod'

export const qualityWeightsSchema = z.object({
  icpFit: z.number().min(0).max(1).optional(),
  engagement: z.number().min(0).max(1).optional(),
  recency: z.number().min(0).max(1).optional(),
  deliverability: z.number().min(0).max(1).optional(),
  enrichment: z.number().min(0).max(1).optional(),
}).partial()

export const segmentFiltersSchema = z.object({
  industries: z.array(z.string()).max(20).optional(),
  companySizes: z.array(z.string()).max(20).optional(),
  countries: z.array(z.string()).max(20).optional(),
  roles: z.array(z.string()).max(20).optional(),
  keywords: z.array(z.string()).max(50).optional(),
  includeTags: z.array(z.string()).max(20).optional(),
  excludeTags: z.array(z.string()).max(20).optional(),
  customFields: z
    .array(
      z.object({
        key: z.string().min(1),
        values: z.array(z.string()).max(20),
      })
    )
    .max(20)
    .optional(),
}).partial()

export const dataSignalsSchema = z.object({
  minEngagementScore: z.number().min(0).max(100).optional(),
  minOpens: z.number().int().min(0).max(1000).optional(),
  minClicks: z.number().int().min(0).max(1000).optional(),
  minReplies: z.number().int().min(0).max(1000).optional(),
  maxBounceRate: z.number().min(0).max(1).optional(),
  recencyDays: z.number().int().min(1).max(3650).optional(),
  deliverabilityScore: z.number().min(0).max(1).optional(),
}).partial()

export const advancedRulesSchema = z.object({
  excludeOptedOut: z.boolean().optional(),
  excludeStatuses: z.array(z.string()).max(20).optional(),
  cooldownDays: z.number().int().min(0).max(365).optional(),
  excludeWithoutEmail: z.boolean().optional(),
  excludeMissingCompany: z.boolean().optional(),
}).partial()

export const scheduleSchema = z
  .object({
    mode: z.enum(['manual', 'daily', 'weekly', 'webhook']).default('manual'),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: z.string().optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    webhookUrl: z.string().url().optional(),
  })
  .partial()

export const segmentConfigSchema = z
  .object({
    filters: segmentFiltersSchema.optional(),
    dataSignals: dataSignalsSchema.optional(),
    advancedRules: advancedRulesSchema.optional(),
    schedule: scheduleSchema.optional(),
    threshold: z.number().min(0).max(1).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  })
  .partial()

export const agentCreateSchema = z.object({
  name: z.string().min(2).max(120),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  purpose: z.string().max(2000).optional(),
  tone: z.string().max(50).optional(),
  sender_name: z.string().max(255).optional(),
  sender_role: z.string().max(255).optional(),
  company_name: z.string().max(255).optional(),
  product_one_liner: z.string().max(500).optional(),
  product_description: z.string().max(4000).optional(),
  unique_selling_points: z.array(z.string()).max(25).optional(),
  target_persona: z.string().max(1000).optional(),
  conversation_goal: z.string().max(255).optional(),
  preferred_cta: z.string().max(255).optional(),
  follow_up_strategy: z.string().max(255).optional(),
  custom_prompt: z.string().max(8000).optional(),
  prompt_override: z.string().max(12000).optional(),
  segment_config: segmentConfigSchema.optional(),
  quality_weights: qualityWeightsSchema.optional(),
  settings: z.record(z.any()).optional(),
})

export const agentUpdateSchema = agentCreateSchema.partial()

type AgentCreateSchema = z.infer<typeof agentCreateSchema>

export type AgentCreateInput = AgentCreateSchema
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>

export const knowledgeItemSchema = z.object({
  type: z.enum(['pdf', 'doc', 'text', 'link', 'html']),
  title: z.string().min(2).max(255),
  description: z.string().max(4000).optional(),
  content: z.string().max(50000).optional(),
  url: z.string().url().optional(),
  storage_path: z.string().max(512).optional(),
  embedding_status: z.enum(['pending', 'processing', 'ready', 'failed']).optional(),
  embedding_metadata: z.record(z.any()).optional(),
})

export const segmentPreviewSchema = z.object({
  segment_config: segmentConfigSchema.optional(),
  quality_weights: qualityWeightsSchema.optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  threshold: z.number().min(0).max(1).optional(),
  persist: z.boolean().optional(),
})
