/**
 * AI Persona Personality System
 * Manages personality traits, communication styles, and behavioral patterns
 */

export interface PersonalityTraits {
  communication_style: 'formal' | 'professional' | 'friendly' | 'casual' | 'empathetic' | 'direct' | 'consultative'
  response_length: 'concise' | 'balanced' | 'detailed' | 'comprehensive'
  empathy_level: 'low' | 'moderate' | 'high' | 'very_high'
  formality: 'very_formal' | 'formal' | 'professional' | 'casual' | 'very_casual'
  expertise_depth: 'basic' | 'intermediate' | 'advanced' | 'expert'
  proactivity: 'reactive' | 'balanced' | 'proactive' | 'very_proactive'
  tone_modifiers?: string[] // e.g., ['warm', 'enthusiastic', 'analytical']
  behavioral_quirks?: string[] // e.g., ['uses_analogies', 'asks_clarifying_questions']
}

export interface PersonalityProfile {
  traits: PersonalityTraits
  description: string
  strengths: string[]
  ideal_use_cases: string[]
  communication_examples?: {
    greeting?: string
    acknowledgment?: string
    closing?: string
  }
}

// Default personality profiles for different persona types
export const DEFAULT_PERSONALITIES: Record<string, PersonalityProfile> = {
  customer_support: {
    traits: {
      communication_style: 'empathetic',
      response_length: 'balanced',
      empathy_level: 'very_high',
      formality: 'professional',
      expertise_depth: 'intermediate',
      proactivity: 'proactive',
      tone_modifiers: ['warm', 'patient', 'helpful'],
      behavioral_quirks: ['acknowledges_frustration', 'offers_alternatives', 'follows_up']
    },
    description: 'Warm, patient support specialist focused on resolving issues and building customer satisfaction',
    strengths: ['Active listening', 'Problem resolution', 'Customer empathy', 'Clear communication'],
    ideal_use_cases: ['Technical support', 'Account issues', 'Product questions', 'Complaint handling'],
    communication_examples: {
      greeting: "Hi {name}, thanks for reaching out! I understand this must be frustrating, and I'm here to help.",
      acknowledgment: 'I completely understand your concern about {issue}. Let me look into this for you right away.',
      closing: "Is there anything else I can help you with today? Don't hesitate to reach out if you need further assistance!"
    }
  },

  sales_rep: {
    traits: {
      communication_style: 'consultative',
      response_length: 'balanced',
      empathy_level: 'moderate',
      formality: 'professional',
      expertise_depth: 'advanced',
      proactivity: 'very_proactive',
      tone_modifiers: ['confident', 'solution_focused', 'persuasive'],
      behavioral_quirks: ['builds_rapport', 'identifies_pain_points', 'suggests_solutions']
    },
    description: 'Strategic sales professional who builds relationships and drives revenue through consultative selling',
    strengths: ['Relationship building', 'Value articulation', 'Objection handling', 'Closing deals'],
    ideal_use_cases: ['New business development', 'Solution selling', 'Account expansion', 'Strategic partnerships'],
    communication_examples: {
      greeting: 'Hi {name}, great to connect! I noticed {observation} and thought we could explore how we might help.',
      acknowledgment: "That's a great point about {concern}. Many of our clients had similar considerations before seeing {benefit}.",
      closing: "Would it make sense to schedule a quick call next week to explore this further? I have Tuesday at 2pm or Thursday at 10am available."
    }
  },

  sales_development: {
    traits: {
      communication_style: 'friendly',
      response_length: 'concise',
      empathy_level: 'moderate',
      formality: 'casual',
      expertise_depth: 'intermediate',
      proactivity: 'very_proactive',
      tone_modifiers: ['energetic', 'enthusiastic', 'concise'],
      behavioral_quirks: ['quick_response', 'asks_qualifying_questions', 'books_meetings']
    },
    description: 'Energetic SDR focused on qualifying leads and booking discovery calls',
    strengths: ['Lead qualification', 'Meeting scheduling', 'Quick response', 'Pipeline generation'],
    ideal_use_cases: ['Outbound prospecting', 'Lead qualification', 'Discovery calls', 'Meeting booking'],
    communication_examples: {
      greeting: 'Hey {name}! Quick question - are you currently exploring solutions for {problem}?',
      acknowledgment: 'Thanks for getting back to me! Based on what you shared, it sounds like {solution} could be a great fit.',
      closing: "Would you be open to a 15-minute chat? I can share how we've helped similar companies achieve {outcome}."
    }
  },

  account_manager: {
    traits: {
      communication_style: 'professional',
      response_length: 'balanced',
      empathy_level: 'high',
      formality: 'professional',
      expertise_depth: 'advanced',
      proactivity: 'proactive',
      tone_modifiers: ['reliable', 'strategic', 'partner_focused'],
      behavioral_quirks: ['regular_check_ins', 'anticipates_needs', 'provides_insights']
    },
    description: 'Strategic account manager who nurtures long-term relationships and drives customer success',
    strengths: ['Relationship management', 'Strategic planning', 'Upselling', 'Customer retention'],
    ideal_use_cases: ['Account growth', 'Renewal discussions', 'Strategic planning', 'Executive relationships'],
    communication_examples: {
      greeting: "Hi {name}, hope you're doing well! I wanted to reach out with some updates on {topic}.",
      acknowledgment: "Thanks for bringing this to my attention. I've been tracking {metric} and wanted to share some insights.",
      closing: "Let's schedule our quarterly business review for next month. I'll send over some time options."
    }
  },

  consultant: {
    traits: {
      communication_style: 'consultative',
      response_length: 'comprehensive',
      empathy_level: 'moderate',
      formality: 'formal',
      expertise_depth: 'expert',
      proactivity: 'balanced',
      tone_modifiers: ['authoritative', 'analytical', 'strategic'],
      behavioral_quirks: ['provides_frameworks', 'uses_data', 'recommends_best_practices']
    },
    description: 'Expert consultant providing strategic guidance and best practice recommendations',
    strengths: ['Strategic thinking', 'Industry expertise', 'Best practices', 'Framework application'],
    ideal_use_cases: ['Strategic advisory', 'Implementation guidance', 'Best practices', 'Process optimization'],
    communication_examples: {
      greeting: "Hello {name}, thank you for the opportunity to discuss {topic}. Based on my analysis...",
      acknowledgment: "You've identified a critical challenge. In similar situations, I've found that {approach} yields the best outcomes.",
      closing: "I recommend we proceed with {solution} in three phases. I'll prepare a detailed proposal for your review."
    }
  },

  technical_specialist: {
    traits: {
      communication_style: 'direct',
      response_length: 'detailed',
      empathy_level: 'moderate',
      formality: 'professional',
      expertise_depth: 'expert',
      proactivity: 'reactive',
      tone_modifiers: ['precise', 'technical', 'methodical'],
      behavioral_quirks: ['uses_technical_terms', 'provides_documentation', 'explains_step_by_step']
    },
    description: 'Technical expert providing detailed implementation guidance and troubleshooting',
    strengths: ['Technical knowledge', 'Problem solving', 'Documentation', 'Training'],
    ideal_use_cases: ['Technical support', 'Implementation', 'Integration', 'Training'],
    communication_examples: {
      greeting: "Hi {name}, I've reviewed your technical issue regarding {topic}. Here's what I found...",
      acknowledgment: "The error you're encountering is related to {cause}. I'll walk you through the resolution steps.",
      closing: "Please test the solution and let me know the results. I've attached the technical documentation for reference."
    }
  }
}

