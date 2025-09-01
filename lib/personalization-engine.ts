import { EnrichmentIntelligenceService } from './enrichment-intelligence'

interface PersonalizationConfig {
  purpose: string
  language: 'English' | 'German'
  signature: string
  tone?: 'professional' | 'casual' | 'warm' | 'direct'
  length?: 'short' | 'medium' | 'long'
}

interface EnhancedPromptResult {
  enhancedPrompt: string
  personalizationLevel: 'none' | 'basic' | 'enriched' | 'premium'
  personalizationScore: number
  usedInsights: string[]
  fallbackPrompt: string
}

export class PersonalizationEngine {
  private enrichmentService: EnrichmentIntelligenceService

  constructor() {
    this.enrichmentService = new EnrichmentIntelligenceService()
  }

  /**
   * Generate enhanced AI prompt with intelligent personalization
   */
  async generateEnhancedPrompt(
    config: PersonalizationConfig,
    contactId?: string,
    userId?: string
  ): Promise<EnhancedPromptResult> {
    
    // Get base prompt
    const basePrompt = this.buildBasePrompt(config)
    
    if (!contactId || !userId) {
      return {
        enhancedPrompt: basePrompt,
        personalizationLevel: 'none',
        personalizationScore: 0,
        usedInsights: [],
        fallbackPrompt: basePrompt
      }
    }

    try {
      // Build personalization context
      const context = await this.enrichmentService.buildPersonalizationContext(contactId, userId)
      
      // Generate enhanced prompt based on enrichment level
      const enhancedPrompt = this.buildEnrichedPrompt(basePrompt, context, config)
      
      // Track used insights
      const usedInsights = this.extractUsedInsights(context)

      return {
        enhancedPrompt,
        personalizationLevel: context.enrichmentLevel,
        personalizationScore: context.personalizationScore,
        usedInsights,
        fallbackPrompt: basePrompt
      }

    } catch (error) {
      console.error('❌ Error generating enhanced prompt:', error)
      
      // Return base prompt as fallback
      return {
        enhancedPrompt: basePrompt,
        personalizationLevel: 'none',
        personalizationScore: 0,
        usedInsights: [],
        fallbackPrompt: basePrompt
      }
    }
  }

  /**
   * Build the base AI prompt without personalization
   */
  private buildBasePrompt(config: PersonalizationConfig): string {
    const lengthGuidance = this.getLengthGuidance(config.length)
    const toneGuidance = config.tone || 'professional'

    return `You are an expert outreach email copywriter specializing in ${config.language} communications.

Your mission is to create a ${toneGuidance}, ${lengthGuidance} outreach email that generates responses.

CORE REQUIREMENTS:
1. Subject Line: Create a compelling, non-spammy subject that includes personalization variables when appropriate
2. Opening: Use a personalized greeting with {{first_name}} and reference {{company}} naturally
3. Value Focus: Clearly articulate the benefit to the recipient within the first 2 sentences
4. Length: Keep it ${lengthGuidance} (${this.getWordCount(config.length)} words)
5. Call-to-Action: Include ONE clear, specific CTA
6. Tone: Maintain a ${toneGuidance} but warm approach
7. Signature: Include the provided signature with proper HTML formatting
8. HTML Format: Output clean, personal email HTML (NOT newsletter style)
9. Font: Use Arial or web-safe fonts with max-width: 600px

PURPOSE: ${config.purpose}
LANGUAGE: ${config.language}
SIGNATURE: ${config.signature}

Return ONLY a JSON object with this exact structure:
{
  "subject": "Your subject line with {{first_name}} and {{company}} variables if natural",
  "htmlContent": "Complete HTML email including signature with proper line breaks"
}

The email should feel personal, not automated. Focus on building genuine connection.`
  }

  /**
   * Build enriched prompt with personalization context
   */
  private buildEnrichedPrompt(
    basePrompt: string,
    context: any,
    config: PersonalizationConfig
  ): string {
    const personalizationContext = this.enrichmentService.formatForAIPrompt(context)
    
    // Enhanced instructions based on enrichment level
    const enhancedInstructions = this.buildEnhancedInstructions(context.enrichmentLevel, context)
    
    return `${basePrompt}

${personalizationContext}

${enhancedInstructions}

ENHANCED PERSONALIZATION REQUIREMENTS:
${this.buildPersonalizationRequirements(context)}

Remember: Use the enrichment data to demonstrate genuine research and understanding, not just to fill templates.`
  }

  /**
   * Build enhanced instructions based on enrichment level
   */
  private buildEnhancedInstructions(level: string, context: any): string {
    switch (level) {
      case 'premium':
        return `=== PREMIUM PERSONALIZATION MODE ===
You have access to rich company insights. Use this data to:

1. SUBJECT LINE: Reference specific company attributes or recent developments
2. OPENING: Mention something specific about their industry position or unique approach
3. BODY: Connect your solution to their specific target audience or business model
4. VALUE PROP: Align your offering with their documented unique points and differentiators
5. TONE: Match their company's communication style (${context.aiContext.toneGuidance})

DEMONSTRATE RESEARCH: Show you understand their business beyond just the company name.`

      case 'enriched':
        return `=== ENRICHED PERSONALIZATION MODE ===
You have company industry and product insights. Use this to:

1. SUBJECT LINE: Include industry-relevant terminology
2. OPENING: Reference their sector or business focus
3. BODY: Connect your solution to their industry challenges
4. VALUE PROP: Explain benefits in context of their products/services
5. TONE: Professional tone aligned with industry standards

SHOW UNDERSTANDING: Demonstrate you know their business context.`

      case 'basic':
        return `=== BASIC PERSONALIZATION MODE ===
You have basic contact information. Use this to:

1. SUBJECT LINE: Use {{first_name}} and {{company}} naturally
2. OPENING: Professional greeting with proper personalization
3. BODY: Generic but relevant value proposition
4. TONE: Professional and respectful approach

KEEP IT SIMPLE: Focus on clear value and professional presentation.`

      default:
        return `=== STANDARD MODE ===
Limited personalization data available. Focus on:

1. Clear value proposition
2. Professional tone
3. Generic but compelling messaging
4. Strong call-to-action`
    }
  }

