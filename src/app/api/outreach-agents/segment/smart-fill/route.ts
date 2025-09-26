import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

const filtersSchema = z.object({
  countries: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
})

const qualityWeightsSchema = z.object({
  icpFit: z.number().optional(),
  engagement: z.number().optional(),
  recency: z.number().optional(),
  deliverability: z.number().optional(),
  enrichment: z.number().optional(),
})

const requestSchema = z.object({
  identity: z.object({
  agentName: z.string().optional(),
  companyName: z.string().optional(),
  tone: z.string().optional(),
  purpose: z.string().optional(),
  senderRole: z.string().optional(),
  language: z.enum(['en', 'de']).optional(),
}).optional(),
  product: z.object({
    productOneLiner: z.string().optional(),
    productDescription: z.string().optional(),
    uniqueSellingPoints: z.array(z.string()).optional(),
    targetPersona: z.string().optional(),
    conversationGoal: z.string().optional(),
    preferredCTA: z.string().optional(),
    followUpStrategy: z.string().optional(),
  }).optional(),
  knowledge: z.array(z.object({
    title: z.string().optional(),
    content: z.string().optional(),
  })).max(6).optional(),
  currentConfig: z.object({
    filters: filtersSchema.optional(),
    dataSignals: z.object({
      minEngagementScore: z.number().optional(),
      recencyDays: z.number().optional(),
    }).optional(),
    threshold: z.number().optional(),
    limit: z.number().optional(),
    advancedRules: z.object({
      excludeOptedOut: z.boolean().optional(),
      excludeMissingCompany: z.boolean().optional(),
      excludeWithoutEmail: z.boolean().optional(),
      cooldownDays: z.number().optional(),
      excludeStatuses: z.array(z.string()).optional(),
    }).optional(),
    qualityWeights: qualityWeightsSchema.optional(),
  }).optional(),
})

const sanitizeList = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
}

const normalizeWeights = (weights: Record<string, number>) => {
  const defaults = {
    icpFit: 0.4,
    engagement: 0.25,
    recency: 0.2,
    deliverability: 0.1,
    enrichment: 0.05,
  }

  const merged = { ...defaults, ...weights }
  const total = Object.values(merged).reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0)
  if (!total || total <= 0) {
    return defaults
  }

  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, Math.max(0, value) / total])
  ) as typeof defaults
}

const buildPrompt = (payload: z.infer<typeof requestSchema>) => {
  const lines: string[] = []

  lines.push('You are a B2B outreach segmentation strategist. Based on the agent context, propose targeting filters and scoring weights that maximize fit and engagement for cold email campaigns.')
  lines.push('Do not invent markets. Use only explicit cues from the provided identity, product info, and knowledge snippets.')

  if (payload.identity) {
    lines.push('\n[IDENTITY]')
    if (payload.identity.agentName) lines.push(`Agent name: ${payload.identity.agentName}`)
    if (payload.identity.companyName) lines.push(`Company: ${payload.identity.companyName}`)
    if (payload.identity.purpose) lines.push(`Purpose: ${payload.identity.purpose}`)
    if (payload.identity.tone) lines.push(`Tone: ${payload.identity.tone}`)
    if (payload.identity.senderRole) lines.push(`Sender role: ${payload.identity.senderRole}`)
    if (payload.identity.language) lines.push(`Preferred language: ${payload.identity.language === 'de' ? 'German' : 'English'}`)
  }

  if (payload.product) {
    lines.push('\n[PRODUCT & GOALS]')
    if (payload.product.productOneLiner) lines.push(`One-liner: ${payload.product.productOneLiner}`)
    if (payload.product.productDescription) lines.push(`Description: ${payload.product.productDescription}`)
    if (payload.product.uniqueSellingPoints?.length) {
      lines.push('Unique selling points:')
      payload.product.uniqueSellingPoints.slice(0, 6).forEach((usp, idx) => {
        lines.push(`  ${idx + 1}. ${usp}`)
      })
    }
    if (payload.product.targetPersona) lines.push(`Target persona (user provided): ${payload.product.targetPersona}`)
    if (payload.product.conversationGoal) lines.push(`Conversation goal: ${payload.product.conversationGoal}`)
    if (payload.product.preferredCTA) lines.push(`Preferred CTA: ${payload.product.preferredCTA}`)
    if (payload.product.followUpStrategy) lines.push(`Follow-up cadence: ${payload.product.followUpStrategy}`)
  }

  if (payload.knowledge?.length) {
    lines.push('\n[KNOWLEDGE SNIPPETS]')
    payload.knowledge.slice(0, 5).forEach((item, index) => {
      lines.push(`Snippet ${index + 1}: ${item.title || 'Untitled'}`)
      if (item.content) {
        lines.push(item.content)
      }
    })
  }

  if (payload.currentConfig) {
    lines.push('\n[CURRENT SEGMENT SETTINGS PROVIDED BY USER]')
    const { filters, dataSignals, threshold, limit, advancedRules, qualityWeights } = payload.currentConfig
    if (filters) {
      lines.push(`Countries: ${(filters.countries || []).join(', ') || 'none'}`)
      lines.push(`Roles/Titles: ${(filters.roles || []).join(', ') || 'none'}`)
      lines.push(`Keywords: ${(filters.keywords || []).join(', ') || 'none'}`)
      lines.push(`Include tags: ${(filters.includeTags || []).join(', ') || 'none'}`)
      lines.push(`Exclude tags: ${(filters.excludeTags || []).join(', ') || 'none'}`)
    }
    if (dataSignals) {
      lines.push(`Min engagement score: ${dataSignals.minEngagementScore ?? 'not set'}`)
      lines.push(`Recency window (days): ${dataSignals.recencyDays ?? 'not set'}`)
    }
    if (typeof threshold === 'number') lines.push(`Current score threshold: ${threshold}`)
    if (typeof limit === 'number') lines.push(`Current contact limit: ${limit}`)
    if (qualityWeights) {
      lines.push(`Current quality weights: ${JSON.stringify(qualityWeights)}`)
    }
    if (advancedRules) {
      lines.push(`Advanced rules: ${JSON.stringify(advancedRules)}`)
    }
  }

  lines.push(`\nYour task: Recommend data-driven segmentation settings that prioritize high-fit contacts for this campaign. Consider geography, job roles, industries, company keywords, and any relevant tags or exclusions. Suggest reasonable scoring weights and thresholds.`)
  lines.push('Respond with a single JSON object using this schema:')
  lines.push(`
{
  "filters": {
    "countries": ["country"],
    "roles": ["role or title"],
    "keywords": ["keyword"],
    "includeTags": ["tag"],
    "excludeTags": ["tag"]
  },
  "dataSignals": {
    "minEngagementScore": number,
    "recencyDays": number
  },
  "advancedRules": {
    "excludeOptedOut": boolean,
    "excludeMissingCompany": boolean,
    "excludeWithoutEmail": boolean,
    "cooldownDays": number,
    "excludeStatuses": ["status"]
  },
  "threshold": number between 0 and 1,
  "limit": integer between 25 and 500,
  "qualityWeights": {
    "icpFit": number,
    "engagement": number,
    "recency": number,
    "deliverability": number,
    "enrichment": number
  },
  "rationale": "Short explanation (<=3 sentences)"
}
`)
  lines.push('Rules: Values must align with the provided context. If a field is unknown, use an empty array or null rather than guessing wildly. Countries/roles/keywords should never include placeholders. Normalise recommendations for typical B2B outbound volumes.')
  lines.push('Return only the JSON object – no commentary before or after.')

  return lines.join('\n')
}

