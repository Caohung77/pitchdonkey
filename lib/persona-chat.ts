import { GoogleGenerativeAI } from '@google/generative-ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { generatePersonalityPrompt, type PersonalityTraits } from './persona-personality'
import type { ContactContext } from './ai-persona-contact-context'
import type { AIQueryResult } from './ai-contact-query-service'

type Supabase = SupabaseClient<Database>

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    model?: string
    tokensUsed?: number
    responseTime?: number
  }
}

export interface ChatSession {
  id: string
  personaId: string
  userId: string
  sessionName?: string
  messages: ChatMessage[]
  context: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
  endedAt?: string
}

export interface PersonaChatConfig {
  personaId: string
  personaName: string
  personaType: string
  personalityTraits: PersonalityTraits
  knowledgeBase?: string[]
  purpose?: string
  productContext?: string
  customPrompt?: string
  contactContext?: ContactContext
  contactQuery?: AIQueryResult
  customPersonaDefinition?: {
    customPersonaName: string
    customPersonaDescription: string
    customRoleDefinition: string
    customResponsibilities: string[]
    customCommunicationGuidelines: string
    customExampleInteractions?: any[]
  }
}

export interface ChatResponse {
  message: string
  messageId: string
  metadata: {
    model: string
    responseTime: number
    tokensUsed?: number
  }
}

const DEFAULT_MODEL =
  (process.env.GOOGLE_GEMINI_MODEL && process.env.GOOGLE_GEMINI_MODEL.trim()) ||
  'gemini-2.5-flash-lite'
const MAX_CONTEXT_MESSAGES = 10 // Keep last 10 messages for context

/**
 * Build system prompt for persona chat
 */
function buildPersonaChatPrompt(config: PersonaChatConfig): string {
  const {
    personaName,
    personaType,
    personalityTraits,
    purpose,
    productContext,
    customPrompt,
    knowledgeBase,
    contactContext,
    contactQuery
  } = config

  const sections: string[] = []

  // Check if custom persona
  const isCustomPersona = personaType === 'custom'

  // Identity
  if (isCustomPersona && config.customPersonaDefinition) {
    // Use custom persona definition
    const customDef = config.customPersonaDefinition
    sections.push(`You are ${personaName}, a ${customDef.customPersonaName}.`)
    sections.push(`\nRole Description:\n${customDef.customPersonaDescription}`)
    sections.push(`\nDetailed Role Definition:\n${customDef.customRoleDefinition}`)

    // Responsibilities
    sections.push(`\nYour Key Responsibilities:`)
    customDef.customResponsibilities.forEach((resp, i) => {
      sections.push(`${i + 1}. ${resp}`)
    })

    // Communication Guidelines
    sections.push(`\nCommunication Guidelines:\n${customDef.customCommunicationGuidelines}`)

    // Example Interactions
    if (customDef.customExampleInteractions && customDef.customExampleInteractions.length > 0) {
      sections.push(`\nExample Interactions:`)
      customDef.customExampleInteractions.forEach((example: any, i: number) => {
        sections.push(`\nExample ${i + 1}: ${example.scenario}`)
        sections.push(`User: ${example.userInput}`)
        sections.push(`You: ${example.expectedResponse}`)
        if (example.notes) {
          sections.push(`Note: ${example.notes}`)
        }
      })
    }
  } else {
    // Standard persona
    sections.push(`You are ${personaName}, a ${personaType.replace(/_/g, ' ')} AI assistant.`)

    // Purpose
    if (purpose) {
      sections.push(`Your purpose: ${purpose}`)
    }
  }

  // Personality
  const personalityInstructions = generatePersonalityPrompt(personalityTraits)
  sections.push(`\nPersonality & Communication Style:\n${personalityInstructions}`)

  // Product context
  if (productContext) {
    sections.push(`\nProduct/Company Context:\n${productContext}`)
  }

  // Custom instructions
  if (customPrompt) {
    sections.push(`\nAdditional Instructions:\n${customPrompt}`)
  }

  if (knowledgeBase && knowledgeBase.length > 0) {
    sections.push(
      `\nPersona Knowledge Base (high priority factual context):\n${
        knowledgeBase
          .map((entry, index) => `${index + 1}. ${entry}`)
          .join('\n')
      }`
    )
  }

  if (contactContext) {
    sections.push(`\nActive Contact Context:\n${formatContactContext(contactContext)}`)
  }

  if (contactQuery && contactQuery.contacts?.length) {
    sections.push(`\nRecent Contact Discovery Results:\n${formatContactQuery(contactQuery)}`)
  }

  // Core guidelines
  sections.push(`
Core Guidelines:
- Stay in character as ${personaName} at all times
- Apply your personality traits consistently
- Reference the product/company context when relevant
- Be helpful, professional, and authentic
- If you don't know something, acknowledge it honestly
- Keep responses focused and valuable`)

  return sections.join('\n\n')
}

