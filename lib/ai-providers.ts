import OpenAI from 'openai'

// Conditional import for Anthropic SDK
let Anthropic: any
try {
  const anthropicModule = require('@anthropic-ai/sdk')
  Anthropic = anthropicModule.Anthropic
} catch (error) {
  // Anthropic SDK not available
  Anthropic = null
}

export interface AIProvider {
  id: string
  name: string
  description: string
  models: AIModel[]
  pricing: {
    inputTokens: number // per 1K tokens
    outputTokens: number // per 1K tokens
  }
  limits: {
    maxTokens: number
    rateLimit: number // requests per minute
  }
  features: string[]
  status: 'active' | 'inactive' | 'error'
}

export interface AIModel {
  id: string
  name: string
  description: string
  maxTokens: number
  contextWindow: number
  bestFor: string[]
}

export const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'Advanced language models from OpenAI',
    models: [
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo',
        description: 'Most capable model, best for complex personalization',
        maxTokens: 4096,
        contextWindow: 128000,
        bestFor: ['complex reasoning', 'creative writing', 'detailed personalization']
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'High-quality model for most personalization tasks',
        maxTokens: 4096,
        contextWindow: 8192,
        bestFor: ['general personalization', 'reasoning', 'writing']
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective for simple personalization',
        maxTokens: 4096,
        contextWindow: 16385,
        bestFor: ['simple personalization', 'quick responses', 'cost efficiency']
      }
    ],
    pricing: {
      inputTokens: 0.01, // $0.01 per 1K tokens (GPT-4)
      outputTokens: 0.03
    },
    limits: {
      maxTokens: 4096,
      rateLimit: 60
    },
    features: ['chat', 'completion', 'function-calling', 'json-mode'],
    status: 'inactive'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Constitutional AI with strong safety features',
    models: [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex personalization',
        maxTokens: 4096,
        contextWindow: 200000,
        bestFor: ['complex analysis', 'creative tasks', 'detailed personalization']
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed',
        maxTokens: 4096,
        contextWindow: 200000,
        bestFor: ['general personalization', 'balanced performance']
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest model for simple personalization',
        maxTokens: 4096,
        contextWindow: 200000,
        bestFor: ['simple personalization', 'speed', 'cost efficiency']
      }
    ],
    pricing: {
      inputTokens: 0.015,
      outputTokens: 0.075
    },
    limits: {
      maxTokens: 4096,
      rateLimit: 50
    },
    features: ['chat', 'analysis', 'safety', 'long-context'],
    status: 'inactive'
  }
}

export interface PersonalizationRequest {
  contactData: {
    first_name: string
    last_name: string
    company_name?: string
    job_title?: string
    industry?: string
    website?: string
    custom_fields?: Record<string, any>
  }
  templateContent: string
  customPrompt?: string
  variables?: Record<string, string>
  provider: 'openai' | 'anthropic'
}

export interface PersonalizationResult {
  personalizedContent: string
  tokensUsed: number
  confidence: number
  provider: string
  processingTime: number
}

export class AIPersonalizationService {
  private static clients: Map<string, any> = new Map()
  private static rateLimits: Map<string, { count: number; resetTime: number }> = new Map()
  private static initialized = false

