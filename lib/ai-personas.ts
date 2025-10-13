/**
 * AI Personas System
 * Refactored from outreach-agents.ts to support enhanced personality, avatars, and chat
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './database.types'
import type { PersonalityTraits } from './persona-personality'
import { mergePersonalityTraits, DEFAULT_PERSONALITIES } from './persona-personality'

export type Supabase = SupabaseClient<Database>

// Re-export types from outreach-agents for backward compatibility
export type {
  KnowledgeSummary,
  SegmentFilters,
  DataSignals,
  AdvancedRules,
  SegmentSchedule,
  QualityWeights,
  SegmentConfig
} from './outreach-agents'

export interface AIPersona {
  id: string
  user_id: string
  name: string
  status: 'draft' | 'active' | 'inactive'
  persona_type: 'customer_support' | 'sales_rep' | 'sales_development' | 'account_manager' | 'consultant' | 'technical_specialist' | 'success_manager' | 'marketing_specialist' | 'custom'
  purpose?: string | null
  tone?: string | null
  language: 'en' | 'de'

  // Custom persona fields
  custom_persona_name?: string | null
  custom_persona_description?: string | null
  custom_role_definition?: string | null
  custom_responsibilities?: string[]
  custom_communication_guidelines?: string | null
  custom_example_interactions?: any[]

  // Identity
  sender_name?: string | null
  sender_role?: string | null
  company_name?: string | null

  // Product/Service
  product_one_liner?: string | null
  product_description?: string | null
  unique_selling_points?: string[]
  target_persona?: string | null
  conversation_goal?: string | null
  preferred_cta?: string | null
  follow_up_strategy?: string | null

  // AI Configuration
  custom_prompt?: string | null
  prompt_override?: string | null

  // Personality
  personality_traits: PersonalityTraits

  // Avatar
  avatar_url?: string | null
  avatar_prompt?: string | null
  avatar_generation_status: 'pending' | 'generating' | 'completed' | 'failed'
  avatar_metadata?: Record<string, any>
  gender?: string | null
  appearance_description?: string | null

  // Chat
  chat_enabled: boolean
  chat_history?: any[]
  total_chats: number
  total_emails_handled: number
  average_response_time_ms?: number | null
  satisfaction_score?: number | null

  // Segmentation (inherited from outreach agents)
  segment_config: any
  quality_weights: any
  knowledge_summary: any

  // Metadata
  settings?: Record<string, any>
  last_used_at?: string | null
  created_at: string
  updated_at: string
}

export interface AIPersonaInput {
  name: string
  status?: 'draft' | 'active' | 'inactive'
  persona_type: AIPersona['persona_type']
  purpose?: string
  tone?: string
  language?: 'en' | 'de'

  // Custom persona fields
  custom_persona_name?: string
  custom_persona_description?: string
  custom_role_definition?: string
  custom_responsibilities?: string[]
  custom_communication_guidelines?: string
  custom_example_interactions?: any[]

  // Identity
  sender_name?: string
  sender_role?: string
  company_name?: string

  // Product
  product_one_liner?: string
  product_description?: string
  unique_selling_points?: string[]
  target_persona?: string
  conversation_goal?: string
  preferred_cta?: string
  follow_up_strategy?: string

  // AI Configuration
  custom_prompt?: string
  prompt_override?: string

  // Personality
  personality_traits?: Partial<PersonalityTraits>

  // Avatar
  avatar_options?: {
    age?: string
    gender?: string
    ethnicity?: string
    attire?: string
    customPrompt?: string
  }

  // Segmentation
  segment_config?: any
  quality_weights?: any

  // Chat
  chat_enabled?: boolean

  // Settings
  settings?: Record<string, any>
}

/**
 * List all AI personas for a user
 */
