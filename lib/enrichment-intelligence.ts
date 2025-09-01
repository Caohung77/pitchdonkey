import { ContactEnrichmentService } from './contact-enrichment'

interface EnrichmentData {
  company_name: string
  industry: string
  products_services: string[]
  target_audience: string[]
  unique_points: string[]
  tone_style: string
}

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  company: string | null
  position: string | null
  email: string
  website: string | null
  enrichment_data: EnrichmentData | null
  enrichment_status: string | null
}

interface PersonalizationContext {
  contact: Contact
  enrichmentLevel: 'none' | 'basic' | 'enriched' | 'premium'
  personalizationScore: number // 0-100
  availableInsights: {
    hasCompanyName: boolean
    hasIndustry: boolean
    hasProducts: boolean
    hasTargetAudience: boolean
    hasUniquePoints: boolean
    hasToneStyle: boolean
    hasPosition: boolean
  }
  aiContext: {
    companyContext: string
    industryInsights: string
    personalizationHints: string
    toneGuidance: string
    valuePropositionHints: string
  }
}

export class EnrichmentIntelligenceService {
  private enrichmentService: ContactEnrichmentService

  constructor() {
    this.enrichmentService = new ContactEnrichmentService()
  }

  /**
   * Build comprehensive personalization context for AI generation
   */
  async buildPersonalizationContext(contactId: string, userId: string): Promise<PersonalizationContext> {
    try {
      // Get contact data with enrichment
      const contact = await this.getContactWithEnrichment(contactId, userId)
      
      if (!contact) {
        throw new Error('Contact not found or access denied')
      }

      // Determine enrichment level and available insights
      const availableInsights = this.analyzeAvailableInsights(contact)
      const enrichmentLevel = this.determineEnrichmentLevel(contact, availableInsights)
      const personalizationScore = this.calculatePersonalizationScore(availableInsights)
      
      // Build AI context based on available data
      const aiContext = this.buildAIContext(contact, availableInsights)

      return {
        contact,
        enrichmentLevel,
        personalizationScore,
        availableInsights,
        aiContext
      }

    } catch (error) {
      console.error('❌ Error building personalization context:', error)
      
      // Return basic context for fallback
      return this.createFallbackContext(contactId, userId)
    }
  }