  /**
   * Build personalization requirements based on context
   */
  private buildPersonalizationRequirements(context: any): string {
    let requirements = []
    
    if (context.availableInsights.hasCompanyName) {
      requirements.push('- Use the company name naturally in context, not just as {{company}}')
    }
    
    if (context.availableInsights.hasIndustry) {
      requirements.push('- Reference industry challenges or opportunities relevant to their sector')
    }
    
    if (context.availableInsights.hasProducts) {
      requirements.push('- Mention how your solution complements or enhances their existing offerings')
    }
    
    if (context.availableInsights.hasTargetAudience) {
      requirements.push('- Reference their target market or customer base when relevant')
    }
    
    if (context.availableInsights.hasUniquePoints) {
      requirements.push('- Acknowledge their unique position or differentiators in the market')
    }
    
    if (context.availableInsights.hasPosition) {
      requirements.push('- Address the recipient by their role/position when appropriate')
    }

    return requirements.length > 0 ? requirements.join('\n') : '- Focus on clear, professional communication'
  }

  /**
   * Extract insights that were used in personalization
   */
  private extractUsedInsights(context: any): string[] {
    const insights = []
    
    if (context.availableInsights.hasCompanyName) insights.push('Company Name')
    if (context.availableInsights.hasIndustry) insights.push('Industry')
    if (context.availableInsights.hasProducts) insights.push('Products/Services')
    if (context.availableInsights.hasTargetAudience) insights.push('Target Audience')
    if (context.availableInsights.hasUniquePoints) insights.push('Unique Differentiators')
    if (context.availableInsights.hasToneStyle) insights.push('Company Tone')
    if (context.availableInsights.hasPosition) insights.push('Contact Position')
    
    return insights
  }

  /**
   * Get length guidance text
   */
  private getLengthGuidance(length?: string): string {
    switch (length) {
      case 'short': return 'concise'
      case 'long': return 'comprehensive'
      default: return 'moderate-length'
    }
  }

  /**
   * Get word count guidance
   */
  private getWordCount(length?: string): string {
    switch (length) {
      case 'short': return '75-120'
      case 'long': return '150-200'
      default: return '100-150'
    }
  }

  /**
   * Generate multiple personalized versions
   */
  async generateMultipleVersions(
    config: PersonalizationConfig,
    contactId?: string,
    userId?: string,
    versions: number = 3
  ): Promise<{
    prompts: EnhancedPromptResult[]
    bestVersion: EnhancedPromptResult
  }> {
    const prompts: EnhancedPromptResult[] = []
    
    // Generate base version
    const baseVersion = await this.generateEnhancedPrompt(config, contactId, userId)
    prompts.push(baseVersion)
    
    // Generate variations if we have good enrichment data
    if (baseVersion.personalizationLevel !== 'none' && versions > 1) {
      // Create variations with different approaches
      const variations = [
        { ...config, tone: 'warm' as const },
        { ...config, tone: 'direct' as const },
        { ...config, length: 'short' as const }
      ]
      
      for (let i = 1; i < versions && i < variations.length + 1; i++) {
        const variation = await this.generateEnhancedPrompt(variations[i - 1], contactId, userId)
        prompts.push(variation)
      }
    }
    
    // Select best version based on personalization score
    const bestVersion = prompts.reduce((best, current) => 
      current.personalizationScore > best.personalizationScore ? current : best
    )
    
    return { prompts, bestVersion }
  }

  /**
   * Validate generated content quality
   */
  validatePersonalization(
    generatedContent: { subject: string; htmlContent: string },
    context: any
  ): {
    score: number
    feedback: string[]
    improvements: string[]
  } {
    const feedback: string[] = []
    const improvements: string[] = []
    let score = 50 // Base score
    
    // Check for personalization variables usage
    if (generatedContent.subject.includes('{{first_name}}')) {
      score += 10
      feedback.push('✅ Uses first name personalization')
    } else if (context.contact.first_name) {
      improvements.push('Consider using {{first_name}} in subject line')
    }
    
    if (generatedContent.subject.includes('{{company}}') || 
        generatedContent.htmlContent.includes('{{company}}')) {
      score += 10
      feedback.push('✅ Uses company personalization')
    }
    
    // Check for enrichment data usage
    if (context.availableInsights.hasIndustry && 
        generatedContent.htmlContent.toLowerCase().includes(context.contact.enrichment_data?.industry?.toLowerCase())) {
      score += 15
      feedback.push('✅ References industry context')
    }
    
    if (context.availableInsights.hasProducts && 
        context.contact.enrichment_data?.products_services?.some((product: string) => 
          generatedContent.htmlContent.toLowerCase().includes(product.toLowerCase())
        )) {
      score += 15
      feedback.push('✅ Mentions specific products/services')
    }
    
    // Check for professional tone
    const professionalWords = ['professional', 'solution', 'benefit', 'opportunity', 'value']
    const containsProfessionalLanguage = professionalWords.some(word => 
      generatedContent.htmlContent.toLowerCase().includes(word)
    )
    
    if (containsProfessionalLanguage) {
      score += 10
      feedback.push('✅ Uses professional language')
    }
    
    return { score: Math.min(score, 100), feedback, improvements }
  }
}