function formatContactContext(context: ContactContext): string {
  const lines: string[] = []
  const { contact, engagement, campaigns, recentEmails } = context

  lines.push(`Name: ${contact.fullName}`)
  lines.push(`Email: ${contact.email}`)
  if (contact.company) lines.push(`Company: ${contact.company}`)
  if (contact.position) lines.push(`Role: ${contact.position}`)
  if (contact.source) lines.push(`Source: ${contact.source}`)
  if (contact.linkedinUrl) lines.push(`LinkedIn: ${contact.linkedinUrl}`)
  if (contact.tags?.length) lines.push(`Tags: ${contact.tags.join(', ')}`)
  if (contact.lists?.length) lines.push(`Lists: ${contact.lists.join(', ')}`)
  if (contact.segments?.length) lines.push(`Segments: ${contact.segments.join(', ')}`)
  if (contact.notes) {
    lines.push(`Notes: ${contact.notes}`)
    if (contact.notesUpdatedAt) {
      lines.push(`Notes Updated At: ${contact.notesUpdatedAt}`)
    }
  }
  if (contact.enrichmentStatus) {
    lines.push(`Enrichment Status: ${contact.enrichmentStatus}`)
    if (contact.enrichmentUpdatedAt) {
      lines.push(`Enrichment Updated At: ${contact.enrichmentUpdatedAt}`)
    }
  }

  if (engagement) {
    lines.push('\nEngagement Snapshot:')
    lines.push(`- Status: ${engagement.status ?? 'unknown'} (score ${engagement.score ?? 0})`)
    lines.push(`- Sent: ${engagement.sentCount ?? 0}, Opens: ${engagement.openCount ?? 0}, Clicks: ${engagement.clickCount ?? 0}, Replies: ${engagement.replyCount ?? 0}`)
    if (engagement.bounceCount) {
      lines.push(`- Bounces: ${engagement.bounceCount}`)
    }
    if (engagement.lastPositiveAt) {
      lines.push(`- Last Positive Interaction: ${engagement.lastPositiveAt}`)
    }
  }

  if (campaigns.length) {
    lines.push('\nRecent Campaign Touchpoints (most recent first):')
    campaigns.slice(0, 5).forEach((campaign, index) => {
      lines.push(`${index + 1}. ${campaign.campaignName || campaign.campaignId} – Status: ${campaign.status || 'unknown'} (updated ${campaign.lastUpdatedAt || campaign.createdAt})`)
      if (campaign.personalizedSubject) {
        lines.push(`   Subject: ${campaign.personalizedSubject}`)
      }
      if (campaign.personalizedBodyPreview) {
        lines.push(`   Preview: ${campaign.personalizedBodyPreview}`)
      }
    })
  }

  if (recentEmails.length) {
    lines.push('\nRecent Email Activity (most recent first):')
    recentEmails.slice(0, 5).forEach((email, index) => {
      lines.push(`${index + 1}. Subject: ${email.subject || 'No subject'} – Status: ${email.status || 'unknown'}`)
      const events: string[] = []
      if (email.sentAt) events.push(`sent ${email.sentAt}`)
      if (email.openedAt) events.push(`opened ${email.openedAt}`)
      if (email.clickedAt) events.push(`clicked ${email.clickedAt}`)
      if (email.repliedAt) events.push(`replied ${email.repliedAt}`)
      if (email.bouncedAt) events.push(`bounced ${email.bouncedAt}`)
      if (events.length) {
        lines.push(`   Events: ${events.join(', ')}`)
      }
    })
  }

  return lines.join('\n')
}

function formatContactQuery(result: AIQueryResult): string {
  const lines: string[] = []
  if (result.reasoning) {
    lines.push(`Reasoning: ${result.reasoning}`)
  }
  if (result.contacts?.length) {
    lines.push('Contacts Returned:')
    result.contacts.slice(0, 10).forEach((contact, index) => {
      const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email
      const role = contact.position ? ` – ${contact.position}` : ''
      const company = contact.company ? ` @ ${contact.company}` : ''
      const status = contact.engagement_status ? ` (engagement: ${contact.engagement_status}, score ${contact.engagement_score ?? 0})` : ''
      lines.push(`${index + 1}. ${name}${role}${company}${status}`)
    })
    if (result.contacts.length > 10) {
      lines.push(`...and ${result.contacts.length - 10} more contacts (limited for prompt).`)
    }
  }

  return lines.join('\n')
}

/**
 * Initialize a new chat session
 */
export async function createChatSession(
  supabase: Supabase,
  userId: string,
  personaId: string,
  sessionName?: string
): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabase
      .from('ai_persona_chat_sessions')
      .insert({
        persona_id: personaId,
        user_id: userId,
        session_name: sessionName || `Chat ${new Date().toLocaleDateString()}`,
        messages: [],
        context: {},
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create chat session:', error)
      return null
    }

    return {
      id: data.id,
      personaId: data.persona_id,
      userId: data.user_id,
      sessionName: data.session_name || undefined,
      messages: [],
      context: data.context as Record<string, any>,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      endedAt: data.ended_at || undefined
    }
  } catch (error) {
    console.error('Error creating chat session:', error)
    return null
  }
}

/**
 * Load chat session with message history
 */
