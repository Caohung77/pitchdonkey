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
          model: 'sonar-reasoning',
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
          search_domain_filter: [websiteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')],
          temperature: 0.1,
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
      const enrichmentData = this.parseEnrichmentResponse(content)
      
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
    return `IMPORTANT: Please search the web and access the company website at ${websiteUrl} to extract detailed business information.

REQUIRED TASKS:
1. Access and read the content from ${websiteUrl}
2. Extract company information from the actual website content
3. Look for: company name, services, contact information, about section, products offered
4. Use web search if direct access fails

CRITICAL: You must actually search for and access the website content. Do not make assumptions based on the domain name alone.

Provide the extracted information strictly as a single fenced JSON block as specified in the system instructions. Do not include any explanation.`
  }

  /**
   * Get the system prompt for enrichment analysis
   */
  private getSystemPrompt(): string {
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

OUTPUT FORMAT (MANDATORY):
Return ONLY a fenced JSON block that conforms to this schema, with no prose before or after:
\n```json
{
  "company_name": "",
  "industry": "",
  "products_services": [],
  "target_audience": [],
  "unique_points": [],
  "tone_style": ""
}
```

QUALITY REQUIREMENTS:
- company_name: Exact name as it appears on website
- industry: Specific industry/sector (not generic terms)
- products_services: Specific offerings (max 5 items)
- target_audience: Specific customer types mentioned
- unique_points: Actual differentiators mentioned on site
- tone_style: Professional communication style observed

If website is not accessible or contains insufficient information, return an empty JSON object that still matches the schema (empty strings/arrays). Do not include commentary.`
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