  /**
   * Get contact with enrichment data
   */
  private async getContactWithEnrichment(contactId: string, userId: string): Promise<Contact | null> {
    try {
      const { createServerSupabaseClient } = await import('./supabase-server')
      const supabase = await createServerSupabaseClient()

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          first_name,
          last_name,
          company,
          position,
          email,
          website,
          enrichment_data,
          enrichment_status
        `)
        .eq('id', contactId)
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        console.error('❌ Failed to fetch contact:', error)
        return null
      }

      return data as Contact
    } catch (error) {
      console.error('❌ Error fetching contact with enrichment:', error)
      return null
    }
  }

  /**
   * Analyze what insights are available for personalization
   */
  private analyzeAvailableInsights(contact: Contact): PersonalizationContext['availableInsights'] {
    const enrichment = contact.enrichment_data
    
    return {
      hasCompanyName: !!(contact.company || enrichment?.company_name),
      hasIndustry: !!(enrichment?.industry),
      hasProducts: !!(enrichment?.products_services && enrichment.products_services.length > 0),
      hasTargetAudience: !!(enrichment?.target_audience && enrichment.target_audience.length > 0),
      hasUniquePoints: !!(enrichment?.unique_points && enrichment.unique_points.length > 0),
      hasToneStyle: !!(enrichment?.tone_style),
      hasPosition: !!(contact.position)
    }
  }

  /**
   * Determine enrichment level based on available data
   */
  private determineEnrichmentLevel(
    contact: Contact, 
    insights: PersonalizationContext['availableInsights']
  ): PersonalizationContext['enrichmentLevel'] {
    const basicFields = [insights.hasCompanyName, contact.first_name, contact.last_name].filter(Boolean).length
    const enrichedFields = [
      insights.hasIndustry, 
      insights.hasProducts, 
      insights.hasToneStyle
    ].filter(Boolean).length
    const premiumFields = [
      insights.hasTargetAudience, 
      insights.hasUniquePoints, 
      insights.hasPosition
    ].filter(Boolean).length

    if (premiumFields >= 2 && enrichedFields >= 2) return 'premium'
    if (enrichedFields >= 2) return 'enriched'
    if (basicFields >= 2) return 'basic'
    return 'none'
  }

  /**
   * Calculate personalization score (0-100)
   */
  private calculatePersonalizationScore(insights: PersonalizationContext['availableInsights']): number {
    const weights = {
      hasCompanyName: 15,
      hasIndustry: 15,
      hasProducts: 20,
      hasTargetAudience: 20,
      hasUniquePoints: 15,
      hasToneStyle: 10,
      hasPosition: 5
    }

    let score = 0
    for (const [key, weight] of Object.entries(weights)) {
      if (insights[key as keyof typeof insights]) {
        score += weight
      }
    }

    return Math.min(score, 100)
  }

  /**
   * Build AI context strings for prompt generation
   */
  private buildAIContext(
    contact: Contact, 
    insights: PersonalizationContext['availableInsights']
  ): PersonalizationContext['aiContext'] {
    const enrichment = contact.enrichment_data
    
    // Company context
    let companyContext = ''
    const companyName = contact.company || enrichment?.company_name
    if (companyName) {
      companyContext += `Company: ${companyName}\n`
      if (insights.hasIndustry) {
        companyContext += `Industry: ${enrichment?.industry}\n`
      }
      if (contact.website) {
        companyContext += `Website: ${contact.website}\n`
      }
    }

    // Industry insights
    let industryInsights = ''
    if (insights.hasIndustry && enrichment?.industry) {
      industryInsights = `This is a ${enrichment.industry} company.`
      if (insights.hasProducts) {
        industryInsights += ` Their products/services include: ${enrichment?.products_services?.join(', ')}.`
      }
    }

    // Personalization hints
    let personalizationHints = ''
    if (insights.hasTargetAudience) {
      personalizationHints += `Their target audience: ${enrichment?.target_audience?.join(', ')}. `
    }
    if (insights.hasUniquePoints) {
      personalizationHints += `Key differentiators: ${enrichment?.unique_points?.join(', ')}. `
    }
    if (contact.position) {
      personalizationHints += `Contact position: ${contact.position}. `
    }

    // Tone guidance
    let toneGuidance = 'professional and respectful'
    if (insights.hasToneStyle && enrichment?.tone_style) {
      toneGuidance = enrichment.tone_style
    }

    // Value proposition hints
    let valuePropositionHints = ''
    if (insights.hasProducts && enrichment?.products_services) {
      valuePropositionHints = `Consider how your solution might complement or enhance their ${enrichment.products_services.join(' and ')} offerings.`
    }

    return {
      companyContext: companyContext.trim(),
      industryInsights: industryInsights.trim(),
      personalizationHints: personalizationHints.trim(),
      toneGuidance,
      valuePropositionHints: valuePropositionHints.trim()
    }
  }

  /**
   * Create fallback context when enrichment fails
   */
  private async createFallbackContext(contactId: string, userId: string): Promise<PersonalizationContext> {
    const contact = await this.getBasicContactInfo(contactId, userId)
    
    const fallbackInsights = {
      hasCompanyName: !!(contact?.company),
      hasIndustry: false,
      hasProducts: false,
      hasTargetAudience: false,
      hasUniquePoints: false,
      hasToneStyle: false,
      hasPosition: !!(contact?.position)
    }

    return {
      contact: contact || this.createEmptyContact(contactId),
      enrichmentLevel: 'basic',
      personalizationScore: 20,
      availableInsights: fallbackInsights,
      aiContext: {
        companyContext: contact?.company ? `Company: ${contact.company}` : '',
        industryInsights: '',
        personalizationHints: contact?.position ? `Contact position: ${contact.position}` : '',
        toneGuidance: 'professional and respectful',
        valuePropositionHints: ''
      }
    }
  }

  /**
   * Get basic contact info for fallback
   */
  private async getBasicContactInfo(contactId: string, userId: string): Promise<Partial<Contact> | null> {
    try {
      const { createServerSupabaseClient } = await import('./supabase-server')
      const supabase = await createServerSupabaseClient()

      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, company, position, email')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  }

  /**
   * Create empty contact for extreme fallback
   */
  private createEmptyContact(contactId: string): Contact {
    return {
      id: contactId,
      first_name: null,
      last_name: null,
      company: null,
      position: null,
      email: '',
      website: null,
      enrichment_data: null,
      enrichment_status: null
    }
  }

  /**
   * Format enrichment context for AI prompt
   */
  formatForAIPrompt(context: PersonalizationContext): string {
    const { contact, aiContext, enrichmentLevel } = context
    
    let prompt = '\n\n=== PERSONALIZATION CONTEXT ===\n'
    prompt += `Enrichment Level: ${enrichmentLevel.toUpperCase()}\n`
    prompt += `Personalization Score: ${context.personalizationScore}%\n\n`

    if (contact.first_name) {
      prompt += `Contact Name: ${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}\n`
    }

    if (aiContext.companyContext) {
      prompt += `${aiContext.companyContext}\n`
    }

    if (aiContext.industryInsights) {
      prompt += `\nIndustry Context: ${aiContext.industryInsights}\n`
    }

    if (aiContext.personalizationHints) {
      prompt += `\nPersonalization Hints: ${aiContext.personalizationHints}\n`
    }

    if (aiContext.valuePropositionHints) {
      prompt += `\nValue Proposition Guidance: ${aiContext.valuePropositionHints}\n`
    }

    prompt += `\nTone Guidance: Use a ${aiContext.toneGuidance} tone.\n`

    prompt += '\n=== PERSONALIZATION INSTRUCTIONS ===\n'
    
    switch (enrichmentLevel) {
      case 'premium':
        prompt += '- Use specific company insights and unique differentiators\n'
        prompt += '- Reference their target audience and industry position\n'
        prompt += '- Demonstrate deep understanding of their business\n'
        prompt += '- Use advanced personalization variables\n'
        break
      case 'enriched':
        prompt += '- Reference their industry and products/services\n'
        prompt += '- Mention relevant business context\n'
        prompt += '- Use moderate personalization\n'
        break
      case 'basic':
        prompt += '- Use available contact name and company information\n'
        prompt += '- Keep personalization simple but professional\n'
        break
      default:
        prompt += '- Use generic but professional approach\n'
        prompt += '- Focus on clear value proposition\n'
    }

    return prompt
  }
}