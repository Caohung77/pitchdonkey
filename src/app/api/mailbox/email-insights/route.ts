import { NextRequest, NextResponse } from 'next/server'
import { addSecurityHeaders, withAuth } from '@/lib/auth-middleware'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'

type EmailInsightResponse = {
  sender_name: string
  sender_email: string
  subject: string
  firstliner: string
  summary: string
  intent: string
  contact_status: 'green' | 'yellow' | 'red'
  agent_id?: string | null
  agent_persona?: string | null
}

const FALLBACK_INSIGHTS: EmailInsightResponse = {
  sender_name: 'Unknown',
  sender_email: 'unknown@example.com',
  subject: '(No subject)',
  firstliner: '',
  summary: '',
  intent: 'other',
  contact_status: 'yellow',
}

const INTENT_STATUS_MAP: Record<string, EmailInsightResponse['contact_status']> = {
  purchase_interest: 'green',
  meeting_request: 'green',
  positive_reply: 'green',
  info_request: 'yellow',
  auto_reply: 'yellow',
  other: 'yellow',
  negative_reply: 'red',
  unsubscribe: 'red',
}

const cleanHtml = (value: string | null | undefined) => {
  if (!value) return ''
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractFirstLine = (text: string) => {
  const normalized = text.replace(/\r\n/g, '\n')
  const firstLine = normalized.split('\n').find(line => line.trim().length > 0)
  return firstLine ? firstLine.trim() : ''
}

const stripQuotedLines = (value: string) => {
  return value
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return false
      if (trimmed.startsWith('>')) return false
      if (/^on\s.+wrote:$/i.test(trimmed)) return false
      if (/^am\s.+schrieb/i.test(trimmed)) return false
      return true
    })
    .join('\n')
    .trim()
}

const buildPrompt = (
  email: { senderName: string; senderEmail: string; subject: string; body: string },
  agent?: {
    sender_name: string | null
    sender_role: string | null
    company_name: string | null
    purpose: string | null
    tone: string | null
    target_persona: string | null
    product_one_liner: string | null
    conversation_goal: string | null
    language: string
  } | null
) => {
  // Build persona-aware prompt if agent is linked
  if (agent && agent.sender_name && agent.company_name) {
    const languageNote = agent.language === 'de'
      ? '- Analyze in German and return summary/firstliner in German.'
      : '- Analyze in English and return summary/firstliner in English.'

    return `You are ${agent.sender_name}${agent.sender_role ? `, ${agent.sender_role}` : ''} at ${agent.company_name}.

YOUR CONTEXT:
${agent.purpose ? `- Your purpose: ${agent.purpose}` : ''}
${agent.tone ? `- Your communication style: ${agent.tone}` : ''}
${agent.target_persona ? `- Your target audience: ${agent.target_persona}` : ''}
${agent.product_one_liner ? `- Your product/service: ${agent.product_one_liner}` : ''}
${agent.conversation_goal ? `- Your goal: ${agent.conversation_goal}` : ''}

You received a reply from ${email.senderName} (${email.senderEmail}) with subject "${email.subject}".

ANALYZE THIS EMAIL FROM YOUR PERSPECTIVE:
- Does it show interest in your offering?
- Is it relevant to your outreach goals?
- What's their intent and how should YOU respond?
${languageNote}
- Keep intent/contact_status in English.
- Output JSON only, no code fences.

Email body:
"""
${email.body}
"""

Return JSON:
{
  "sender_name": "...",
  "sender_email": "...",
  "subject": "...",
  "firstliner": "...",
  "summary": "... (persona-aware summary from YOUR perspective)",
  "intent": "purchase_interest | meeting_request | info_request | positive_reply | negative_reply | unsubscribe | auto_reply | other",
  "contact_status": "green | yellow | red"
}`
  }

  // Generic prompt for emails without agent linkage
  return `You are an AI assistant that processes inbound emails for an outreach dashboard. Emails can be in English or German. Your task is to analyze the raw email body and return a compact JSON object. Follow the rules strictly. Remember:

- If the email is in English → return summary and firstliner in English.
- If the email is in German → return summary and firstliner in German.
- Keep intent labels and contact_status values in English using the allowed list.
- Output JSON only, with the fields described below. Do not wrap the JSON in code fences.

Email metadata:
- Sender name: ${email.senderName}
- Sender email: ${email.senderEmail}
- Subject: ${email.subject}

Email body:
"""
${email.body}
"""

Return JSON with this structure:
{
  "sender_name": "...",
  "sender_email": "...",
  "subject": "...",
  "firstliner": "...",
  "summary": "...",
  "intent": "purchase_interest | meeting_request | info_request | positive_reply | negative_reply | unsubscribe | auto_reply | other",
  "contact_status": "green | yellow | red"
}`
}

