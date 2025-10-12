import { GoogleGenerativeAI } from '@google/generative-ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getOutreachAgent, type OutreachAgent } from './outreach-agents'

type Supabase = SupabaseClient<Database>

export interface ImproveDraftInput {
  subject: string
  body: string
}

export interface GenerateDraftInput {
  prompt: string
  hints?: {
    length?: 'short' | 'medium' | 'long'
  }
}

export interface ComposeResult {
  subject: string
  body: string
  provider: 'gemini' | 'fallback'
  rationale?: string
}

const DEFAULT_MODEL = 'gemini-1.5-flash'

export async function improveDraftWithAgent(
  supabase: Supabase,
  userId: string,
  agentId: string,
  input: ImproveDraftInput
): Promise<ComposeResult> {
  const agent = await loadAgentOrThrow(supabase, userId, agentId)
  const plainBody = htmlToPlainText(input.body || '')
  const persona = buildPersonaSummary(agent)
  const prompt = buildImprovePrompt(agent, persona, input.subject || '(No subject)', plainBody)

  const fallback = basicImprove(agent, input.subject || '', plainBody)

  const aiResult = await maybeCallGemini(prompt)
  if (!aiResult) {
    return { ...fallback, provider: 'fallback' }
  }

  const parsed = parseComposeResponse(aiResult, {
    subject: fallback.subject,
    body: fallback.body,
  })

  return {
    subject: parsed.subject,
    body: ensureHtml(parsed.body),
    provider: 'gemini',
    rationale: parsed.rationale,
  }
}

export async function generateDraftWithAgent(
  supabase: Supabase,
  userId: string,
  agentId: string,
  input: GenerateDraftInput
): Promise<ComposeResult> {
  const agent = await loadAgentOrThrow(supabase, userId, agentId)
  const persona = buildPersonaSummary(agent)
  const prompt = buildGeneratePrompt(agent, persona, input.prompt, input.hints)

  const fallback = basicGenerate(agent, input.prompt)

  const aiResult = await maybeCallGemini(prompt)
  if (!aiResult) {
    return { ...fallback, provider: 'fallback' }
  }

  const parsed = parseComposeResponse(aiResult, {
    subject: fallback.subject,
    body: fallback.body,
  })

  return {
    subject: parsed.subject,
    body: ensureHtml(parsed.body),
    provider: 'gemini',
    rationale: parsed.rationale,
  }
}

async function loadAgentOrThrow(
  supabase: Supabase,
  userId: string,
  agentId: string
): Promise<OutreachAgent> {
  const agent = await getOutreachAgent(supabase, userId, agentId)

  if (!agent) {
    throw new Error('Outreach agent not found')
  }

  if (agent.status !== 'active') {
    throw new Error(`Agent "${agent.name}" is not active (status: ${agent.status})`)
  }

  return agent
}

function buildPersonaSummary(agent: OutreachAgent): string {
  const parts: string[] = []

  if (agent.sender_name) {
    parts.push(`You speak as ${agent.sender_name}${agent.sender_role ? `, ${agent.sender_role}` : ''}`)
  } else {
    parts.push(`You speak as ${agent.name}`)
  }

  if (agent.company_name) {
    parts.push(`representing ${agent.company_name}`)
  }

  if (agent.purpose) {
    parts.push(`Purpose: ${agent.purpose}`)
  }

  if (agent.tone) {
    parts.push(`Tone: ${agent.tone}`)
  }

  if (agent.conversation_goal) {
    parts.push(`Conversation goal: ${agent.conversation_goal}`)
  }

  if (agent.preferred_cta) {
    parts.push(`Preferred CTA: ${agent.preferred_cta}`)
  }

  if (agent.product_one_liner) {
    parts.push(`Product context: ${agent.product_one_liner}`)
  }

  if (agent.custom_prompt) {
    parts.push(`Additional guidance: ${agent.custom_prompt}`)
  }

  return parts.join('\n')
}