  /**
   * Initialize AI provider clients
   */
  static async initialize() {
    if (this.initialized) return

    try {
      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })
        this.clients.set('openai', openai)
        AI_PROVIDERS.openai.status = 'active'
      }

      // Initialize Anthropic
      if (process.env.ANTHROPIC_API_KEY && Anthropic) {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        })
        this.clients.set('anthropic', anthropic)
        AI_PROVIDERS.anthropic.status = 'active'
      }

      this.initialized = true
      console.log(`Initialized ${this.clients.size} AI providers`)
    } catch (error) {
      console.error('Failed to initialize AI providers:', error)
      throw new Error('AI service initialization failed')
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): AIProvider[] {
    return Object.values(AI_PROVIDERS).filter(provider => 
      this.clients.has(provider.id) && provider.status === 'active'
    )
  }

  /**
   * Check rate limits for provider
   */
  private static async checkRateLimit(provider: string): Promise<void> {
    const now = Date.now()
    const limit = this.rateLimits.get(provider)
    const providerConfig = AI_PROVIDERS[provider]

    if (!limit) {
      this.rateLimits.set(provider, { count: 1, resetTime: now + 60000 })
      return
    }

    if (now > limit.resetTime) {
      // Reset the limit
      this.rateLimits.set(provider, { count: 1, resetTime: now + 60000 })
      return
    }

    if (limit.count >= providerConfig.limits.rateLimit) {
      const waitTime = Math.ceil((limit.resetTime - now) / 1000)
      throw new Error(`Rate limit exceeded for ${provider}. Try again in ${waitTime} seconds`)
    }

    limit.count++
  }

  constructor() {
    // Ensure initialization
    AIPersonalizationService.initialize()
  }

  async personalizeContent(request: PersonalizationRequest): Promise<PersonalizationResult> {
    const startTime = Date.now()
    
    try {
      switch (request.provider) {
        case 'openai':
          return await this.personalizeWithOpenAI(request, startTime)
        case 'anthropic':
          return await this.personalizeWithAnthropic(request, startTime)
        default:
          throw new Error(`Unsupported AI provider: ${request.provider}`)
      }
    } catch (error) {
      console.error('AI personalization error:', error)
      throw new Error(`AI personalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async personalizeWithOpenAI(request: PersonalizationRequest, startTime: number): Promise<PersonalizationResult> {
    const client = AIPersonalizationService.clients.get('openai') as OpenAI
    if (!client) {
      throw new Error('OpenAI client not initialized')
    }

    // Check rate limits
    await AIPersonalizationService.checkRateLimit('openai')

    const prompt = this.buildPersonalizationPrompt(request)
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email personalization assistant. Your job is to personalize email content based on contact information while maintaining the original tone and structure. Make the personalization natural and relevant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const personalizedContent = completion.choices[0]?.message?.content || request.templateContent
    const tokensUsed = completion.usage?.total_tokens || 0
    
    return {
      personalizedContent,
      tokensUsed,
      confidence: this.calculateConfidence(personalizedContent, request.templateContent),
      provider: 'openai',
      processingTime: Date.now() - startTime,
    }
  }

  private async personalizeWithAnthropic(request: PersonalizationRequest, startTime: number): Promise<PersonalizationResult> {
    const client = AIPersonalizationService.clients.get('anthropic') as Anthropic
    if (!client) {
      throw new Error('Anthropic client not initialized')
    }

    // Check rate limits
    await AIPersonalizationService.checkRateLimit('anthropic')

    const prompt = this.buildPersonalizationPrompt(request)
    
    const response = await client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      temperature: 0.7,
      system: 'You are an expert email personalization assistant. Your job is to personalize email content based on contact information while maintaining the original tone and structure. Make the personalization natural and relevant.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected content type from Anthropic')
    }

    const personalizedContent = content.text || request.templateContent
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens
    
    return {
      personalizedContent,
      tokensUsed,
      confidence: this.calculateConfidence(personalizedContent, request.templateContent),
      provider: 'anthropic',
      processingTime: Date.now() - startTime,
    }
  }

  private buildPersonalizationPrompt(request: PersonalizationRequest): string {
    const { contactData, templateContent, customPrompt, variables } = request
    
    let prompt = `Please personalize the following email template for this contact:

CONTACT INFORMATION:
- Name: ${contactData.first_name} ${contactData.last_name}
- Company: ${contactData.company_name || 'Unknown'}
- Job Title: ${contactData.job_title || 'Unknown'}
- Industry: ${contactData.industry || 'Unknown'}
- Website: ${contactData.website || 'Unknown'}
`

    if (contactData.custom_fields && Object.keys(contactData.custom_fields).length > 0) {
      prompt += '\nADDITIONAL INFO:\n'
      Object.entries(contactData.custom_fields).forEach(([key, value]) => {
        prompt += `- ${key}: ${value}\n`
      })
    }

    if (variables && Object.keys(variables).length > 0) {
      prompt += '\nVARIABLES TO USE:\n'
      Object.entries(variables).forEach(([key, value]) => {
        prompt += `- {{${key}}}: ${value}\n`
      })
    }

    prompt += `\nEMAIL TEMPLATE TO PERSONALIZE:
${templateContent}

PERSONALIZATION INSTRUCTIONS:
${customPrompt || `
- Replace generic placeholders with specific contact information
- Add relevant details about their company or industry when appropriate
- Make the opening more personal and engaging
- Ensure the personalization feels natural and not forced
- Maintain the original email structure and call-to-action
- Keep the same tone and style as the original
`}

Please return only the personalized email content without any additional commentary.`

    return prompt
  }

  private simulatePersonalization(request: PersonalizationRequest): string {
    let content = request.templateContent
    const { contactData } = request
    
    // Simple placeholder replacement for demo
    content = content.replace(/\{\{first_name\}\}/g, contactData.first_name)
    content = content.replace(/\{\{last_name\}\}/g, contactData.last_name)
    content = content.replace(/\{\{company_name\}\}/g, contactData.company_name || 'your company')
    content = content.replace(/\{\{job_title\}\}/g, contactData.job_title || 'your role')
    
    // Add some basic personalization
    if (contactData.company_name) {
      content = content.replace(
        /Hi there,/g, 
        `Hi ${contactData.first_name}, I noticed ${contactData.company_name} is doing great work in ${contactData.industry || 'your industry'}.`
      )
    }
    
    return content
  }

  private calculateConfidence(personalizedContent: string, originalContent: string): number {
    // Simple confidence calculation based on content changes
    const originalLength = originalContent.length
    const personalizedLength = personalizedContent.length
    const lengthDiff = Math.abs(personalizedLength - originalLength)
    
    // More changes generally indicate better personalization
    const changeRatio = lengthDiff / originalLength
    const confidence = Math.min(0.95, 0.6 + (changeRatio * 0.35))
    
    return Math.round(confidence * 100) / 100
  }

  async bulkPersonalize(
    requests: PersonalizationRequest[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<PersonalizationResult[]> {
    const results: PersonalizationResult[] = []
    const batchSize = 5 // Process in batches to avoid rate limits
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)
      
      const batchPromises = batch.map(request => 
        this.personalizeContent(request).catch(error => ({
          personalizedContent: request.templateContent,
          tokensUsed: 0,
          confidence: 0,
          provider: request.provider,
          processingTime: 0,
          error: error.message,
        }))
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      if (onProgress) {
        onProgress(results.length, requests.length)
      }
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }

  static async validateApiKeys(): Promise<{ openai: boolean; anthropic: boolean }> {
    const results = { openai: false, anthropic: false }
    
    // Test OpenAI
    const openaiClient = this.clients.get('openai') as OpenAI
    if (openaiClient) {
      try {
        await openaiClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5,
        })
        results.openai = true
      } catch (error) {
        console.error('OpenAI API key validation failed:', error)
        AI_PROVIDERS.openai.status = 'error'
      }
    }
    
    // Test Anthropic
    const anthropicClient = this.clients.get('anthropic') as Anthropic
    if (anthropicClient) {
      try {
        await anthropicClient.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Test' }]
        })
        results.anthropic = true
      } catch (error) {
        console.error('Anthropic API key validation failed:', error)
        AI_PROVIDERS.anthropic.status = 'error'
      }
    }
    
    return results
  }

  static getUsageEstimate(contentLength: number, contactCount: number, provider: 'openai' | 'anthropic'): {
    estimatedTokens: number
    estimatedCost: number
  } {
    const providerInfo = AI_PROVIDERS[provider]
    if (!providerInfo) {
      return { estimatedTokens: 0, estimatedCost: 0 }
    }
    
    // Rough estimation: input tokens + output tokens
    const inputTokensPerContact = Math.ceil(contentLength / 4) + 200 // Content + contact info
    const outputTokensPerContact = Math.ceil(contentLength / 4) + 100 // Personalized content
    
    const estimatedInputTokens = inputTokensPerContact * contactCount
    const estimatedOutputTokens = outputTokensPerContact * contactCount
    const estimatedTokens = estimatedInputTokens + estimatedOutputTokens
    
    const inputCost = (estimatedInputTokens / 1000) * providerInfo.pricing.inputTokens
    const outputCost = (estimatedOutputTokens / 1000) * providerInfo.pricing.outputTokens
    const estimatedCost = inputCost + outputCost
    
    return {
      estimatedTokens,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
    }
  }

  /**
   * Get provider by ID
   */
  static getProvider(providerId: string): AIProvider | null {
    return AI_PROVIDERS[providerId] || null
  }

  /**
   * Get models for provider
   */
  static getModelsForProvider(providerId: string): AIModel[] {
    const provider = AI_PROVIDERS[providerId]
    return provider ? provider.models : []
  }

  /**
   * Test provider connection
   */
  static async testProvider(provider: string): Promise<{ success: boolean; error?: string }> {
    try {
      const testRequest: PersonalizationRequest = {
        contactData: {
          first_name: 'John',
          last_name: 'Doe',
          company_name: 'Test Company',
          job_title: 'Manager',
          industry: 'Technology'
        },
        templateContent: 'Hello {{first_name}}, this is a test message.',
        provider: provider as 'openai' | 'anthropic'
      }

      const service = new AIPersonalizationService()
      const response = await service.personalizeContent(testRequest)
      
      return {
        success: response.personalizedContent.length > 0,
        error: response.personalizedContent.length === 0 ? 'Empty response' : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Clear rate limits (for testing)
   */
  static clearRateLimits(): void {
    this.rateLimits.clear()
  }
}