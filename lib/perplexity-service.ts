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
          search_domain_filter: [websiteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
          temperature: 0.2,
          max_tokens: 1000
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
    return `Please analyze the website "${websiteUrl}" and extract relevant company information for email personalization.

Focus specifically on information from this company's website: ${websiteUrl}

Search for and analyze the content from this website to understand:
- What the company does
- What industry they operate in  
- Their products or services
- Who their target customers are
- What makes them unique
- Their communication style and tone

Please provide the analysis in the exact JSON format specified in your instructions.`
  }

  /**
   * Get the system prompt for enrichment analysis
   */
  private getSystemPrompt(): string {
    return `YOU ARE AN OUTREACH ENRICHMENT EXPERT. YOUR TASK IS TO ANALYZE RAW COMPANY WEBSITE CONTENT AND EXTRACT ONLY THE MOST RELEVANT INFORMATION NEEDED TO PERSONALIZE A PROFESSIONAL OUTREACH EMAIL. YOU MUST PROVIDE CLEAR, FACTUAL, AND ACTIONABLE INSIGHTS THAT DIRECTLY SUPPORT EMAIL PERSONALIZATION.  

###INSTRUCTIONS###

1. READ and UNDERSTAND the company's website text.  
2. IDENTIFY and SUMMARIZE only the information that would help someone write a personalized outreach email.  
3. RETURN findings in the STRICT JSON schema below.  
4. USE CONCISE language — NO marketing fluff, filler, or generic statements.  
5. IF information is missing, leave the field as an empty string "" or empty array [] — NEVER invent details.  

###CHAIN OF THOUGHTS (MANDATORY REASONING PROCESS)###

1. **UNDERSTAND**: Grasp the website's main focus.  
2. **BASICS**: Extract the company's core business model (what they do, who they serve).  
3. **BREAK DOWN**: Identify products/services, target audience, unique points, and tone separately.  
4. **ANALYZE**: Detect key differentiators, achievements, or positioning language.  
5. **BUILD**: Convert findings into short, factual bullet points.  
6. **EDGE CASES**: Handle vague or missing data by leaving fields empty — NEVER hallucinate.  
7. **FINAL ANSWER**: Return results in structured JSON only.  

###OUTPUT FORMAT (STRICT JSON)###

{
  "company_name": "",
  "industry": "",
  "products_services": [],
  "target_audience": [],
  "unique_points": [],
  "tone_style": ""
}

###WHAT NOT TO DO###

- DO NOT invent or guess missing information  
- DO NOT include generic marketing phrases like "leading company" or "best-in-class" unless explicitly in text  
- DO NOT copy large paragraphs — always condense into short bullet points  
- DO NOT include irrelevant info (like press releases, unrelated blog posts, or unrelated job listings)  
- DO NOT change the output format or schema  

###EXAMPLE###

**Input (excerpt from Shopify's website):**  
"Shopify is a commerce platform that allows anyone to set up an online store and sell their products. Whether you sell online, on social media, in-store, or out of the trunk of your car, Shopify has you covered. Millions of businesses in 175 countries use Shopify. We believe the future of commerce has more voices, not fewer, so we're reducing barriers to entrepreneurship."  

**Output JSON:**  
{
  "company_name": "Shopify",
  "industry": "E-commerce SaaS",
  "products_services": ["Online store builder", "Payment processing", "POS system"],
  "target_audience": ["Small businesses", "Entrepreneurs", "Retailers"],
  "unique_points": ["Large app ecosystem", "Global reach", "Easy-to-use platform"],
  "tone_style": "Innovative, supportive, growth-focused"
}`
  }

  /**
   * Parse the enrichment response from Perplexity
   */
  private parseEnrichmentResponse(content: string): EnrichmentData {
    try {
      // Look for JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*"company_name"[\s\S]*"tone_style"[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        // Validate the structure
        if (this.validateEnrichmentData(parsed)) {
          return parsed
        }
      }

      // If JSON parsing fails, try to extract manually
      console.warn('⚠️ JSON parsing failed, attempting manual extraction')
      return this.extractManually(content)

    } catch (error) {
      console.error('❌ Failed to parse enrichment response:', error)
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
    // Fallback: create empty structure
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