export async function loadChatSession(
  supabase: Supabase,
  sessionId: string,
  userId: string
): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabase
      .from('ai_persona_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Failed to load chat session:', error)
      return null
    }

    return {
      id: data.id,
      personaId: data.persona_id,
      userId: data.user_id,
      sessionName: data.session_name || undefined,
      messages: (data.messages as ChatMessage[]) || [],
      context: data.context as Record<string, any>,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      endedAt: data.ended_at || undefined
    }
  } catch (error) {
    console.error('Error loading chat session:', error)
    return null
  }
}

/**
 * Send a message to the persona and get a response
 */
export async function sendChatMessage(
  config: PersonaChatConfig,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  const modelId = DEFAULT_MODEL

  if (!apiKey) {
    console.error('Google Gemini API key not configured')
    return null
  }

  try {
    const startTime = Date.now()

    // Build system prompt
    const systemPrompt = buildPersonaChatPrompt(config)

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelId })

    // Build conversation context
    const contextMessages = conversationHistory
      .slice(-MAX_CONTEXT_MESSAGES) // Keep last N messages
      .map(msg => `${msg.role === 'user' ? 'User' : config.personaName}: ${msg.content}`)
      .join('\n\n')

    // Build full prompt
    const fullPrompt = `${systemPrompt}

Previous conversation:
${contextMessages || 'No previous messages'}

User: ${userMessage}

${config.personaName}:`

    // Generate response
    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    const message = response.text()

    const responseTime = Date.now() - startTime

    return {
      message,
      messageId: crypto.randomUUID(),
      metadata: {
        model: modelId,
        responseTime,
        tokensUsed: undefined // Gemini API doesn't provide this directly
      }
    }
  } catch (error) {
    console.error(`Chat message error using Gemini model "${modelId}":`, error)
    return null
  }
}

/**
 * Save chat message to session
 */
export async function saveChatMessage(
  supabase: Supabase,
  sessionId: string,
  message: ChatMessage
): Promise<boolean> {
  try {
    // Get current session
    const { data: session, error: fetchError } = await supabase
      .from('ai_persona_chat_sessions')
      .select('messages')
      .eq('id', sessionId)
      .single()

    if (fetchError) {
      console.error('Failed to fetch session:', fetchError)
      return false
    }

    // Add message to history
    const messages = (session.messages as ChatMessage[]) || []
    messages.push(message)

    // Update session
    const { error: updateError } = await supabase
      .from('ai_persona_chat_sessions')
      .update({
        messages,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to save message:', updateError)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving chat message:', error)
    return false
  }
}

/**
 * Replace the stored context for a chat session
 */
export async function updateChatSessionContext(
  supabase: Supabase,
  sessionId: string,
  context: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_persona_chat_sessions')
      .update({
        context,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      console.error('Failed to update chat session context:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating chat session context:', error)
    return false
  }
}

/**
 * End a chat session
 */
export async function endChatSession(
  supabase: Supabase,
  sessionId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_persona_chat_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to end chat session:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error ending chat session:', error)
    return false
  }
}

/**
 * List all chat sessions for a persona
 */
export async function listChatSessions(
  supabase: Supabase,
  userId: string,
  personaId?: string,
  activeOnly: boolean = false
): Promise<ChatSession[]> {
  try {
    let query = supabase
      .from('ai_persona_chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (personaId) {
      query = query.eq('persona_id', personaId)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to list chat sessions:', error)
      return []
    }

    return (data || []).map(session => ({
      id: session.id,
      personaId: session.persona_id,
      userId: session.user_id,
      sessionName: session.session_name || undefined,
      messages: (session.messages as ChatMessage[]) || [],
      context: session.context as Record<string, any>,
      isActive: session.is_active,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      endedAt: session.ended_at || undefined
    }))
  } catch (error) {
    console.error('Error listing chat sessions:', error)
    return []
  }
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(
  supabase: Supabase,
  sessionId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_persona_chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to delete chat session:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting chat session:', error)
    return false
  }
}

/**
 * Get chat statistics for a persona
 */
export async function getPersonaChatStats(
  supabase: Supabase,
  personaId: string
): Promise<{
  totalSessions: number
  activeSessions: number
  totalMessages: number
  averageMessagesPerSession: number
} | null> {
  try {
    const { data, error } = await supabase
      .from('ai_persona_chat_sessions')
      .select('messages, is_active')
      .eq('persona_id', personaId)

    if (error) {
      console.error('Failed to get chat stats:', error)
      return null
    }

    const sessions = data || []
    const totalSessions = sessions.length
    const activeSessions = sessions.filter(s => s.is_active).length
    const totalMessages = sessions.reduce((sum, s) => {
      const messages = s.messages as ChatMessage[] || []
      return sum + messages.length
    }, 0)

    return {
      totalSessions,
      activeSessions,
      totalMessages,
      averageMessagesPerSession: totalSessions > 0 ? totalMessages / totalSessions : 0
    }
  } catch (error) {
    console.error('Error getting chat stats:', error)
    return null
  }
}
