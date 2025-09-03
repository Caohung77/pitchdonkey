import { NextRequest, NextResponse } from 'next/server'

function getSystemPrompt(): string {
  return `YOU ARE AN EXPERT WEB RESEARCHER AND BUSINESS INTELLIGENCE ANALYST. Your task is to extract factual business information from company websites for email personalization purposes.

CRITICAL INSTRUCTIONS:
1. You MUST search the web and access the actual website content
2. Extract ONLY factual information that appears on the website
3. Do NOT invent or assume information that isn't explicitly stated
4. If the website is not accessible, clearly state this in your response
5. Return findings in the exact JSON schema below

OUTPUT FORMAT (MANDATORY JSON SCHEMA):
{ "company_name":"", "industry":"", "products_services":[], "target_audience":[], "unique_points":[], "tone_style":"" }`
}

function buildPrompt(websiteUrl: string): string {
  return `IMPORTANT: Please search the web and access the company website at ${websiteUrl} to extract detailed business information.\n\nREQUIRED TASKS:\n1. Access and read the content from ${websiteUrl}\n2. Extract company information from the actual website content\n3. Look for: company name, services, contact information, about section, products offered\n4. Use web search if direct access fails\n\nCRITICAL: You must actually search for and access the website content. Do not make assumptions based on the domain name alone.\n\nProvide the extracted information in the exact JSON format specified in your system instructions.`
}

const stripThink = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'PERPLEXITY_API_KEY not set' }, { status: 500 })
    }

    const url = new URL(request.url)
    const website = url.searchParams.get('url') || 'https://herm-jacobsen.de/'
    const domain = website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')

    const body = {
      model: 'sonar-reasoning',
      messages: [
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: buildPrompt(website) }
      ],
      search_domain_filter: [domain],
      temperature: 0.1,
      max_tokens: 1500,
      search_recency_filter: 'month'
    }

    const resp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const text = await resp.text()
    if (!resp.ok) {
      return NextResponse.json({ success: false, error: `HTTP ${resp.status}`, details: text })
    }

    let rawContent = ''
    let parsed: any = null
    try {
      const json = JSON.parse(text)
      rawContent = json?.choices?.[0]?.message?.content || ''
      const cleaned = stripThink(rawContent)
      const m1 = cleaned.match(/\{[\s\S]*?"company_name"[\s\S]*?"tone_style"[\s\S]*?\}/)
      const m2 = m1 || cleaned.match(/\{[\s\S]*?\}/)
      if (m2) parsed = JSON.parse(m2[0])
    } catch (e) {
      rawContent = text
    }

    return NextResponse.json({
      success: true,
      domain,
      bodyUsed: { ...body, messages: undefined },
      parsed,
      rawPreview: rawContent?.slice(0, 1200)
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed' }, { status: 500 })
  }
}

