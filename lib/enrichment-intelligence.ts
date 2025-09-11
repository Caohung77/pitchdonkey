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
  // LinkedIn fields
  linkedin_headline: string | null
  linkedin_about: string | null
  linkedin_summary: string | null
  linkedin_current_company: string | null
  linkedin_current_position: string | null
  linkedin_industry: string | null
  linkedin_location: string | null
  linkedin_experience: any[] | null
  linkedin_education: any[] | null
  linkedin_skills: string[] | null
  linkedin_profile_data: any | null
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
    hasLinkedInProfile: boolean
    hasLinkedInHeadline: boolean
    hasLinkedInAbout: boolean
    hasLinkedInExperience: boolean
    hasLinkedInEducation: boolean
    hasLinkedInSkills: boolean
  }
  aiContext: {
    companyContext: string
    industryInsights: string
    personalizationHints: string
    toneGuidance: string
    valuePropositionHints: string
    linkedinPersonalization: string
    personalReasonHints: string
    proofPoints: string
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
          enrichment_status,
          linkedin_headline,
          linkedin_about,
          linkedin_summary,
          linkedin_current_company,
          linkedin_current_position,
          linkedin_industry,
          linkedin_location,
          linkedin_experience,
          linkedin_education,
          linkedin_skills,
          linkedin_profile_data
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
      hasCompanyName: !!(contact.company || enrichment?.company_name || contact.linkedin_current_company),
      hasIndustry: !!(enrichment?.industry || contact.linkedin_industry),
      hasProducts: !!(enrichment?.products_services && enrichment.products_services.length > 0),
      hasTargetAudience: !!(enrichment?.target_audience && enrichment.target_audience.length > 0),
      hasUniquePoints: !!(enrichment?.unique_points && enrichment.unique_points.length > 0),
      hasToneStyle: !!(enrichment?.tone_style),
      hasPosition: !!(contact.position || contact.linkedin_current_position),
      hasLinkedInProfile: !!(contact.linkedin_headline || contact.linkedin_about || contact.linkedin_profile_data),
      hasLinkedInHeadline: !!(contact.linkedin_headline),
      hasLinkedInAbout: !!(contact.linkedin_about || contact.linkedin_summary),
      hasLinkedInExperience: !!(contact.linkedin_experience && contact.linkedin_experience.length > 0),
      hasLinkedInEducation: !!(contact.linkedin_education && contact.linkedin_education.length > 0),
      hasLinkedInSkills: !!(contact.linkedin_skills && contact.linkedin_skills.length > 0)
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
    
    // Company context (combine web enrichment and LinkedIn data)
    let companyContext = ''
    const companyName = contact.company || enrichment?.company_name || contact.linkedin_current_company
    if (companyName) {
      companyContext += `Company: ${companyName}\n`
      const industry = enrichment?.industry || contact.linkedin_industry
      if (industry) {
        companyContext += `Industry: ${industry}\n`
      }
      if (contact.website) {
        companyContext += `Website: ${contact.website}\n`
      }
      if (contact.linkedin_location) {
        companyContext += `Location: ${contact.linkedin_location}\n`
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

    // Personalization hints (combine web enrichment and LinkedIn data)
    let personalizationHints = ''
    if (insights.hasTargetAudience) {
      personalizationHints += `Their target audience: ${enrichment?.target_audience?.join(', ')}. `
    }
    if (insights.hasUniquePoints) {
      personalizationHints += `Key differentiators: ${enrichment?.unique_points?.join(', ')}. `
    }
    const position = contact.position || contact.linkedin_current_position
    if (position) {
      personalizationHints += `Contact position: ${position}. `
    }
    if (insights.hasLinkedInSkills && contact.linkedin_skills) {
      personalizationHints += `Skills: ${contact.linkedin_skills.slice(0, 5).join(', ')}. `
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

    // LinkedIn-specific personalization
    let linkedinPersonalization = ''
    if (insights.hasLinkedInHeadline && contact.linkedin_headline) {
      linkedinPersonalization += `LinkedIn headline: "${contact.linkedin_headline}". `
    }
    if (insights.hasLinkedInAbout && (contact.linkedin_about || contact.linkedin_summary)) {
      const about = contact.linkedin_about || contact.linkedin_summary
      linkedinPersonalization += `LinkedIn about: "${about?.substring(0, 200)}${about && about.length > 200 ? '...' : ''}". `
    }
    if (insights.hasLinkedInExperience && contact.linkedin_experience) {
      const recentExp = contact.linkedin_experience[0]
      if (recentExp?.company || recentExp?.title) {
        linkedinPersonalization += `Recent experience: ${recentExp.title || 'Role'} at ${recentExp.company || 'Company'}. `
      }
    }

    // Personal reason hints (for why this person specifically)
    let personalReasonHints = ''
    if (contact.linkedin_headline) {
      personalReasonHints += `Reference their role/expertise from headline. `
    }
    if (contact.linkedin_about || contact.linkedin_summary) {
      personalReasonHints += `Mention something specific from their profile summary. `
    }
    if (insights.hasLinkedInExperience) {
      personalReasonHints += `Reference their professional background or recent career moves. `
    }
    if (enrichment?.industry || contact.linkedin_industry) {
      personalReasonHints += `Connect to industry-specific challenges or opportunities. `
    }

    // Proof points for credibility
    let proofPoints = ''
    if (insights.hasTargetAudience && enrichment?.target_audience) {
      proofPoints += `We've helped similar companies targeting ${enrichment.target_audience.join(' and ')}. `
    }
    if (insights.hasIndustry) {
      const industry = enrichment?.industry || contact.linkedin_industry
      proofPoints += `We have experience working with ${industry} companies. `
    }

    return {
      companyContext: companyContext.trim(),
      industryInsights: industryInsights.trim(),
      personalizationHints: personalizationHints.trim(),
      toneGuidance,
      valuePropositionHints: valuePropositionHints.trim(),
      linkedinPersonalization: linkedinPersonalization.trim(),
      personalReasonHints: personalReasonHints.trim(),
      proofPoints: proofPoints.trim()
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
      hasPosition: !!(contact?.position),
      hasLinkedInProfile: false,
      hasLinkedInHeadline: false,
      hasLinkedInAbout: false,
      hasLinkedInExperience: false,
      hasLinkedInEducation: false,
      hasLinkedInSkills: false
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
        valuePropositionHints: '',
        linkedinPersonalization: '',
        personalReasonHints: '',
        proofPoints: ''
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
   * Format personalization context for AI prompt
   */
  formatForAIPrompt(context: PersonalizationContext): string {
    let prompt = `PERSONALIZATION CONTEXT:\n`
    
    if (context.aiContext.companyContext) {
      prompt += `\nCOMPANY INFO:\n${context.aiContext.companyContext}\n`
    }
    
    if (context.aiContext.linkedinPersonalization) {
      prompt += `\nLINKEDIN PROFILE DATA:\n${context.aiContext.linkedinPersonalization}\n`
    }
    
    if (context.aiContext.industryInsights) {
      prompt += `\nINDUSTRY INSIGHTS:\n${context.aiContext.industryInsights}\n`
    }
    
    if (context.aiContext.personalizationHints) {
      prompt += `\nPERSONALIZATION HINTS:\n${context.aiContext.personalizationHints}\n`
    }
    
    prompt += `\nENRICHMENT LEVEL: ${context.enrichmentLevel.toUpperCase()}\n`
    prompt += `PERSONALIZATION SCORE: ${context.personalizationScore}/100\n`
    
    return prompt
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
      enrichment_status: null,
      // LinkedIn fields
      linkedin_headline: null,
      linkedin_about: null,
      linkedin_summary: null,
      linkedin_current_company: null,
      linkedin_current_position: null,
      linkedin_industry: null,
      linkedin_location: null,
      linkedin_experience: null,
      linkedin_education: null,
      linkedin_skills: null,
      linkedin_profile_data: null
    }
  }

  /**
   * Format enrichment context for AI prompt
   */
  // Using the updated formatForAIPrompt method above
}