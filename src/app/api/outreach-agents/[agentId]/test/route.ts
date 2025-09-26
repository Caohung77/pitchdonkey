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
  const isGerman = agent.language === 'de'

  const contact = payload.sampleContact
  const contactName = contact?.first_name || contact?.company || 'there'
  const pain = contact?.pain_point

  const greetings = {
    friendly: isGerman ? `Hallo ${contactName},` : `Hey ${contactName},`,
    formal: isGerman ? `Guten Tag ${contactName},` : `Hello ${contactName},`,
    outbound: isGerman ? `Hallo ${contactName},` : `Hi ${contactName},`,
  }

  const closing = isGerman ? 'Beste Grüße,' : 'Best,'
  const valueIntro = isGerman
    ? `Wir unterstützen ${persona} regelmäßig dabei, ${pain || 'ihre Ziele schneller zu erreichen'}.`
    : `We regularly help ${persona} tackle challenges around ${pain || 'their goals'}.`
  const genericValue = isGerman
    ? `Aus deiner Nachricht entnehme ich, dass ihr das optimieren möchtet.`
    : `From what you've shared, it sounds like you're looking to optimize this.`
  const followUp = isGerman
    ? `Hättest du Zeit für ${cta.toLowerCase()}?`
    : `Would a short ${cta.toLowerCase()} work sometime next week?`
  const outboundCall = isGerman
    ? `Wenn ${goal.toLowerCase()} auf deiner Roadmap steht, könnte ${cta.toLowerCase()} spannend sein.`
    : `If ${goal.toLowerCase()} is on your roadmap, ${cta.toLowerCase()} could be worthwhile.`
  const outboundCTA = isGerman
    ? 'Lass uns diese Woche 15 Minuten finden?'
    : 'Worth exploring for a few minutes this week?'

  if (mode === 'reply') {
    const subject = payload.subjectHint || `Re: ${agent.product_one_liner || 'Thanks for reaching out'}`
    const intro = tone === 'formal'
      ? greetings.formal
      : greetings.friendly

    const replyBody = [
      intro,
      '',
      payload.incomingMessage
        ? (isGerman
            ? `Danke für deine Nachricht – der Hinweis "${payload.incomingMessage.slice(0, 120)}" hilft uns sehr.`
            : `Thanks for your note — really appreciate the context around "${payload.incomingMessage.slice(0, 120)}".`)
        : (isGerman
            ? 'Danke für die Einblicke in eure aktuelle Situation.'
            : 'Appreciate you sharing a bit about your current priorities.'),
      pain ? valueIntro : genericValue,
      agent.product_description
        ? (isGerman
            ? `Kurz gesagt: ${agent.product_description.split('\n')[0]}`
            : `In short, ${agent.product_description.split('\n')[0]}`)
        : (isGerman
            ? `Mit ${company} unterstützen wir Teams wie deins, schneller voranzukommen – ohne Zusatzaufwand.`
            : `At ${company}, we focus on helping teams like yours move faster without adding extra overhead.`),
      sellingPoints.length > 0
        ? (isGerman
            ? `Ein paar Punkte, die Kund:innen schätzen:\n- ${sellingPoints.join('\n- ')}`
            : `Here are a couple quick highlights:\n- ${sellingPoints.join('\n- ')}`)
        : '',
      followUp,
      '',
      closing,
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

  const subject = payload.subjectHint || `${contact?.company ? `${contact.company} x ` : ''}${agent.product_one_liner || (isGerman ? 'Kurzer Impuls' : 'Quick idea')}`
  const intro = tone === 'formal'
    ? greetings.formal
    : greetings.outbound

  const outboundBody = [
    intro,
    '',
    pain
      ? (isGerman ? `Mir ist aufgefallen, dass ihr gerade mit ${pain} zu tun habt.` : `Noticed you're dealing with ${pain}.`)
      : (isGerman ? 'Ich habe gesehen, dass du das Thema Wachstum federführend vorantreibst.' : `I saw you're leading the charge on revenue operations — impressive team.`),
    agent.product_one_liner
      ? agent.product_one_liner
      : (isGerman
          ? `${company} hilft ${persona}, Akquise-Prozesse effizienter zu steuern.`
          : `${company} helps ${persona} streamline prospect outreach without sacrificing quality.`),
    sellingPoints.length > 0
      ? (isGerman
          ? `Das kommt bei ähnlichen Teams gut an:\n- ${sellingPoints.join('\n- ')}`
          : `Here’s what typically resonates with teams like yours:\n- ${sellingPoints.join('\n- ')}`)
      : '',
    goal ? outboundCall : cta,
    '',
    outboundCTA,
    '',
    closing,
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
