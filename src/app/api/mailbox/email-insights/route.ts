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
  invalid_contact: 'red', // Person no longer at company/email invalid
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

IMPORTANT INTENT CLASSIFICATION:
- Use "invalid_contact" when: person no longer works there, email won't be forwarded, position changed, contact unreachable
- Use "unsubscribe" when: explicit opt-out request
- Use "negative_reply" when: not interested, stop contacting
- Use "auto_reply" when: out of office, vacation, generic auto-response (but still valid contact)

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
  "intent": "purchase_interest | meeting_request | info_request | positive_reply | negative_reply | unsubscribe | invalid_contact | auto_reply | other",
  "contact_status": "green | yellow | red"
}`
  }

  // Generic prompt for emails without agent linkage
  return `You are an AI assistant that processes inbound emails for an outreach dashboard. Emails can be in English or German. Your task is to analyze the raw email body and return a compact JSON object. Follow the rules strictly. Remember:

- If the email is in English → return summary and firstliner in English.
- If the email is in German → return summary and firstliner in German.
- Keep intent labels and contact_status values in English using the allowed list.
- Output JSON only, with the fields described below. Do not wrap the JSON in code fences.

IMPORTANT INTENT CLASSIFICATION:
- Use "invalid_contact" when: person no longer works there, email won't be forwarded, position changed, contact unreachable, email invalid
- Use "unsubscribe" when: explicit opt-out request, wants to be removed from list
- Use "negative_reply" when: not interested, stop contacting, don't email again
- Use "auto_reply" when: out of office, vacation, generic auto-response (but contact still valid)

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
  "intent": "purchase_interest | meeting_request | info_request | positive_reply | negative_reply | unsubscribe | invalid_contact | auto_reply | other",
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
          outreach_agents:ai_personas!email_accounts_outreach_agent_id_fkey (
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

        // IMPORTANT: Check if cached summary has red status and update contact if needed
        if (summary.contact_status === 'red' && (summary.intent === 'unsubscribe' || summary.intent === 'negative_reply' || summary.intent === 'invalid_contact')) {
          console.log(`🚨 Cached red status detected (${summary.intent}), checking contact engagement...`)

          let contactEmail = summary.sender_email
          if (summary.intent === 'invalid_contact') {
            const bodyText = email.text_content?.trim().length ? email.text_content : cleanHtml(email.html_content)
            const failedRecipient = extractFailedRecipient(bodyText || '', email.subject || '')
            if (failedRecipient) {
              console.log(`📧 Extracted failed recipient: ${failedRecipient}`)
              contactEmail = failedRecipient
            }
          }

          const { data: contact } = await supabase
            .from('contacts')
            .select('id, email, engagement_status')
            .eq('email', contactEmail)
            .eq('user_id', user.id)
            .maybeSingle()

          if (contact && contact.engagement_status !== 'bad') {
            console.log(`🔄 Contact found with status: ${contact.engagement_status}, updating to bad...`)

            const updateData: any = {
              engagement_status: 'bad',
              updated_at: new Date().toISOString()
            }

            if (summary.intent === 'unsubscribe') {
              updateData.unsubscribed_at = new Date().toISOString()
            } else if (summary.intent === 'invalid_contact') {
              updateData.bounced_at = new Date().toISOString()
            }

            await supabase.from('contacts').update(updateData).eq('id', contact.id)

            try {
              const { recalculateContactEngagement } = await import('@/lib/contact-engagement')
              await recalculateContactEngagement(supabase, contact.id)
              console.log(`✅ Contact ${contact.id} updated and engagement recalculated`)
            } catch (err) {
              console.error('Failed to recalculate engagement:', err)
            }
          }
        }

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

    // If AI detected unsubscribe, negative intent, or invalid contact (red status), update contact engagement
    if (payload.contact_status === 'red' && (normalizedIntent === 'unsubscribe' || normalizedIntent === 'negative_reply' || normalizedIntent === 'invalid_contact')) {
      console.log(`🚨 Red status detected for email ${emailId} (${normalizedIntent}), updating contact engagement...`)

      // For bounce/invalid_contact emails, extract the failed recipient from email body
      let contactEmail = payload.sender_email
      if (normalizedIntent === 'invalid_contact') {
        const failedRecipient = extractFailedRecipient(bodyText || '', email.subject || '')
        if (failedRecipient) {
          console.log(`📧 Extracted failed recipient from bounce: ${failedRecipient}`)
          contactEmail = failedRecipient
        } else {
          console.warn(`⚠️ Could not extract failed recipient from bounce email, using sender: ${payload.sender_email}`)
        }
      }

      // Find contact by email address
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name')
        .eq('email', contactEmail)
        .eq('user_id', user.id)
        .maybeSingle()

      if (contact) {
        console.log(`✅ Found contact: ${contact.first_name} ${contact.last_name} (${contact.email})`)
        // Update contact based on intent
        const updateData: any = {
          engagement_status: 'bad',
          updated_at: new Date().toISOString()
        }

        if (normalizedIntent === 'unsubscribe') {
          updateData.unsubscribed_at = new Date().toISOString()
        } else if (normalizedIntent === 'invalid_contact') {
          // Mark as bounced since contact is no longer valid
          updateData.bounced_at = new Date().toISOString()
        }

        const { error: contactUpdateError } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contact.id)

        if (contactUpdateError) {
          console.error('Failed to update contact status:', contactUpdateError)
        } else {
          console.log(`✅ Updated contact ${contact.id} with ${normalizedIntent} status`)
        }

        // Trigger engagement recalculation
        try {
          const { recalculateContactEngagement } = await import('@/lib/contact-engagement')
          await recalculateContactEngagement(supabase, contact.id)
          console.log(`✅ Recalculated engagement for contact ${contact.id}`)
        } catch (engagementError) {
          console.error('Failed to recalculate engagement:', engagementError)
        }
      } else {
        console.warn(`⚠️ Contact not found for email: ${contactEmail}`)
      }
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

/**
 * Extract the failed recipient email from a bounce message
 * Enhanced version with comprehensive pattern matching and header parsing
 *
 * Supports multiple bounce formats:
 * - English: "could not be delivered to user@example.com"
 * - German: "konnte nicht an user@example.de zugestellt werden"
 * - Headers: X-Failed-Recipients, Original-Recipient, Final-Recipient
 * - Structured: RCPT TO:<user@example.com>
 */
const extractFailedRecipient = (emailBody: string, emailSubject: string): string | null => {
  console.log('🔍 Extracting failed recipient from bounce email...')

  // Step 1: Check email headers for explicit failure information
  const headerPatterns = [
    // Standard bounce headers
    /X-Failed-Recipients:\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
    /Original-Recipient:\s*(?:rfc822;)?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
    /Final-Recipient:\s*(?:rfc822;)?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
    // SMTP envelope information
    /RCPT TO:\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
  ]

  for (const pattern of headerPatterns) {
    const match = emailBody.match(pattern)
    if (match && match[1]) {
      const email = match[1].trim()
      console.log(`✅ Extracted from header: ${email}`)
      return email
    }
  }

  // Step 2: Enhanced body text patterns (English & German)
  const bodyPatterns = [
    // English patterns
    /(?:could not be delivered to|delivery to the following recipient failed|undeliverable to|failed to deliver to|delivery has failed to)\s+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
    /(?:message to the following address|the following recipient|recipient address|destination address)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
    /(?:your message to|addressed to|sent to)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,

    // German patterns
    /(?:konnte nicht zugestellt werden an|zustellung fehlgeschlagen an|empfänger|nicht zugestellt werden an)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
    /(?:nachricht an folgende adresse|folgende empfänger|empfängeradresse)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
    /(?:Die E-Mail an|wurde nicht zugestellt)[:\s]+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,

    // Standalone email on a line (common in bounce messages)
    /^[\s]*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})[\s]*$/im,

    // Generic patterns (less specific, used as fallback)
    /(?:recipient|empfänger)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
    /(?:to|an)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?(?:\s|$)/i,
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\s+(?:because of|wegen|due to|auf grund)/i,

    // Status notification formats
    /Action:\s*failed.*?Recipient:\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/is,
    /Status:\s*5\.\d+\.\d+.*?(?:for|to)\s+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/is,
  ]

  for (const pattern of bodyPatterns) {
    const match = emailBody.match(pattern)
    if (match && match[1]) {
      const email = match[1].trim()
      // Validate email doesn't look like MAILER-DAEMON or system address
      if (!email.includes('mailer-daemon') && !email.includes('postmaster') && !email.includes('no-reply')) {
        console.log(`✅ Extracted from body: ${email}`)
        return email
      }
    }
  }

  // Step 3: Check subject line (only if it contains specific bounce keywords)
  const bounceKeywords = ['delivery', 'failed', 'bounce', 'undeliverable', 'zustellung', 'fehlgeschlagen']
  const hasBouncKeyword = bounceKeywords.some(keyword =>
    emailSubject.toLowerCase().includes(keyword)
  )

  if (hasBouncKeyword) {
    // Extract first email that's NOT a system address
    const allEmails = emailSubject.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []
    for (const email of allEmails) {
      const lowerEmail = email.toLowerCase()
      if (!lowerEmail.includes('mailer-daemon') &&
          !lowerEmail.includes('postmaster') &&
          !lowerEmail.includes('no-reply') &&
          !lowerEmail.includes('bounce')) {
        console.log(`✅ Extracted from subject: ${email}`)
        return email.trim()
      }
    }
  }

  console.warn('⚠️ Failed to extract recipient from bounce email')
  return null
}