export async function listAIPersonas(
  supabase: Supabase,
  userId: string,
  filters?: {
    status?: AIPersona['status']
    persona_type?: AIPersona['persona_type']
    chat_enabled?: boolean
  }
): Promise<AIPersona[]> {
  try {
    let query = supabase
      .from('ai_personas')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.persona_type) {
      query = query.eq('persona_type', filters.persona_type)
    }

    if (filters?.chat_enabled !== undefined) {
      query = query.eq('chat_enabled', filters.chat_enabled)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch AI personas: ${error.message}`)
    }

    return (data || []).map(mapPersona)
  } catch (error) {
    console.error('Error listing AI personas:', error)
    throw error
  }
}

/**
 * Get a single AI persona by ID
 */
export async function getAIPersona(
  supabase: Supabase,
  userId: string,
  personaId: string
): Promise<AIPersona | null> {
  try {
    const { data, error } = await supabase
      .from('ai_personas')
      .select('*')
      .eq('user_id', userId)
      .eq('id', personaId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to load AI persona: ${error.message}`)
    }

    return data ? mapPersona(data) : null
  } catch (error) {
    console.error('Error getting AI persona:', error)
    throw error
  }
}

/**
 * Create a new AI persona
 */
export async function createAIPersona(
  supabase: Supabase,
  userId: string,
  input: AIPersonaInput
): Promise<AIPersona> {
  try {
    // Get default personality for persona type
    const defaultPersonality = DEFAULT_PERSONALITIES[input.persona_type]
    const personalityTraits = mergePersonalityTraits(
      defaultPersonality?.traits || {},
      input.personality_traits
    )

    const payload: any = {
      user_id: userId,
      name: input.name,
      status: input.status || 'inactive',
      persona_type: input.persona_type,
      purpose: input.purpose,
      tone: input.tone,
      language: input.language || 'en',
      sender_name: input.sender_name,
      sender_role: input.sender_role,
      company_name: input.company_name,
      product_one_liner: input.product_one_liner,
      product_description: input.product_description,
      unique_selling_points: input.unique_selling_points || [],
      target_persona: input.target_persona,
      conversation_goal: input.conversation_goal,
      preferred_cta: input.preferred_cta,
      follow_up_strategy: input.follow_up_strategy,
      custom_prompt: input.custom_prompt,
      prompt_override: input.prompt_override,
      personality_traits: personalityTraits as unknown as Json,
      avatar_generation_status: input.avatar_url ? 'completed' : 'pending',
      chat_enabled: input.chat_enabled !== undefined ? input.chat_enabled : true,
      total_chats: 0,
      total_emails_handled: 0,
      segment_config: input.segment_config || {},
      quality_weights: input.quality_weights || {},
      settings: input.settings || {},
      // Custom persona fields
      custom_persona_name: input.custom_persona_name,
      custom_persona_description: input.custom_persona_description,
      custom_role_definition: input.custom_role_definition,
      custom_responsibilities: input.custom_responsibilities,
      custom_communication_guidelines: input.custom_communication_guidelines,
      custom_example_interactions: input.custom_example_interactions as any
    }

    // Add appearance fields from input (typed on route handler side)
    if ((input as any).gender) {
      payload.gender = (input as any).gender
    }
    if ((input as any).appearance_description) {
      payload.appearance_description = (input as any).appearance_description
    }
    if ((input as any).avatar_url) {
      payload.avatar_url = (input as any).avatar_url
    }

    const { data, error } = await supabase
      .from('ai_personas')
      .insert(payload)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create AI persona: ${error.message}`)
    }

    return mapPersona(data)
  } catch (error) {
    console.error('Error creating AI persona:', error)
    throw error
  }
}

/**
 * Update an existing AI persona
 */
export async function updateAIPersona(
  supabase: Supabase,
  userId: string,
  personaId: string,
  input: Partial<AIPersonaInput>
): Promise<AIPersona> {
  try {
    const current = await getAIPersona(supabase, userId, personaId)
    if (!current) {
      throw new Error('AI persona not found')
    }

    const payload: any = {
      name: input.name !== undefined ? input.name : current.name,
      status: input.status !== undefined ? input.status : current.status,
      persona_type: input.persona_type !== undefined ? input.persona_type : current.persona_type,
      purpose: input.purpose !== undefined ? input.purpose : current.purpose,
      tone: input.tone !== undefined ? input.tone : current.tone,
      language: input.language !== undefined ? input.language : current.language,
      sender_name: input.sender_name !== undefined ? input.sender_name : current.sender_name,
      sender_role: input.sender_role !== undefined ? input.sender_role : current.sender_role,
      company_name: input.company_name !== undefined ? input.company_name : current.company_name,
      product_one_liner: input.product_one_liner !== undefined ? input.product_one_liner : current.product_one_liner,
      product_description: input.product_description !== undefined ? input.product_description : current.product_description,
      unique_selling_points: input.unique_selling_points !== undefined ? input.unique_selling_points : current.unique_selling_points,
      target_persona: input.target_persona !== undefined ? input.target_persona : current.target_persona,
      conversation_goal: input.conversation_goal !== undefined ? input.conversation_goal : current.conversation_goal,
      preferred_cta: input.preferred_cta !== undefined ? input.preferred_cta : current.preferred_cta,
      follow_up_strategy: input.follow_up_strategy !== undefined ? input.follow_up_strategy : current.follow_up_strategy,
      custom_prompt: input.custom_prompt !== undefined ? input.custom_prompt : current.custom_prompt,
      prompt_override: input.prompt_override !== undefined ? input.prompt_override : current.prompt_override,
      chat_enabled: input.chat_enabled !== undefined ? input.chat_enabled : current.chat_enabled,
      updated_at: new Date().toISOString()
    }

    // Update personality traits if provided
    if (input.personality_traits) {
      const mergedTraits = mergePersonalityTraits(current.personality_traits, input.personality_traits)
      payload.personality_traits = mergedTraits as unknown as Json
    }

    // Update segment config if provided
    if (input.segment_config) {
      payload.segment_config = { ...current.segment_config, ...input.segment_config }
    }

    // Update quality weights if provided
    if (input.quality_weights) {
      payload.quality_weights = { ...current.quality_weights, ...input.quality_weights }
    }

    // Update settings if provided
    if (input.settings) {
      payload.settings = { ...current.settings, ...input.settings }
    }

    const { data, error } = await supabase
      .from('ai_personas')
      .update(payload)
      .eq('user_id', userId)
      .eq('id', personaId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update AI persona: ${error.message}`)
    }

    return mapPersona(data)
  } catch (error) {
    console.error('Error updating AI persona:', error)
    throw error
  }
}