const parseResponse = (raw: string) => {
  if (!raw) return null
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/```json|```/gi, '').trim()

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Failed to parse Gemini segmentation JSON:', error)
    return null
  }
}

const sanitizeResponse = (data: any) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Gemini returned an invalid response')
  }

  const filters = data.filters && typeof data.filters === 'object' ? {
    countries: sanitizeList(data.filters.countries),
    roles: sanitizeList(data.filters.roles),
    keywords: sanitizeList(data.filters.keywords),
    includeTags: sanitizeList(data.filters.includeTags),
    excludeTags: sanitizeList(data.filters.excludeTags),
  } : undefined

  const dataSignals = data.dataSignals && typeof data.dataSignals === 'object' ? {
    minEngagementScore: Number.isFinite(data.dataSignals.minEngagementScore) ? Number(data.dataSignals.minEngagementScore) : undefined,
    recencyDays: Number.isFinite(data.dataSignals.recencyDays) ? Number(data.dataSignals.recencyDays) : undefined,
  } : undefined

  const advancedRules = data.advancedRules && typeof data.advancedRules === 'object' ? {
    excludeOptedOut: Boolean(data.advancedRules.excludeOptedOut),
    excludeMissingCompany: Boolean(data.advancedRules.excludeMissingCompany),
    excludeWithoutEmail: Boolean(data.advancedRules.excludeWithoutEmail),
    cooldownDays: Number.isFinite(data.advancedRules.cooldownDays) ? Number(data.advancedRules.cooldownDays) : undefined,
    excludeStatuses: sanitizeList(data.advancedRules.excludeStatuses),
  } : undefined

  const rawWeights = data.qualityWeights && typeof data.qualityWeights === 'object'
    ? Object.fromEntries(
        Object.entries(data.qualityWeights).map(([key, value]) => [key, Number.isFinite(value) ? Number(value) : 0])
      )
    : undefined

  return {
    filters,
    dataSignals,
    advancedRules,
    threshold: Number.isFinite(data.threshold) ? Math.min(Math.max(Number(data.threshold), 0), 1) : undefined,
    limit: Number.isFinite(data.limit) ? Math.min(Math.max(Math.round(Number(data.limit)), 10), 1000) : undefined,
    qualityWeights: rawWeights ? normalizeWeights(rawWeights) : undefined,
    rationale: typeof data.rationale === 'string' ? data.rationale.trim() : undefined,
  }
}

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    await withRateLimit(user, 5, 60000)

    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request payload',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Smart segmentation is not configured. Missing GOOGLE_GEMINI_API_KEY',
        },
        { status: 503 }
      )
    }

    const prompt = buildPrompt(parsed.data)
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText} - ${errorBody}`)
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n').trim()

    if (!text) {
      throw new Error('Gemini returned an empty response')
    }

    const parsedResponse = parseResponse(text)
    if (!parsedResponse) {
      throw new Error('Could not parse AI response – no JSON found')
    }

    const sanitized = sanitizeResponse(parsedResponse)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: sanitized,
      })
    )
  } catch (error) {
    console.error('POST /api/outreach-agents/segment/smart-fill error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate segment suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 }
    )
  }
})
