import { z } from 'zod'

// User validation schemas
export const userSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  name: z.string().min(1, 'Name is required'),
  plan: z.enum(['starter', 'professional', 'agency']).default('starter'),
})

export const updateUserSchema = userSchema.partial()

// Email account validation schemas
export const emailAccountSchema = z.object({
  provider: z.enum(['gmail', 'outlook', 'smtp']),
  email: z.string().email(),
  name: z.string().min(1),
  oauth_tokens: z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_at: z.number(),
    scope: z.string(),
  }).optional(),
  smtp_config: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    secure: z.boolean(),
    username: z.string(),
    password: z.string(),
  }).optional(),
  settings: z.object({
    daily_limit: z.number().min(1).max(1000).default(50),
    delay_between_emails: z.number().min(30).max(3600).default(60),
    warm_up_enabled: z.boolean().default(true),
    signature: z.string().optional(),
  }).optional(),
})

export const updateEmailAccountSchema = z.object({
  name: z.string().min(1).optional(),
  settings: z.object({
    daily_limit: z.number().min(1).max(1000).optional(),
    delay_between_emails: z.number().min(30).max(3600).optional(),
    warm_up_enabled: z.boolean().optional(),
    signature: z.string().optional(),
  }).optional(),
  is_active: z.boolean().optional(),
})

// Helper function to validate URL or empty string
const urlOrEmpty = z.union([
  z.string().url(),
  z.literal(''),
  z.undefined()
]).optional()

// More lenient URL validation for CSV imports
const lenientUrlOrEmpty = z.union([
  z.string().refine(
    (val) => {
      if (!val || val === '') return true
      // Allow any string that looks like it could be a domain
      return val.includes('.') && val.length > 2
    },
    { message: "Invalid website format" }
  ),
  z.literal(''),
  z.undefined(),
  z.literal(null)
]).optional().transform((val) => {
  if (!val || val === '' || val === null) return null
  // Basic cleanup - ensure it has a protocol
  if (!val.startsWith('http')) {
    return `https://${val}`
  }
  return val
})

// Base contact schema without refinement
const baseContactSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  website: urlOrEmpty,
  phone: z.string().optional(),
  linkedin_url: urlOrEmpty,
  twitter_url: urlOrEmpty,
  address: z.string().optional(),
  postcode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  sex: z.enum(['m', 'f']).nullable().optional(),
  custom_fields: z.record(z.any()).default({}),
  tags: z.array(z.string()).default([]),
  source: z.string().optional(),
  // Enrichment fields - optional for manual editing (company overwrites normal company field)
  enriched_industry: z.string().optional(),
  enriched_products_services: z.string().optional(),
  enriched_target_audience: z.string().optional(),
  enriched_unique_points: z.string().optional(),
  enriched_tone_style: z.string().optional(),
})

// Contact validation schema - only email is required
export const contactSchema = baseContactSchema

// Lenient contact schema for CSV imports
export const csvContactSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  website: lenientUrlOrEmpty,
  phone: z.string().optional(),
  linkedin_url: lenientUrlOrEmpty,
  twitter_url: lenientUrlOrEmpty,
  address: z.string().optional(),
  postcode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  sex: z.enum(['m', 'f']).nullable().optional(),
  custom_fields: z.record(z.any()).default({}),
  tags: z.array(z.string()).default([]),
  source: z.string().optional(),
  // Enrichment fields - optional for manual editing
  enriched_industry: z.string().optional(),
  enriched_products_services: z.string().optional(),
  enriched_target_audience: z.string().optional(),
  enriched_unique_points: z.string().optional(),
  enriched_tone_style: z.string().optional(),
})

// Update schema using base schema
export const updateContactSchema = baseContactSchema.partial()

export const bulkContactsSchema = z.object({
  contacts: z.array(csvContactSchema), // Use lenient schema for bulk imports
  skip_duplicates: z.boolean().default(true),
  validate_emails: z.boolean().default(true),
})