/**
 * Delete an AI persona
 */
export async function deleteAIPersona(
  supabase: Supabase,
  userId: string,
  personaId: string
): Promise<void> {
  try {
    console.log('🗑️ Starting persona deletion:', { userId, personaId })

    // First verify the persona exists and belongs to the user
    const { data: existingPersona, error: fetchError } = await supabase
      .from('ai_personas')
      .select('id, name')
      .eq('user_id', userId)
      .eq('id', personaId)
      .single()

    if (fetchError || !existingPersona) {
      console.error('❌ Persona not found:', { personaId, userId, fetchError })
      throw new Error('AI persona not found or you do not have permission to delete it')
    }

    console.log('✅ Persona found:', existingPersona.name)

    // Perform the deletion with .select() to verify rows were deleted
    const { data: deletedRows, error: deleteError } = await supabase
      .from('ai_personas')
      .delete()
      .eq('user_id', userId)
      .eq('id', personaId)
      .select()

    if (deleteError) {
      console.error('❌ Delete error:', deleteError)
      throw new Error(`Failed to delete AI persona: ${deleteError.message}`)
    }

    // Verify deletion occurred
    if (!deletedRows || deletedRows.length === 0) {
      console.error('❌ No rows deleted:', { personaId, userId })
      throw new Error('AI persona could not be deleted. It may have been already deleted or you lack permissions.')
    }

    console.log('✅ Persona successfully deleted:', {
      personaId,
      deletedCount: deletedRows.length,
      deletedPersona: deletedRows[0]?.name
    })
  } catch (error) {
    console.error('❌ Error deleting AI persona:', error)
    throw error
  }
}