function buildImprovePrompt(
  agent: OutreachAgent,
  persona: string,
  subject: string,
  body: string
): string {
  return `You are an outreach email agent refining a draft so it sounds polished but still written by the same human.

${persona}

TASK:
- Improve grammar, clarity, and flow
- Preserve the original intent and key points
- Maintain the voice and tone of the agent
- Keep it concise and avoid unnecessary embellishment
- Return clean HTML paragraphs (use <p> tags, no inline styles)
- Do not remove or add signature unless it feels broken

INPUT DRAFT (Subject + Body):
Subject: ${subject}
Body:
${body}

Respond with valid JSON:
{
  "subject": "Improved subject",
  "bodyHtml": "<p>Improved HTML body</p>",
  "rationale": "Brief 1-2 sentence explanation"
}`
}

function buildGeneratePrompt(
  agent: OutreachAgent,
  persona: string,
  brief: string,
  hints?: GenerateDraftInput['hints']
): string {
  const desiredLength = hints?.length
    ? { short: 'under 100 words', medium: '120-160 words', long: 'up to 220 words' }[hints.length] ?? '120-160 words'
    : '120-160 words'

  return `You are an outreach email agent drafting a brand new email for the user.

${persona}

BRIEF:
${brief}

Requirements:
- Produce an email that is ${desiredLength}
- Include a relevant subject line
- Use clean HTML paragraphs (<p> tags). No inline styles.
- Be specific and actionable.
- End with the agent's natural sign-off (use sender_name if present, otherwise the agent name).
- Do not invent facts. Use the brief and persona information.

Respond with valid JSON:
{
  "subject": "Subject line",
  "bodyHtml": "<p>Email HTML body</p>",
  "rationale": "Brief 1-2 sentence explanation"
}`
}

async function maybeCallGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('⚠️ Gemini API key missing. Falling back to basic compose output.')
    return null
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL })
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Gemini compose call failed:', error)
  }

  return null
}

function parseComposeResponse(
  raw: string,
  fallback: { subject: string; body: string }
): { subject: string; body: string; rationale?: string } {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const candidate = jsonMatch ? jsonMatch[0] : raw
    const parsed = JSON.parse(candidate)

    const subject = String(parsed.subject || fallback.subject || '').trim()
    const body =
      String(parsed.bodyHtml || parsed.body_html || parsed.body || fallback.body || '').trim()

    const rationale = parsed.rationale ? String(parsed.rationale).trim() : undefined

    return {
      subject: subject || fallback.subject,
      body: body || fallback.body,
      rationale,
    }
  } catch (error) {
    console.warn('Failed to parse compose AI response, using fallback:', error)
    return {
      subject: fallback.subject,
      body: fallback.body,
    }
  }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ensureHtml(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '<p></p>'
  if (/<(p|div|ul|ol|table|br)(\s|>)/i.test(trimmed)) {
    return trimmed
  }

  const paragraphs = trimmed.split(/\n{2,}/).map((segment) => segment.trim()).filter(Boolean)
  if (paragraphs.length === 0) {
    return `<p>${escapeHtml(trimmed)}</p>`
  }
  return paragraphs.map((segment) => `<p>${escapeHtml(segment)}</p>`).join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function basicImprove(
  agent: OutreachAgent,
  subject: string,
  plainBody: string
): { subject: string; body: string } {
  const cleanedSubject = smartCapitalize(subject)
  const cleanedBody = ensureHtml(refineWhitespace(plainBody))

  return {
    subject: cleanedSubject,
    body: cleanedBody,
  }
}

function basicGenerate(agent: OutreachAgent, brief: string): { subject: string; body: string } {
  const subject = smartCapitalize(brief).slice(0, 78)
  const lines = [
    'Hi there,',
    '',
    brief.trim(),
    '',
    `Best,`,
    agent.sender_name || agent.name,
  ]

  return {
    subject: subject || 'Quick note',
    body: ensureHtml(lines.join('\n')),
  }
}

function refineWhitespace(value: string): string {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').replace(/ ?([,.!?;:])/g, '$1').trim()
}

function smartCapitalize(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