// Campaign validation schemas
export const campaignEmailSchema = z.object({
  step_number: z.number().min(1).max(7),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  delay_days: z.number().min(0).default(0),
  conditions: z.object({
    stop_on_reply: z.boolean().default(true),
    skip_if_opened: z.boolean().default(false),
    require_previous_open: z.boolean().default(false),
  }).default({}),
})

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  sequence_data: z.object({
    emails: z.array(campaignEmailSchema).min(1, 'At least one email is required'),
  }),
  ai_settings: z.object({
    enabled: z.boolean().default(false),
    template_id: z.string().optional(),
    custom_prompt: z.string().optional(),
  }).default({}),
  schedule_settings: z.object({
    timezone: z.string().default('UTC'),
    business_hours: z.object({
      start: z.string().default('09:00'),
      end: z.string().default('17:00'),
    }),
    working_days: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
    respect_recipient_timezone: z.boolean().default(true),
  }).default({}),
  targeting_settings: z.object({
    contact_segments: z.array(z.string()).default([]),
    exclude_replied: z.boolean().default(true),
    exclude_unsubscribed: z.boolean().default(true),
  }).default({}),
})

export const updateCampaignSchema = campaignSchema.partial()

// AI personalization schemas
export const aiPersonalizationSchema = z.object({
  contact_ids: z.array(z.string().uuid()),
  template_id: z.string().optional(),
  custom_prompt: z.string().optional(),
  variables: z.record(z.string()).default({}),
  ai_provider: z.enum(['openai', 'anthropic']).default('openai'),
}).refine(data => data.template_id || data.custom_prompt, {
  message: "Either template_id or custom_prompt is required",
})

// Email validation schemas
export const emailValidationSchema = z.object({
  emails: z.array(z.string().email()),
})

// Warmup configuration schemas
export const warmupConfigSchema = z.object({
  email_account_id: z.string().uuid(),
  strategy: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  daily_targets: z.array(z.number()).optional(),
})

// Analytics query schemas
export const analyticsQuerySchema = z.object({
  campaign_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  metrics: z.array(z.enum(['sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced'])).optional(),
})

// API response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

export const paginatedResponseSchema = z.object({
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
})

// Domain authentication schemas
export const domainAuthRecordSchema = z.object({
  type: z.enum(['SPF', 'DKIM', 'DMARC']),
  status: z.enum(['valid', 'warning', 'missing', 'unknown']),
  record: z.string().nullable(),
  issues: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([])
})

export const domainAuthResultSchema = z.object({
  domain: z.string(),
  spf: domainAuthRecordSchema,
  dkim: domainAuthRecordSchema,
  dmarc: domainAuthRecordSchema,
  overall_score: z.number().min(0).max(100),
  overall_status: z.enum(['excellent', 'good', 'warning', 'critical']),
  recommendations: z.array(z.string()),
  last_checked: z.string()
})

export const domainAuthCheckSchema = z.object({
  email_account_id: z.string().uuid()
})

// Type exports
export type User = z.infer<typeof userSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>
export type EmailAccount = z.infer<typeof emailAccountSchema>
export type Contact = z.infer<typeof contactSchema>
export type CSVContact = z.infer<typeof csvContactSchema>
export type UpdateContact = z.infer<typeof updateContactSchema>
export type BulkContacts = z.infer<typeof bulkContactsSchema>
export type Campaign = z.infer<typeof campaignSchema>
export type UpdateCampaign = z.infer<typeof updateCampaignSchema>
export type CampaignEmail = z.infer<typeof campaignEmailSchema>
export type AIPersonalization = z.infer<typeof aiPersonalizationSchema>
export type EmailValidation = z.infer<typeof emailValidationSchema>
export type WarmupConfig = z.infer<typeof warmupConfigSchema>
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
export type ApiResponse = z.infer<typeof apiResponseSchema>
export type PaginatedResponse = z.infer<typeof paginatedResponseSchema>
export type DomainAuthRecord = z.infer<typeof domainAuthRecordSchema>
export type DomainAuthResult = z.infer<typeof domainAuthResultSchema>
export type DomainAuthCheck = z.infer<typeof domainAuthCheckSchema>