/**
 * Duplicate an AI persona
 */
export async function duplicateAIPersona(
  supabase: Supabase,
  userId: string,
  personaId: string
): Promise<AIPersona> {
  try {
    const original = await getAIPersona(supabase, userId, personaId)
    if (!original) {
      throw new Error('AI persona not found')
    }

    const cloned = await createAIPersona(supabase, userId, {
      name: `${original.name} Copy`,
      status: 'inactive',
      persona_type: original.persona_type,
      purpose: original.purpose || undefined,
      tone: original.tone || undefined,
      language: original.language,
      sender_name: original.sender_name || undefined,
      sender_role: original.sender_role || undefined,
      company_name: original.company_name || undefined,
      product_one_liner: original.product_one_liner || undefined,
      product_description: original.product_description || undefined,
      unique_selling_points: original.unique_selling_points,
      target_persona: original.target_persona || undefined,
      conversation_goal: original.conversation_goal || undefined,
      preferred_cta: original.preferred_cta || undefined,
      follow_up_strategy: original.follow_up_strategy || undefined,
      custom_prompt: original.custom_prompt || undefined,
      prompt_override: original.prompt_override || undefined,
      personality_traits: original.personality_traits,
      segment_config: original.segment_config,
      quality_weights: original.quality_weights,
      chat_enabled: original.chat_enabled,
      settings: original.settings
    })

    return cloned
  } catch (error) {
    console.error('Error duplicating AI persona:', error)
    throw error
  }
}

/**
 * Map database record to AIPersona type
 */
function mapPersona(record: any): AIPersona {
  return {
    id: record.id,
    user_id: record.user_id,
    name: record.name,
    status: record.status,
    persona_type: record.persona_type,
    purpose: record.purpose,
    tone: record.tone,
    language: record.language || 'en',
    sender_name: record.sender_name,
    sender_role: record.sender_role,
    company_name: record.company_name,
    product_one_liner: record.product_one_liner,
    product_description: record.product_description,
    unique_selling_points: record.unique_selling_points || [],
    target_persona: record.target_persona,
    conversation_goal: record.conversation_goal,
    preferred_cta: record.preferred_cta,
    follow_up_strategy: record.follow_up_strategy,
    custom_prompt: record.custom_prompt,
    prompt_override: record.prompt_override,
    personality_traits: record.personality_traits as PersonalityTraits,
    avatar_url: record.avatar_url,
    avatar_prompt: record.avatar_prompt,
    avatar_generation_status: record.avatar_generation_status || 'pending',
    avatar_metadata: record.avatar_metadata || {},
    gender: record.gender,
    appearance_description: record.appearance_description,
    chat_enabled: record.chat_enabled !== false,
    chat_history: record.chat_history || [],
    total_chats: record.total_chats || 0,
    total_emails_handled: record.total_emails_handled || 0,
    average_response_time_ms: record.average_response_time_ms,
    satisfaction_score: record.satisfaction_score,
    segment_config: record.segment_config || {},
    quality_weights: record.quality_weights || {},
    knowledge_summary: record.knowledge_summary || {},
    settings: record.settings || {},
    last_used_at: record.last_used_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
    // Custom persona fields
    custom_persona_name: record.custom_persona_name,
    custom_persona_description: record.custom_persona_description,
    custom_role_definition: record.custom_role_definition,
    custom_responsibilities: record.custom_responsibilities || [],
    custom_communication_guidelines: record.custom_communication_guidelines,
    custom_example_interactions: record.custom_example_interactions || []
  }
}

// Re-export backward compatible functions from outreach-agents
// These maintain API compatibility while using the new personas system
export {
  previewSegment,
  addKnowledgeItem,
  updateKnowledgeItem,
  removeKnowledgeItem
} from './outreach-agents'
