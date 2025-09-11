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

FOLLOW THE 4-PART EMAIL STRUCTURE:

**1. PERSONAL REASON (Why This Person?)**
Start with a specific reason for contacting them. Examples:
- Reference their LinkedIn headline, recent post, or company news
- Mention their role/expertise in their industry
- Connect to their company's specific challenges or growth

**2. VALUE PROPOSITION (What You Offer)**
Clearly state what you do and the specific benefit. Include:
- Concrete results/metrics when possible
- How it specifically helps their type of business
- Brief social proof (number of similar clients helped)

**3. SIMPLE NEXT STEP (Clear CTA)**
One clear, low-friction call-to-action:
- 15-minute call/consultation
- Free audit/assessment
- Simple yes/no question
- Demo/trial offer

**4. PROOF (Handle Objections)**
End with credibility through:
- Specific client results
- Industry experience
- Similar company success stories

TECHNICAL REQUIREMENTS:
- Subject Line: 6 words or less, curious and personalized
- Length: Keep it ${lengthGuidance} (${this.getWordCount(config.length)} words)
- Tone: ${toneGuidance} but conversational and human
- HTML Format: Clean, personal email style (NOT newsletter format)
- Font: Arial or web-safe fonts with max-width: 600px

PLACEHOLDER POLICY (NO REAL DATA):
- When no contact info is provided, you MUST use placeholders instead of real names or companies.
- Allowed placeholders: {{first_name}}, {{last_name}}, {{company}}, {{company_name}}, {{website}}, {{email}}, {{sender_name}}
- Use at least {{first_name}} in the opening and {{company}} (or {{company_name}}) somewhere in the body.
- Use {{website}} only when naturally relevant (e.g., referencing their site).
- Do NOT invent or hallucinate specific personal or company details.

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

4-PART STRUCTURE WITH YOUR DATA:
1. PERSONAL REASON: ${context.aiContext.personalReasonHints}
2. VALUE PROPOSITION: ${context.aiContext.valuePropositionHints}
3. SIMPLE CTA: Use the purpose to create a relevant, low-friction ask
4. PROOF: ${context.aiContext.proofPoints}

Remember: Use both company enrichment data AND LinkedIn information to create authentic, well-researched emails that follow the 4-part structure.`
  }

  /**
   * Build enhanced instructions based on enrichment level
   */
  private buildEnhancedInstructions(level: string, context: any): string {
    switch (level) {
      case 'premium':
        return `=== PREMIUM PERSONALIZATION MODE ===
You have access to rich company insights AND LinkedIn data. Use this data to:

1. PERSONAL REASON: Reference their LinkedIn headline, recent experience, or specific company insights
2. VALUE PROPOSITION: Connect your solution to their documented unique points, target audience, and business model
3. SIMPLE CTA: Tailor the ask to their role and company type
4. PROOF: Use industry-specific examples and results from similar companies

LINKEDIN DATA AVAILABLE: ${context.aiContext.linkedinPersonalization}
COMPANY INSIGHTS: Use their industry position, unique differentiators, and target audience
TONE: Match their company's communication style (${context.aiContext.toneGuidance})

DEMONSTRATE RESEARCH: Show you understand both their personal background and business context.`

      case 'enriched':
        return `=== ENRICHED PERSONALIZATION MODE ===
You have company industry insights and/or LinkedIn data. Use this to:

1. PERSONAL REASON: Reference their industry role, LinkedIn headline, or company's sector
2. VALUE PROPOSITION: Connect your solution to their industry challenges and business context
3. SIMPLE CTA: Professional ask appropriate for their industry and role
4. PROOF: Industry-specific examples and relevant case studies

AVAILABLE DATA: ${context.aiContext.linkedinPersonalization || 'Company industry and business context'}
TONE: Professional tone aligned with industry standards

SHOW UNDERSTANDING: Demonstrate you know their business and professional context.`

      case 'basic':
        return `=== BASIC PERSONALIZATION MODE ===
You have basic contact information and possibly some LinkedIn data. Use this to:

1. PERSONAL REASON: Reference their role, company, or any available LinkedIn information
2. VALUE PROPOSITION: Clear, relevant benefit statement with generic but compelling value
3. SIMPLE CTA: Straightforward, professional ask (call, demo, consultation)
4. PROOF: General industry experience or client count

AVAILABLE DATA: ${context.aiContext.linkedinPersonalization || 'Basic contact and company information'}
TONE: Professional and respectful approach

KEEP IT SIMPLE: Focus on clear value and professional presentation using the 4-part structure.`

      default:
        return `=== STANDARD MODE ===
Limited personalization data available. Follow the 4-part structure:

1. PERSONAL REASON: Use basic company/role information or generic industry reference
2. VALUE PROPOSITION: Clear, compelling benefit statement
3. SIMPLE CTA: Professional, low-friction ask
4. PROOF: General credibility statement

TONE: Professional and respectful`
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
    
    if (context.availableInsights.hasLinkedInHeadline) {
      requirements.push('- Reference their LinkedIn headline or professional focus in the personal reason')
    }
    
    if (context.availableInsights.hasLinkedInAbout) {
      requirements.push('- Use insights from their LinkedIn summary to create a personal connection')
    }
    
    if (context.availableInsights.hasLinkedInExperience) {
      requirements.push('- Reference their professional background or recent career moves when relevant')
    }

    return requirements.length > 0 ? requirements.join('\n') : '- Focus on clear, professional communication using the 4-part structure'
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
    if (context.availableInsights.hasLinkedInHeadline) insights.push('LinkedIn Headline')
    if (context.availableInsights.hasLinkedInAbout) insights.push('LinkedIn Summary')
    if (context.availableInsights.hasLinkedInExperience) insights.push('LinkedIn Experience')
    if (context.availableInsights.hasLinkedInEducation) insights.push('LinkedIn Education')
    if (context.availableInsights.hasLinkedInSkills) insights.push('LinkedIn Skills')
    
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