#!/usr/bin/env node
// Quick test runner for Perplexity enrichment prompt
function getSystemPrompt() {
  return `YOU ARE AN EXPERT WEB RESEARCHER AND BUSINESS INTELLIGENCE ANALYST. Your task is to extract factual business information from company websites for email personalization purposes.

CRITICAL INSTRUCTIONS:
1. You MUST search the web and access the actual website content
2. Extract ONLY factual information that appears on the website
3. Do NOT invent or assume information that isn't explicitly stated
4. If the website is not accessible, clearly state this in your response
5. Return findings in the exact JSON schema below

SEARCH STRATEGY:
- Try direct website access first
- Use web search if direct access fails
- Look for: homepage, about page, services page, contact information
- Focus on business-relevant information for outreach

OUTPUT FORMAT (MANDATORY JSON SCHEMA):
{
  "company_name": "",
  "industry": "",
  "products_services": [],
  "target_audience": [],
  "unique_points": [],
  "tone_style": ""
}

QUALITY REQUIREMENTS:
- company_name: Exact name as it appears on website
- industry: Specific industry/sector (not generic terms)
- products_services: Specific offerings (max 5 items)
- target_audience: Specific customer types mentioned
- unique_points: Actual differentiators mentioned on site
- tone_style: Professional communication style observed

If website is not accessible or contains insufficient information, return empty fields rather than guessing.`
}

function buildPrompt(websiteUrl) {
  return `IMPORTANT: Please search the web and access the company website at ${websiteUrl} to extract detailed business information.

REQUIRED TASKS:
1. Access and read the content from ${websiteUrl}
2. Extract company information from the actual website content
3. Look for: company name, services, contact information, about section, products offered
4. Use web search if direct access fails

CRITICAL: You must actually search for and access the website content. Do not make assumptions based on the domain name alone.

Provide the extracted information in the exact JSON format specified in your system instructions.`
}

function domainOnly(url) {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
}

function stripThink(content) {
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

(async () => {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY not set')
    const url = process.argv[2] || 'https://herm-jacobsen.de/'
    const sys = getSystemPrompt()
    const user = buildPrompt(url)
    const body = {
      model: 'sonar-reasoning',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      search_domain_filter: [domainOnly(url)],
      temperature: 0.1,
      max_tokens: 1500,
      search_recency_filter: 'month'
    }
    console.log('Calling Perplexity with body:', JSON.stringify({ ...body, messages: [{role:'system'},{role:'user'}] }))
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`HTTP ${res.status}: ${t}`)
    }
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    const cleaned = stripThink(content)
    // Try to extract JSON block
    const m1 = cleaned.match(/\{[\s\S]*?"company_name"[\s\S]*?"tone_style"[\s\S]*?\}/)
    const m2 = m1 || cleaned.match(/\{[\s\S]*?\}/)
    let parsed = null
    if (m2) {
      try { parsed = JSON.parse(m2[0]) } catch {}
    }
    console.log('\nRaw content (truncated):\n', cleaned.slice(0, 800))
    console.log('\nParsed JSON:')
    console.log(JSON.stringify(parsed, null, 2))
  } catch (e) {
    console.error('Test failed:', e.message)
    process.exit(1)
  }
})()