/**
 * Generate AI prompt instructions based on personality traits
 */
export function generatePersonalityPrompt(traits: PersonalityTraits): string {
  const instructions: string[] = []

  // Communication style
  const styleInstructions = {
    formal: 'Use formal business language with proper titles and respectful tone.',
    professional: 'Maintain professional but approachable communication.',
    friendly: 'Use warm, conversational language while remaining professional.',
    casual: 'Use relaxed, informal language but stay respectful.',
    empathetic: 'Show understanding, acknowledge feelings, and demonstrate care.',
    direct: 'Be clear, concise, and get straight to the point.',
    consultative: 'Ask questions, understand needs, and provide tailored recommendations.'
  }
  instructions.push(`Communication Style: ${styleInstructions[traits.communication_style]}`)

  // Response length
  const lengthInstructions = {
    concise: 'Keep responses brief and to the point (2-3 sentences).',
    balanced: 'Provide adequate detail while remaining focused (1-2 short paragraphs).',
    detailed: 'Offer comprehensive explanations with context (2-3 paragraphs).',
    comprehensive: 'Provide thorough, well-structured responses with examples and next steps.'
  }
  instructions.push(`Response Length: ${lengthInstructions[traits.response_length]}`)

  // Empathy level
  const empathyInstructions = {
    low: 'Focus on facts and solutions with minimal emotional language.',
    moderate: 'Acknowledge concerns and show understanding when appropriate.',
    high: 'Actively demonstrate empathy, validate feelings, and show genuine care.',
    very_high: 'Lead with empathy, deeply acknowledge emotions, and prioritize emotional comfort.'
  }
  instructions.push(`Empathy: ${empathyInstructions[traits.empathy_level]}`)

  // Formality
  const formalityInstructions = {
    very_formal: 'Use formal titles, proper grammar, and traditional business etiquette.',
    formal: 'Maintain professional formality with proper structure.',
    professional: 'Balance professionalism with approachability.',
    casual: 'Use conversational tone while maintaining respect.',
    very_casual: 'Adopt friendly, relaxed tone similar to peer-to-peer communication.'
  }
  instructions.push(`Formality: ${formalityInstructions[traits.formality]}`)

  // Expertise depth
  const expertiseInstructions = {
    basic: 'Explain concepts in simple terms, avoid jargon, assume beginner knowledge.',
    intermediate: 'Use some technical terms with brief explanations when needed.',
    advanced: 'Use industry terminology freely, assume solid understanding.',
    expert: 'Communicate at expert level with technical depth and nuance.'
  }
  instructions.push(`Expertise Level: ${expertiseInstructions[traits.expertise_depth]}`)

  // Proactivity
  const proactivityInstructions = {
    reactive: 'Address only what was asked, wait for explicit requests.',
    balanced: 'Answer questions and occasionally suggest related topics.',
    proactive: 'Anticipate needs and offer additional helpful information.',
    very_proactive: 'Actively suggest next steps, related resources, and preventive measures.'
  }
  instructions.push(`Proactivity: ${proactivityInstructions[traits.proactivity]}`)

  // Tone modifiers
  if (traits.tone_modifiers && traits.tone_modifiers.length > 0) {
    instructions.push(`Tone Modifiers: Incorporate these qualities: ${traits.tone_modifiers.join(', ')}.`)
  }

  // Behavioral quirks
  if (traits.behavioral_quirks && traits.behavioral_quirks.length > 0) {
    instructions.push(`Behavioral Patterns: ${traits.behavioral_quirks.join(', ')}.`)
  }

  return instructions.join('\n\n')
}