const runGemini = async (prompt: string) => {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.error('❌ GOOGLE_GEMINI_API_KEY not found in environment')
    return null
  }

  console.log('🔑 Gemini API key found, initializing...')

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    })
    console.log('🤖 Gemini model initialized: gemini-2.5-flash-lite')

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
    })

    const raw = response.response.text?.() || response.response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return null

    let sanitized = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim()

    try {
      return JSON.parse(sanitized) as EmailInsightResponse
    } catch (parseError) {
      const jsonMatch = sanitized.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw parseError
      sanitized = jsonMatch[0]
      return JSON.parse(sanitized) as EmailInsightResponse
    }
  } catch (error) {
    console.error('Failed to generate email insight with Gemini:', error)
    return null
  }
}

const determineStatus = (intent: string): EmailInsightResponse['contact_status'] => {
  return INTENT_STATUS_MAP[intent] || 'yellow'
}

const buildFallbackSummary = (
  intent: string,
  firstLine: string,
  bodyText: string,
  senderName: string,
): string => {
  if (firstLine) {
    return firstLine
  }

  const trimmed = bodyText.trim()
  if (trimmed.length) {
    return trimmed.slice(0, 220)
  }

  switch (intent) {
    case 'auto_reply':
      return `${senderName} sent an automatic reply.`
    case 'negative_reply':
      return `${senderName} is not interested.`
    case 'purchase_interest':
      return `${senderName} is asking about pricing or next steps.`
    case 'meeting_request':
      return `${senderName} is requesting a call or meeting.`
    case 'unsubscribe':
      return `${senderName} wants to unsubscribe.`
    default:
      return 'Inbound email received.'
  }
}

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const { emailId, forceRegenerate } = await request.json()

    if (!emailId || typeof emailId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'emailId is required',
      }, { status: 400 })
    }

    console.log('🔄 Email insights request:', { emailId, forceRegenerate })

    const { data: email, error } = await supabase
      .from('incoming_emails')
      .select(`
        id,
        from_address,
        subject,
        text_content,
        html_content,
        ai_summary,
        email_account_id,
        email_accounts!inner (
          id,
          email,
          outreach_agent_id,
          outreach_agents (
            id,
            name,
            sender_name,
            sender_role,
            company_name,
            purpose,
            tone,
            target_persona,
            product_one_liner,
            conversation_goal,
            language
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('id', emailId)
      .maybeSingle()

    if (error || !email) {
      console.error('Unable to load email for insights:', error)
      return NextResponse.json({
        success: false,
        error: 'Email not found',
      }, { status: 404 })
    }

    // Check if we have a cached AI summary that's less than 7 days old (skip if force regenerate)
    if (!forceRegenerate && email.ai_summary && typeof email.ai_summary === 'object') {
      const summary = email.ai_summary as any
      const generatedAt = summary.generated_at ? new Date(summary.generated_at) : null
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      console.log('🔍 Checking cached summary:', { emailId, hasCache: true, generatedAt, isExpired: generatedAt ? generatedAt <= sevenDaysAgo : true })

      if (generatedAt && generatedAt > sevenDaysAgo) {
        console.log('✅ Using cached AI summary for email', emailId)
        return addSecurityHeaders(NextResponse.json({
          success: true,
          data: {
            sender_name: summary.sender_name,
            sender_email: summary.sender_email,
            subject: summary.subject,
            firstliner: summary.firstliner,
            summary: summary.summary,
            intent: summary.intent,
            contact_status: summary.contact_status,
            agent_id: summary.agent_id || null,
            agent_persona: summary.agent_persona || null,
          } as EmailInsightResponse
        }))
      }

      console.log('⏰ Cached summary expired or invalid, regenerating...')
    } else if (forceRegenerate) {
      console.log('🔄 Force regenerate requested, bypassing cache...')
    } else {
      console.log('🔍 No cached summary found')
    }

    console.log('🤖 Generating new AI summary for email', emailId)

    const bodyText = email.text_content?.trim().length
      ? email.text_content
      : cleanHtml(email.html_content)

    const senderEmail = extractEmailAddress(email.from_address)
    const senderName = email.from_address?.split('<')[0]?.trim() || senderEmail || 'Unknown'

    // Get linked outreach agent if available
    const emailAccount = (email as any).email_accounts
    const agent = emailAccount?.outreach_agents?.[0] || null

    if (agent) {
      console.log(`🎭 Using agent persona: ${agent.name} (${agent.id})`)
    } else {
      console.log('📧 No agent linked - using generic prompt')
    }

    const prompt = buildPrompt(
      {
        senderName,
        senderEmail: senderEmail || 'unknown@example.com',
        subject: email.subject || '(No subject)',
        body: stripQuotedLines(bodyText || '(No body)').slice(0, 6000),
      },
      agent
    )

    console.log('📤 Sending prompt to Gemini...')
    console.log('📝 Prompt preview:', prompt.slice(0, 200))
    let insights = await runGemini(prompt)
    console.log('📥 Gemini response:', insights)

  if (!insights) {
    console.warn('⚠️ Gemini returned null, using fallback')
    const fallbackBody = stripQuotedLines(bodyText || '')
    const firstLine = extractFirstLine(fallbackBody)
    insights = {
      ...FALLBACK_INSIGHTS,
      sender_name: senderName,
      sender_email: senderEmail || 'unknown@example.com',
      subject: email.subject || '(No subject)',
      firstliner: firstLine,
      summary: '',
    }
  } else {
    console.log('✅ Gemini generated summary:', insights.summary)
  }

    const normalizedIntent = insights.intent || 'other'
    const contactStatus = determineStatus(normalizedIntent)

    const payload: EmailInsightResponse = {
      sender_name: insights.sender_name || senderName,
      sender_email: insights.sender_email || senderEmail || 'unknown@example.com',
      subject: insights.subject || email.subject || '(No subject)',
      firstliner: insights.firstliner || extractFirstLine(bodyText || ''),
      summary: insights.summary,
      intent: normalizedIntent,
      contact_status: contactStatus,
    }

    if (!payload.summary || !payload.summary.trim()) {
      payload.summary = buildFallbackSummary(
        normalizedIntent,
        payload.firstliner,
        bodyText || '',
        payload.sender_name,
      )
    }

    console.log('✅ Email insight summary', emailId, payload.summary)

    // Cache the AI summary in the database for future use
    const aiSummaryData = {
      ...payload,
      generated_at: new Date().toISOString(),
      model: 'gemini-2.5-flash-lite',
      agent_id: agent?.id || null,
      agent_persona: agent ? `${agent.sender_name} at ${agent.company_name}` : null,
    }

    const { error: updateError } = await supabase
      .from('incoming_emails')
      .update({ ai_summary: aiSummaryData })
      .eq('id', emailId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to cache AI summary:', updateError)
      // Don't fail the request if caching fails, just log the error
    } else {
      console.log('💾 Cached AI summary for email', emailId)
    }

    return addSecurityHeaders(NextResponse.json({ success: true, data: payload }))
  } catch (error) {
    console.error('Email insights API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate email insights',
    }, { status: 500 })
  }
})

const extractEmailAddress = (value?: string | null): string | null => {
  if (!value) return null
  const angle = value.match(/<([^>]+)>/)
  if (angle) return angle[1].trim()
  const simple = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return simple ? simple[0] : value.trim()
}
