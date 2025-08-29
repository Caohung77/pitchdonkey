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
    return `Search the web and analyze the company website: ${websiteUrl}

TASK: Visit and analyze the company website at ${websiteUrl} to extract business information for email personalization.

REQUIRED: Search and read the actual website content, including:
- Homepage content and company description
- About page and company background  
- Products/services offered
- Target market and customers
- Company values and unique selling points

IMPORTANT: You must actually search and access the website content at ${websiteUrl} to provide accurate information. Do not make assumptions.

Output the findings in the exact JSON format specified in your system instructions.`
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
      console.log('🔍 Full response content:', content.substring(0, 500) + '...')
      
      // Remove thinking tags if present (for sonar-reasoning model)
      let cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      console.log('🧹 Cleaned content:', cleanContent.substring(0, 300) + '...')
      
      // Look for JSON in the response - try multiple patterns
      let jsonMatch = cleanContent.match(/\{[\s\S]*?"company_name"[\s\S]*?"tone_style"[\s\S]*?\}/);
      
      if (!jsonMatch) {
        // Try broader JSON pattern
        jsonMatch = cleanContent.match(/\{[\s\S]*?\}/);
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
    
    // Try to extract industry information
    let industry = ''
    const industryMatches = content.match(/industry[:\s]+(.*?)(?:\n|\.|\,|$)/i) ||
                           content.match(/sector[:\s]+(.*?)(?:\n|\.|\,|$)/i) ||
                           content.match(/business[:\s]+(.*?)(?:\n|\.|\,|$)/i)
    if (industryMatches) {
      industry = industryMatches[1].trim().substring(0, 100)
    }
    
    // Try to extract products/services
    let products_services: string[] = []
    const productsText = content.match(/products?[:\s]+(.*?)(?:\n\n|\.|$)/i) ||
                        content.match(/services?[:\s]+(.*?)(?:\n\n|\.|$)/i)
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