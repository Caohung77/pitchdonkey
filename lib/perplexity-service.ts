interface PerplexityResponse {
  id: string
  model: string
  object: string
  created: number
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
    delta: {
      role: string
      content: string
    }
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface EnrichmentData {
  company_name: string
  industry: string
  products_services: string[]
  target_audience: string[]
  unique_points: string[]
  tone_style: string
}

export class PerplexityService {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.perplexity.ai'

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY!
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not configured')
    }
  }

  /**
   * Verify that a website is reachable and likely valid.
   * Tries the provided URL; if it fails and the host has/hasn't "www.", tries the alternate.
   */
  static async verifyWebsiteAccessible(url: string): Promise<{ ok: boolean; finalUrl?: string }> {
    const tryFetch = async (u: string) => {
      try {
        const resp = await fetch(u, { method: 'GET', redirect: 'follow' })
        if (resp.ok) {
          const ct = resp.headers.get('content-type') || ''
          // Consider it accessible if it's HTML or unknown but 200
          if (ct.includes('text/html') || ct === '') {
            return { ok: true as const, finalUrl: resp.url || u }
          }
        }
        return { ok: false as const }
      } catch {
        return { ok: false as const }
      }
    }

    // Try original
    const first = await tryFetch(url)
    if (first.ok) return first

    // Toggle www variant
    try {
      const u = new URL(url)
      const host = u.host
      const hasWww = host.startsWith('www.')
      const altHost = hasWww ? host.replace(/^www\./, '') : `www.${host}`
      u.host = altHost
      const second = await tryFetch(u.toString())
      if (second.ok) return second
    } catch {}

    return { ok: false }
  }

  /**
   * Analyze website content using Perplexity AI
   */
  async analyzeWebsite(websiteUrl: string): Promise<EnrichmentData> {
    const prompt = this.buildEnrichmentPrompt(websiteUrl)
    
    try {
      console.log(`🔍 Analyzing website: ${websiteUrl}`)
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          // First try: restrict browsing to the target domain (if supported by model)
          search_domain_filter: [websiteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')],
          temperature: 0.0,
          max_tokens: 1500,
          search_recency_filter: "month"
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('❌ Perplexity API Error:', response.status, response.statusText)
        console.error('❌ Perplexity API Error Details:', errorData)
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorData}`)
      }

      const data: PerplexityResponse = await response.json()
      console.log('✅ Perplexity API response received')

      // Extract the content from the response
      const content = data.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content received from Perplexity API')
      }

      console.log('📄 Generated content preview:', content.substring(0, 200) + '...')

      // Parse the JSON response
      let enrichmentData = this.parseEnrichmentResponse(content)
      const meaningful = this.validateMeaningful(enrichmentData)
      
      // Fallback: if nothing meaningful, try a broader search without strict domain filter
      if (!meaningful) {
        console.warn('⚠️ No meaningful data parsed; attempting fallback search without domain filter')
        const fallbackResp = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: this.getSystemPrompt() },
              { role: 'user', content: `${prompt}\nIf the site blocks access, use search results to locate its official pages (Impressum, Was wir machen, Leistungen) and extract only from those pages.` }
            ],
            temperature: 0.0,
            max_tokens: 1500,
            search_recency_filter: 'month'
          })
        })
        if (fallbackResp.ok) {
          const fb = await fallbackResp.json()
          const fbContent = fb.choices?.[0]?.message?.content || ''
          enrichmentData = this.parseEnrichmentResponse(fbContent)
        } else {
          console.warn('⚠️ Fallback search failed:', await fallbackResp.text())
        }
      }
      
      console.log('📊 Parsed enrichment data:', enrichmentData)
      return enrichmentData

    } catch (error) {
      console.error('❌ Error analyzing website:', error)
      throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Build the enrichment prompt with website URL
   */
  private buildEnrichmentPrompt(websiteUrl: string): string {
    return `CRITICAL: Access and read the actual website content at ${websiteUrl}. This may be a German business website. Extract ONLY factual information that appears on the website itself.

REQUIRED TASKS:
1. Navigate to ${websiteUrl} and read the homepage content
2. Look for About page, Services page, Contact information, Impressum, "Über uns", "Leistungen", "Was wir machen"
3. Extract ONLY information explicitly stated on the website
4. Do NOT infer or assume information based on domain name or industry assumptions
5. Pay special attention to technology terms, AI services, automation, and digital marketing

FOCUS AREAS:
- Company name: Exact name as shown on the website
- Industry: Classify precisely - distinguish between AI/automation services, digital marketing, software development, consulting
- Services/Products: Only those specifically listed or described (look for German terms like "Dienstleistungen", "Lösungen")
- Target audience: Only if clearly stated as "we serve..." or "our clients are..." or "für Unternehmen" etc.

SPECIAL ATTENTION FOR GERMAN SITES:
- Look for "KI" (Künstliche Intelligenz), "Automation", "Chatbots", "Agenten"
- Check if they offer AI services vs. traditional marketing services
- Note if they specialize in automation, machine learning, or AI solutions

STRICT RULE: If information is not clearly stated on the website, leave those fields empty. Do not fill in likely or assumed information. Be precise with industry classification.

Provide extracted information as a single JSON block only - no commentary.`
  }

  /**
   * Get the system prompt for enrichment analysis
   */
  private getSystemPrompt(): string {
    return `YOU ARE A FACTUAL WEB CONTENT EXTRACTOR specializing in accurate business classification. Your task is to read company websites and extract only explicitly stated information with special attention to technology and service industries.

EXTRACTION RULES:
1. Access the website and read the actual content
2. Extract ONLY information explicitly written on the website
3. Do NOT infer, assume, or deduce information from domain names or context
4. If information is not clearly stated, leave fields empty
5. Return only the JSON schema below
6. If the website is not reachable or provides no relevant content, return all fields empty (do NOT guess)

EXTRACTION STRATEGY:
- Read homepage, about page, services/products pages, team page
- Look for company description, service lists, target market statements
- Pay special attention to technology, automation, AI, agent, marketing terms
- Extract word-for-word from website content
- Do not interpret or analyze - just extract

INDUSTRY CLASSIFICATION GUIDANCE:
For accurate industry classification, look for these keywords:
- AI/Automation: "KI", "Künstliche Intelligenz", "AI", "artificial intelligence", "automation", "chatbots", "agents", "machine learning", "ML"
- Digital Marketing (ONLY if explicitly mentioned): "marketing", "online marketing", "seo", "content marketing", "social media", "werbung", "kampagnen", "agentur" (marketing context)
- Software Development: "software development", "web development", "app development", "programming"
- Consulting: "beratung", "consulting", "strategy", "business consulting"
- Craftsmanship: "tischler", "tischlerei", "schreiner", "schreinerei", "handwerk", "möbelbau", "innenausbau"
- German Business Terms: "dienstleistungen", "lösungen", "entwicklung", "beratung"

STRICT NEGATIVE RULES:
- Never label as "Digital Marketing" unless the site explicitly uses marketing-related terms above.
- If the site uses craftsmanship terms (e.g., "Tischlerei", "Schreinerei"), classify as "Carpentry/Joinery" or a precise craft category.
- If explicit industry is absent, leave "industry" empty rather than guessing.

OUTPUT FORMAT (MANDATORY):
Return ONLY this JSON structure with extracted facts:

\`\`\`json
{
  "company_name": "",
  "industry": "",
  "products_services": [],
  "target_audience": [],
  "unique_points": [],
  "tone_style": ""
}
\`\`\`

FIELD REQUIREMENTS:
- company_name: Exact name from website (required)
- industry: PRECISELY categorize based on primary business focus (e.g., "AI and Automation Services", "Digital Marketing", "Software Development")
- products_services: Only services/products explicitly listed (max 5)
- target_audience: Only if website states "we serve X" or "our customers are Y"
- unique_points: Only explicit differentiators mentioned on site
- tone_style: Only if clear communication style is evident

STRICT RULE: Empty fields are better than guessed information. Do not fill fields with likely assumptions. Be precise with industry classification - if it's an AI/automation company, don't classify it as general "digital marketing".`
  }

  /**
   * Parse the enrichment response from Perplexity
   */
  private parseEnrichmentResponse(content: string): EnrichmentData {
    try {
      console.log('🔍 Full response content:', content.substring(0, 500) + '...')
      
      // Remove thinking tags if present (for sonar-reasoning model)
      let cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      console.log('🧹 Cleaned content:', cleanContent.substring(0, 300) + '...')
      
      // Look for JSON in the response - support fenced blocks first
      let jsonMatch: RegExpMatchArray | null = null
      const fenced = cleanContent.match(/```json[\s\S]*?```/i) || cleanContent.match(/```[\s\S]*?```/)
      if (fenced) {
        const inside = fenced[0].replace(/```json|```/gi, '').trim()
        try {
          const parsed = JSON.parse(inside)
          if (this.validateEnrichmentData(parsed)) {
            return parsed
          }
        } catch {}
      }
      // Then look for object containing required keys
      jsonMatch = cleanContent.match(/\{[\s\S]*?"company_name"[\s\S]*?"tone_style"[\s\S]*?\}/)
      if (!jsonMatch) {
        // Try broader JSON pattern as last resort
        jsonMatch = cleanContent.match(/\{[\s\S]*?\}/)
      }
      
      if (jsonMatch) {
        console.log('📝 Found JSON match:', jsonMatch[0].substring(0, 200) + '...')
        const parsed = JSON.parse(jsonMatch[0])
        
        // Validate the structure
        if (this.validateEnrichmentData(parsed)) {
          console.log('✅ Successfully parsed enrichment data:', parsed)
          return parsed
        } else {
          console.warn('⚠️ JSON structure validation failed')
        }
      }

      // If JSON parsing fails, try to extract manually from the content
      console.warn('⚠️ JSON parsing failed, attempting manual extraction')
      return this.extractManually(cleanContent)

    } catch (error) {
      console.error('❌ Failed to parse enrichment response:', error)
      console.error('❌ Content that failed to parse:', content)
      throw new Error('Failed to parse enrichment data from API response')
    }
  }

  /**
   * Validate enrichment data structure
   */
  private validateEnrichmentData(data: any): data is EnrichmentData {
    return (
      typeof data === 'object' &&
      typeof data.company_name === 'string' &&
      typeof data.industry === 'string' &&
      Array.isArray(data.products_services) &&
      Array.isArray(data.target_audience) &&
      Array.isArray(data.unique_points) &&
      typeof data.tone_style === 'string'
    )
  }

  private validateMeaningful(data: EnrichmentData): boolean {
    if (!data) return false
    return Boolean(
      (data.company_name && data.company_name.trim().length > 0) ||
      (data.industry && data.industry.trim().length > 0) ||
      (Array.isArray(data.products_services) && data.products_services.length > 0) ||
      (Array.isArray(data.target_audience) && data.target_audience.length > 0) ||
      (Array.isArray(data.unique_points) && data.unique_points.length > 0) ||
      (data.tone_style && data.tone_style.trim().length > 0)
    )
  }

  /**
   * Manual extraction fallback
   */
  private extractManually(content: string): EnrichmentData {
    console.log('🔧 Attempting manual extraction from content')
    
    // Try to extract company name
    let company_name = ''
    const companyMatches = content.match(/company[:\s]+(.*?)(?:\n|\.|\,|$)/i)
    if (companyMatches) {
      company_name = companyMatches[1].trim().substring(0, 100)
    }
    
    // Try to extract industry information (EN + DE)
    let industry = ''
    const industryMatches = content.match(/industry[:\s]+(.*?)(?:\n|\.|\,|$)/i) ||
                           content.match(/sector[:\s]+(.*?)(?:\n|\.|\,|$)/i) ||
                           content.match(/business[:\s]+(.*?)(?:\n|\.|\,|$)/i) ||
                           content.match(/branche[:\s]+(.*?)(?:\n|\.|\,|$)/i)
    if (industryMatches) {
      industry = industryMatches[1].trim().substring(0, 100)
    }
    
    // Try to extract products/services (EN + DE)
    let products_services: string[] = []
    const productsText = content.match(/products?[:\s]+(.*?)(?:\n\n|\.|$)/i) ||
                        content.match(/services?[:\s]+(.*?)(?:\n\n|\.|$)/i) ||
                        content.match(/produkte?[:\s]+(.*?)(?:\n\n|\.|$)/i) ||
                        content.match(/dienstleistungen?[:\s]+(.*?)(?:\n\n|\.|$)/i) ||
                        content.match(/leistungen?[:\s]+(.*?)(?:\n\n|\.|$)/i)
    if (productsText) {
      products_services = productsText[1].split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0).slice(0, 5)
    }
    
    // If we found any information, create a structured response
    if (company_name || industry || products_services.length > 0) {
      const extractedData = {
        company_name,
        industry,
        products_services,
        target_audience: [],
        unique_points: [],
        tone_style: ''
      }
      
      console.log('🎯 Manual extraction result:', extractedData)
      return extractedData
    }
    
    // Last fallback: create empty structure but log the issue
    console.warn('❌ Manual extraction failed - no useful data found in content')
    console.log('📄 Content preview for debugging:', content.substring(0, 1000))
    
    return {
      company_name: '',
      industry: '',
      products_services: [],
      target_audience: [],
      unique_points: [],
      tone_style: ''
    }
  }

  /**
   * Validate website URL
   */
  static validateWebsiteUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Normalize website URL
   */
  static normalizeWebsiteUrl(url: string): string {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      return new URL(url).href
    } catch {
      throw new Error('Invalid website URL format')
    }
  }
}
