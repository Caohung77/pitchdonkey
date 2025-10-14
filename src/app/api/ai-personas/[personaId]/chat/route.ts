import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { getAIPersona } from '@/lib/ai-personas'
import {
  createChatSession,
  loadChatSession,
  listChatSessions,
  sendChatMessage,
  saveChatMessage,
  updateChatSessionContext,
  type ChatMessage,
  type PersonaChatConfig
} from '@/lib/persona-chat'
import {
  buildContactContext,
  runPersonaContactQuery,
  type ContactContext
} from '@/lib/ai-persona-contact-context'

const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  contactId: z.string().uuid().optional().nullable(),
  fetchContacts: z.boolean().optional()
})

export const GET = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  context: { params: Promise<{ personaId: string }> }
) => {
  try {
    await withRateLimit(user, 30, 60000)

    const { personaId } = await context.params

    const persona = await getAIPersona(supabase, user.id, personaId)
    if (!persona) {
      return NextResponse.json(
        { success: false, error: 'AI persona not found' },
        { status: 404 }
      )
    }

    if (!persona.chat_enabled) {
      return NextResponse.json(
        { success: false, error: 'Chat is not enabled for this persona' },
        { status: 403 }
      )
    }

    const sessions = await listChatSessions(supabase, user.id, personaId)
    const session = sessions[0] || null

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: session
          ? {
              sessionId: session.id,
              messages: session.messages,
              context: session.context,
              updatedAt: session.updatedAt
            }
          : null
      })
    )
  } catch (error) {
    console.error('GET /api/ai-personas/[personaId]/chat error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load chat session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

async function loadPersonaKnowledgeSummary(
  supabase: any,
  userId: string,
  personaId: string
): Promise<string[] | undefined> {
  try {
    const { data, error } = await supabase
      .from('ai_persona_knowledge')
      .select('type,title,description,content,url,storage_path,embedding_status')
      .eq('persona_id', personaId)
      .eq('user_id', userId)
      .or('embedding_status.eq.ready,embedding_status.is.null')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Failed to load persona knowledge summary:', error)
      return undefined
    }

    if (!data || data.length === 0) {
      return undefined
    }

    const entries = data
      .map(formatKnowledgeEntry)
      .filter((entry): entry is string => Boolean(entry))

    return entries.length > 0 ? entries : undefined
  } catch (error) {
    console.error('Unexpected error loading persona knowledge summary:', error)
    return undefined
  }
}

function formatKnowledgeEntry(item: {
  type: string
  title?: string | null
  description?: string | null
  content?: string | null
  url?: string | null
  storage_path?: string | null
}): string | null {
  const parts: string[] = []

  if (item.title?.trim()) {
    parts.push(item.title.trim())
  }

  if (item.description?.trim()) {
    parts.push(item.description.trim())
  }

  const normalizedType = item.type.toLowerCase()
  if (normalizedType === 'text' || normalizedType === 'html' || normalizedType === 'doc') {
    if (item.content?.trim()) {
      parts.push(truncate(item.content.trim(), 400))
    }
  } else if (normalizedType === 'link') {
    if (item.url?.trim()) {
      parts.push(`Link: ${item.url.trim()}`)
    }
  } else if (normalizedType === 'pdf') {
    const location = item.url?.trim() || item.storage_path?.trim()
    if (location) {
      parts.push(`PDF: ${location}`)
    }
  }

  if (parts.length === 0) {
    return null
  }

  return parts.join(' — ')
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength).trimEnd()}…`
}

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  context: { params: Promise<{ personaId: string }> }
) => {
  try {
    const { personaId } = await context.params

    await withRateLimit(user, 30, 60000) // 30 messages per minute

    const body = await request.json()
    const { message, sessionId, contactId, fetchContacts } = chatMessageSchema.parse(body)

    // Get persona
    const persona = await getAIPersona(supabase, user.id, personaId)
    if (!persona) {
      return NextResponse.json(
        { success: false, error: 'AI persona not found' },
        { status: 404 }
      )
    }

    if (!persona.chat_enabled) {
      return NextResponse.json(
        { success: false, error: 'Chat is not enabled for this persona' },
        { status: 403 }
      )
    }

    const knowledgeBase = await loadPersonaKnowledgeSummary(supabase, user.id, personaId)

    // Load or create session
    let session = sessionId
      ? await loadChatSession(supabase, sessionId, user.id)
      : null

    if (!session) {
      session = await createChatSession(supabase, user.id, personaId)
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Failed to create chat session' },
          { status: 500 }
        )
      }
    }

    // Track conversation state locally for prompt building
    const history = session.messages ? [...session.messages] : []

    let activeContact: ContactContext | null = null
    let finalSessionContext = { ...(session.context || {}) }

    if (contactId) {
      activeContact = await buildContactContext(supabase, user.id, contactId)
      if (activeContact) {
        finalSessionContext = {
          ...finalSessionContext,
          activeContact: {
            contactId,
            snapshot: activeContact
          }
        }
        await updateChatSessionContext(supabase, session.id, finalSessionContext)
      }
    } else if (contactId === null) {
      if ('activeContact' in finalSessionContext) {
        delete finalSessionContext.activeContact
        await updateChatSessionContext(supabase, session.id, finalSessionContext)
      }
    } else if (finalSessionContext.activeContact?.contactId) {
      activeContact = finalSessionContext.activeContact.snapshot as ContactContext
    }

    // Save user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }

    await saveChatMessage(supabase, session.id, userMessage)
    history.push(userMessage)

    // Optionally run contact discovery for list queries
    const contactQueryResult = fetchContacts === false
      ? null
      : await runPersonaContactQuery(supabase, user.id, persona.id, message)

    // Build persona config
    const config: PersonaChatConfig = {
      personaId: persona.id,
      personaName: persona.sender_name || persona.name,
      personaType: persona.persona_type,
      personalityTraits: persona.personality_traits,
      purpose: persona.purpose || undefined,
      productContext: [
        persona.product_one_liner,
        persona.product_description
      ].filter(Boolean).join('\n\n'),
      customPrompt: persona.custom_prompt || undefined,
      knowledgeBase,
      contactContext: activeContact || undefined,
      contactQuery: contactQueryResult || undefined,
      // Include custom persona definition if it's a custom persona
      customPersonaDefinition: persona.persona_type === 'custom' && persona.custom_persona_name ? {
        customPersonaName: persona.custom_persona_name,
        customPersonaDescription: persona.custom_persona_description || '',
        customRoleDefinition: persona.custom_role_definition || '',
        customResponsibilities: persona.custom_responsibilities || [],
        customCommunicationGuidelines: persona.custom_communication_guidelines || '',
        customExampleInteractions: persona.custom_example_interactions || []
      } : undefined
    }

    // Get AI response
    const response = await sendChatMessage(config, message, history)

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate response' },
        { status: 500 }
      )
    }

    // Save assistant message with contact query metadata
    const assistantMessage: ChatMessage = {
      id: response.messageId,
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString(),
      metadata: {
        ...response.metadata,
        contactQuery: contactQueryResult || undefined,
        personaId: persona.id,
        userQuery: message
      }
    }

    await saveChatMessage(supabase, session.id, assistantMessage)
    history.push(assistantMessage)

    // Update persona stats
    await supabase
      .from('ai_personas')
      .update({
        total_chats: persona.total_chats + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', personaId)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          message: response.message,
          messageId: response.messageId,
          sessionId: session.id,
          metadata: response.metadata,
          contactContext: activeContact || null,
          contactQuery: contactQueryResult
        }
      })
    )
  } catch (error) {
    console.error('POST /api/ai-personas/[personaId]/chat error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.flatten()
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
