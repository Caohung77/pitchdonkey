import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { getOutreachAgent, buildAgentPreview, type OutreachAgent } from '@/lib/outreach-agents'

const sampleContactSchema = z.object({
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  company: z.string().max(255).optional(),
  role: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  pain_point: z.string().max(1000).optional(),
})

const previewTestSchema = z.object({
  mode: z.enum(['reply', 'outbound']).default('reply'),
  sampleContact: sampleContactSchema.optional(),
  incomingMessage: z.string().max(6000).optional(),
  campaignName: z.string().max(255).optional(),
  subjectHint: z.string().max(255).optional(),
  segmentOverrides: z.object({}).passthrough().optional(),
})

type PreviewTestPayload = z.infer<typeof previewTestSchema>

type DraftResult = {
  subject: string
  body: string
  highlights: string[]
}

function buildDraft(mode: 'reply' | 'outbound', payload: PreviewTestPayload, agent: OutreachAgent): DraftResult {
  const identity = `${agent.sender_name || agent.name}${agent.sender_role ? `, ${agent.sender_role}` : ''}`
  const company = agent.company_name || agent.product_one_liner || 'Our team'
  const persona = agent.target_persona || 'your team'
  const goal = agent.conversation_goal || 'keep the conversation going'
  const cta = agent.preferred_cta || 'schedule a quick call'
  const tone = agent.tone || 'friendly'
  const sellingPoints = (agent.unique_selling_points || []).slice(0, 3)

  const contact = payload.sampleContact
  const contactName = contact?.first_name || contact?.company || 'there'
  const pain = contact?.pain_point

  if (mode === 'reply') {
    const subject = payload.subjectHint || `Re: ${agent.product_one_liner || 'Thanks for reaching out'}`
    const intro = tone === 'formal'
      ? `Hello ${contactName},`
      : `Hey ${contactName},`

    const replyBody = [
      intro,
      '',
      payload.incomingMessage
        ? `Thanks for your note — really appreciate the context around "${payload.incomingMessage.slice(0, 120)}".`
        : `Appreciate you sharing a bit about your current priorities.`,
      pain
        ? `We regularly help ${persona} tackle challenges around ${pain}.`
        : `From what you've shared, it sounds like you're looking to optimize how your team approaches this.`,
      agent.product_description
        ? `In short, ${agent.product_description.split('\n')[0]}`
        : `At ${company}, we focus on helping teams like yours move faster without adding extra overhead.`,
      sellingPoints.length > 0 ? `Here are a couple quick highlights:\n- ${sellingPoints.join('\n- ')}` : '',
      `Happy to ${goal.toLowerCase()} — would a short ${cta.toLowerCase()} work sometime next week?`,
      '',
      `Best,`,
      identity,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      subject,
      body: replyBody,
      highlights: [
        `Tone: ${tone}`,
        goal ? `Goal: ${goal}` : 'Goal: Continue engagement',
        cta ? `CTA: ${cta}` : 'CTA: Follow up suggested',
      ],
    }
  }

  const subject = payload.subjectHint || `${contact?.company ? `${contact.company} x ` : ''}${agent.product_one_liner || 'Quick idea'}`
  const intro = tone === 'formal'
    ? `Hello ${contactName},`
    : `Hi ${contactName},`

  const outboundBody = [
    intro,
    '',
    pain
      ? `Noticed you're dealing with ${pain}.`
      : `I saw you're leading the charge on revenue operations — impressive team.`,
    agent.product_one_liner
      ? agent.product_one_liner
      : `${company} helps ${persona} streamline prospect outreach without sacrificing quality.`,
    sellingPoints.length > 0 ? `Here’s what typically resonates with teams like yours:\n- ${sellingPoints.join('\n- ')}` : '',
    goal ? `If ${goal.toLowerCase()} is on your roadmap, ${cta.toLowerCase()} could be worthwhile.` : cta,
    '',
    `Worth exploring for a few minutes this week?`,
    '',
    `Best,`,
    identity,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    subject,
    body: outboundBody,
    highlights: [
      `Audience: ${persona}`,
      goal ? `Goal: ${goal}` : 'Goal: Start a conversation',
      `Tone: ${tone}`,
    ],
  }
}

// POST /api/outreach-agents/[agentId]/test
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 15, 60000)

    const { agentId } = await params
    const agent = await getOutreachAgent(supabase, user.id, agentId)

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Outreach agent not found' },
        { status: 404 }
      )
    }

    const body = request.body ? await request.json() : {}
    const parsed = previewTestSchema.parse(body ?? {})

    const overrides = parsed.segmentOverrides
      ? ({ segment_config: parsed.segmentOverrides } as any)
      : {}

    const previewAgent = buildAgentPreview(agent, overrides)

    const draft = buildDraft(parsed.mode, parsed, previewAgent)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: { draft } })
    )
  } catch (error) {
    console.error('POST /api/outreach-agents/[agentId]/test error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.flatten(),
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate outreach draft',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
