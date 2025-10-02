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

const buildPrompt = (email: { senderName: string; senderEmail: string; subject: string; body: string }) => {
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
  if (!apiKey) return null

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    })

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUAL, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
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

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const { emailId } = await request.json()

    if (!emailId || typeof emailId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'emailId is required',
      }, { status: 400 })
    }

    const { data: email, error } = await supabase
      .from('incoming_emails')
      .select(
        `id, from_address, subject, text_content, html_content`
      )
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

    const bodyText = email.text_content?.trim().length
      ? email.text_content
      : cleanHtml(email.html_content)

    const senderEmail = extractEmailAddress(email.from_address)
    const senderName = email.from_address?.split('<')[0]?.trim() || senderEmail || 'Unknown'

  const prompt = buildPrompt({
    senderName,
    senderEmail: senderEmail || 'unknown@example.com',
    subject: email.subject || '(No subject)',
    body: stripQuotedLines(bodyText || '(No body)').slice(0, 6000),
  })

  let insights = await runGemini(prompt)

  if (!insights) {
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

    console.log('✅ Email insight summary', emailId, payload.summary)

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