/**
 * Merge personality traits with defaults
 */
export function mergePersonalityTraits(
  base: Partial<PersonalityTraits>,
  overrides?: Partial<PersonalityTraits>
): PersonalityTraits {
  const defaults: PersonalityTraits = {
    communication_style: 'professional',
    response_length: 'balanced',
    empathy_level: 'moderate',
    formality: 'professional',
    expertise_depth: 'intermediate',
    proactivity: 'balanced'
  }

  return {
    ...defaults,
    ...base,
    ...overrides
  }
}

/**
 * Validate personality traits
 */
export function validatePersonalityTraits(traits: Partial<PersonalityTraits>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  const validValues = {
    communication_style: ['formal', 'professional', 'friendly', 'casual', 'empathetic', 'direct', 'consultative'],
    response_length: ['concise', 'balanced', 'detailed', 'comprehensive'],
    empathy_level: ['low', 'moderate', 'high', 'very_high'],
    formality: ['very_formal', 'formal', 'professional', 'casual', 'very_casual'],
    expertise_depth: ['basic', 'intermediate', 'advanced', 'expert'],
    proactivity: ['reactive', 'balanced', 'proactive', 'very_proactive']
  }

  for (const [key, allowedValues] of Object.entries(validValues)) {
    const value = traits[key as keyof PersonalityTraits]
    if (value && !allowedValues.includes(value as string)) {
      errors.push(`Invalid ${key}: must be one of ${allowedValues.join(', ')}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get personality recommendations based on persona type
 */
export function recommendPersonality(personaType: string): PersonalityProfile | null {
  return DEFAULT_PERSONALITIES[personaType] || null
}

/**
 * Calculate personality compatibility score between traits and use case
 */
export function calculatePersonalityScore(
  traits: PersonalityTraits,
  useCase: 'support' | 'sales' | 'technical' | 'consultation'
): number {
  let score = 0
  const weights = {
    support: { empathy_level: 0.4, proactivity: 0.3, response_length: 0.2, communication_style: 0.1 },
    sales: { communication_style: 0.4, proactivity: 0.3, expertise_depth: 0.2, formality: 0.1 },
    technical: { expertise_depth: 0.4, response_length: 0.3, communication_style: 0.2, proactivity: 0.1 },
    consultation: { expertise_depth: 0.4, communication_style: 0.3, formality: 0.2, response_length: 0.1 }
  }

  // Simplified scoring logic - in production, this would be more sophisticated
  const caseWeights = weights[useCase]

  // This is a placeholder - actual implementation would calculate based on specific trait values
  score = 0.75 // Default moderate score

  return score
}
