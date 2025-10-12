/**
 * Custom Persona Builder
 * Allows users to create fully customized personas with their own definitions
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { PersonalityTraits } from './persona-personality'
import { validatePersonalityTraits, generatePersonalityPrompt } from './persona-personality'

type Supabase = SupabaseClient<Database>

export interface CustomPersonaDefinition {
  customPersonaName: string // e.g., "Technical Writer", "Product Manager", "HR Specialist"
  customPersonaDescription: string // What this persona does
  customRoleDefinition: string // Detailed role description
  customResponsibilities: string[] // List of key responsibilities
  customCommunicationGuidelines: string // How they should communicate
  customExampleInteractions?: ExampleInteraction[]
}

export interface ExampleInteraction {
  scenario: string
  userInput: string
  expectedResponse: string
  notes?: string
}

export interface PersonalityTemplate {
  id?: string
  userId?: string
  name: string
  description: string
  personaType: string
  personalityTraits: PersonalityTraits
  customRoleDefinition?: string
  customResponsibilities?: string[]
  customCommunicationGuidelines?: string
  exampleInteractions?: ExampleInteraction[]
  isPublic: boolean
  usageCount?: number
  createdAt?: string
  updatedAt?: string
}

/**
 * Validate custom persona definition
 */
export function validateCustomPersonaDefinition(
  definition: Partial<CustomPersonaDefinition>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!definition.customPersonaName || definition.customPersonaName.trim().length === 0) {
    errors.push('Custom persona name is required')
  }

  if (!definition.customPersonaDescription || definition.customPersonaDescription.trim().length === 0) {
    errors.push('Custom persona description is required')
  }

  if (!definition.customRoleDefinition || definition.customRoleDefinition.trim().length === 0) {
    errors.push('Role definition is required')
  }

  if (!definition.customResponsibilities || definition.customResponsibilities.length === 0) {
    errors.push('At least one responsibility is required')
  }

  if (!definition.customCommunicationGuidelines || definition.customCommunicationGuidelines.trim().length === 0) {
    errors.push('Communication guidelines are required')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Build AI prompt for custom persona
 */
export function buildCustomPersonaPrompt(
  definition: CustomPersonaDefinition,
  personalityTraits: PersonalityTraits
): string {
  const sections: string[] = []

  // Role Identity
  sections.push(`You are a ${definition.customPersonaName}.`)
  sections.push(`\nRole Description:\n${definition.customPersonaDescription}`)

  // Detailed Role Definition
  sections.push(`\nDetailed Role Definition:\n${definition.customRoleDefinition}`)

  // Responsibilities
  sections.push(`\nYour Key Responsibilities:`)
  definition.customResponsibilities.forEach((resp, i) => {
    sections.push(`${i + 1}. ${resp}`)
  })

  // Communication Guidelines
  sections.push(`\nCommunication Guidelines:\n${definition.customCommunicationGuidelines}`)

  // Personality Traits
  const personalityInstructions = generatePersonalityPrompt(personalityTraits)
  sections.push(`\nPersonality & Style:\n${personalityInstructions}`)

  // Example Interactions (if provided)
  if (definition.customExampleInteractions && definition.customExampleInteractions.length > 0) {
    sections.push(`\nExample Interactions:`)
    definition.customExampleInteractions.forEach((example, i) => {
      sections.push(`\nExample ${i + 1}: ${example.scenario}`)
      sections.push(`User: ${example.userInput}`)
      sections.push(`You: ${example.expectedResponse}`)
      if (example.notes) {
        sections.push(`Note: ${example.notes}`)
      }
    })
  }

  // Core Guidelines
  sections.push(`\nCore Guidelines:
- Stay in character as a ${definition.customPersonaName} at all times
- Apply your personality traits and communication guidelines consistently
- Focus on your defined responsibilities
- Be authentic and helpful
- If you don't know something, acknowledge it honestly`)

  return sections.join('\n\n')
}

/**
 * Generate example custom persona definitions
 */
export function getCustomPersonaExamples(): Array<{
  name: string
  definition: CustomPersonaDefinition
  personalityTraits: Partial<PersonalityTraits>
}> {
  return [
    {
      name: 'Technical Writer',
      definition: {
        customPersonaName: 'Technical Writer',
        customPersonaDescription: 'Create clear, comprehensive documentation for technical products and APIs',
        customRoleDefinition: 'A technical writer specializing in developer documentation, API references, and user guides. Expert at translating complex technical concepts into accessible content.',
        customResponsibilities: [
          'Write and maintain API documentation',
          'Create user guides and tutorials',
          'Develop code examples and samples',
          'Review technical content for accuracy',
          'Collaborate with engineering teams'
        ],
        customCommunicationGuidelines: 'Use clear, concise language. Break down complex topics into digestible sections. Include practical examples. Anticipate common questions. Focus on helping users succeed.',
        customExampleInteractions: [
          {
            scenario: 'User asks about API authentication',
            userInput: 'How do I authenticate with your API?',
            expectedResponse: 'Great question! Our API uses OAuth 2.0 for authentication. Here\'s a step-by-step guide:\n\n1. Register your application\n2. Obtain client credentials\n3. Request an access token\n\nHere\'s a code example:\n```\nPOST /oauth/token\nContent-Type: application/json\n\n{\n  "client_id": "your_client_id",\n  "client_secret": "your_secret",\n  "grant_type": "client_credentials"\n}\n```\n\nNeed help with any specific step?',
            notes: 'Always provide code examples and break down into clear steps'
          }
        ]
      },
      personalityTraits: {
        communication_style: 'direct',
        response_length: 'detailed',
        empathy_level: 'moderate',
        formality: 'professional',
        expertise_depth: 'expert',
        proactivity: 'proactive'
      }
    },

    {
      name: 'Product Manager',
      definition: {
        customPersonaName: 'Product Manager',
        customPersonaDescription: 'Guide product strategy, prioritize features, and bridge technical and business teams',
        customRoleDefinition: 'A strategic product manager focused on understanding user needs, defining product roadmaps, and ensuring successful product launches. Balances user value, business goals, and technical feasibility.',
        customResponsibilities: [
          'Define and communicate product vision',
          'Prioritize feature requests and roadmap',
          'Gather and analyze user feedback',
          'Coordinate with engineering and design teams',
          'Track product metrics and KPIs'
        ],
        customCommunicationGuidelines: 'Be strategic and outcome-focused. Use data to support decisions. Listen actively to stakeholder needs. Frame discussions around user value and business impact. Be decisive but collaborative.',
        customExampleInteractions: [
          {
            scenario: 'Feature prioritization discussion',
            userInput: 'We have 10 feature requests. Which should we build first?',
            expectedResponse: 'Let\'s prioritize based on impact and effort. First, I\'d like to understand:\n\n1. What\'s the user pain point for each feature?\n2. How many users are affected?\n3. Does it align with our Q4 goals?\n\nFrom what I\'ve seen in the data, the top 3 requests affecting 60% of users should take priority. Can you share the feature list so we can score them together?',
            notes: 'Always anchor decisions in data and user impact'
          }
        ]
      },
      personalityTraits: {
        communication_style: 'consultative',
        response_length: 'balanced',
        empathy_level: 'high',
        formality: 'professional',
        expertise_depth: 'advanced',
        proactivity: 'very_proactive'
      }
    },

    {
      name: 'HR Specialist',
      definition: {
        customPersonaName: 'HR Specialist',
        customPersonaDescription: 'Support employees with HR policies, benefits, and workplace concerns',
        customRoleDefinition: 'A people-focused HR specialist dedicated to employee wellbeing, policy guidance, and creating a positive workplace culture. Expert in benefits, compliance, and conflict resolution.',
        customResponsibilities: [
          'Answer employee questions about policies and benefits',
          'Guide employees through HR processes',
          'Support conflict resolution and workplace issues',
          'Ensure compliance with labor regulations',
          'Foster positive employee experience'
        ],
        customCommunicationGuidelines: 'Be warm, confidential, and supportive. Show empathy while maintaining professionalism. Provide clear policy guidance. Create a safe space for sensitive discussions. Balance employee advocacy with company policy.',
        customExampleInteractions: [
          {
            scenario: 'Employee asks about parental leave',
            userInput: 'I\'m expecting a baby in 3 months. What leave am I entitled to?',
            expectedResponse: 'Congratulations on your growing family! I\'m happy to help you understand your leave options.\n\nYou\'re entitled to:\n- 12 weeks paid parental leave\n- Additional unpaid FMLA leave if needed\n- Flexible return-to-work schedule\n\nLet\'s schedule a call to discuss your specific situation, timeline, and any questions you have. This is an exciting time, and I\'m here to support you through the process.',
            notes: 'Show warmth while providing clear policy information'
          }
        ]
      },
      personalityTraits: {
        communication_style: 'empathetic',
        response_length: 'balanced',
        empathy_level: 'very_high',
        formality: 'professional',
        expertise_depth: 'advanced',
        proactivity: 'proactive'
      }
    }
  ]
}

/**
 * Save personality template
 */
export async function savePersonalityTemplate(
  supabase: Supabase,
  userId: string,
  template: Omit<PersonalityTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<PersonalityTemplate | null> {
  try {
    // Validate personality traits
    const validation = validatePersonalityTraits(template.personalityTraits)
    if (!validation.valid) {
      console.error('Invalid personality traits:', validation.errors)
      return null
    }

    const { data, error } = await supabase
      .from('ai_persona_personality_templates')
      .insert({
        user_id: userId,
        name: template.name,
        description: template.description,
        persona_type: template.personaType,
        personality_traits: template.personalityTraits as any,
        custom_role_definition: template.customRoleDefinition,
        custom_responsibilities: template.customResponsibilities,
        custom_communication_guidelines: template.customCommunicationGuidelines,
        example_interactions: template.exampleInteractions as any,
        is_public: template.isPublic,
        usage_count: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save personality template:', error)
      return null
    }

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      personaType: data.persona_type,
      personalityTraits: data.personality_traits as PersonalityTraits,
      customRoleDefinition: data.custom_role_definition || undefined,
      customResponsibilities: data.custom_responsibilities || undefined,
      customCommunicationGuidelines: data.custom_communication_guidelines || undefined,
      exampleInteractions: data.example_interactions as ExampleInteraction[] || undefined,
      isPublic: data.is_public,
      usageCount: data.usage_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  } catch (error) {
    console.error('Error saving personality template:', error)
    return null
  }
}

/**
 * List personality templates
 */
export async function listPersonalityTemplates(
  supabase: Supabase,
  userId: string,
  includePublic: boolean = true
): Promise<PersonalityTemplate[]> {
  try {
    let query = supabase
      .from('ai_persona_personality_templates')
      .select('*')
      .order('usage_count', { ascending: false })

    if (includePublic) {
      query = query.or(`user_id.eq.${userId},is_public.eq.true`)
    } else {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to list personality templates:', error)
      return []
    }

    return (data || []).map(item => ({
      id: item.id,
      userId: item.user_id,
      name: item.name,
      description: item.description,
      personaType: item.persona_type,
      personalityTraits: item.personality_traits as PersonalityTraits,
      customRoleDefinition: item.custom_role_definition || undefined,
      customResponsibilities: item.custom_responsibilities || undefined,
      customCommunicationGuidelines: item.custom_communication_guidelines || undefined,
      exampleInteractions: item.example_interactions as ExampleInteraction[] || undefined,
      isPublic: item.is_public,
      usageCount: item.usage_count,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
  } catch (error) {
    console.error('Error listing personality templates:', error)
    return []
  }
}

/**
 * Delete personality template
 */
export async function deletePersonalityTemplate(
  supabase: Supabase,
  userId: string,
  templateId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_persona_personality_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to delete personality template:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting personality template:', error)
    return false
  }
}

/**
 * Increment template usage count
 */
export async function incrementTemplateUsage(
  supabase: Supabase,
  templateId: string
): Promise<void> {
  try {
    await supabase.rpc('increment_template_usage', { template_id: templateId })
  } catch (error) {
    console.error('Error incrementing template usage:', error)
  }
}
