import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { getAIPersona } from '@/lib/ai-personas'
import {
  createChatSession,
  loadChatSession,
  sendChatMessage,
  saveChatMessage,
  type ChatMessage,
  type PersonaChatConfig
} from '@/lib/persona-chat'

const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional()
})

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase, params }: { user: any; supabase: any; params: { personaId: string } }
) => {
  try {
    await withRateLimit(user, 30, 60000) // 30 messages per minute

    const body = await request.json()
    const { message, sessionId } = chatMessageSchema.parse(body)

    // Get persona
    const persona = await getAIPersona(supabase, user.id, params.personaId)
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

    // Load or create session
    let session = sessionId
      ? await loadChatSession(supabase, sessionId, user.id)
      : null

    if (!session) {
      session = await createChatSession(supabase, user.id, params.personaId)
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Failed to create chat session' },
          { status: 500 }
        )
      }
    }

    // Save user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }

    await saveChatMessage(supabase, session.id, userMessage)

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
    const response = await sendChatMessage(config, message, session.messages)

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate response' },
        { status: 500 }
      )
    }

    // Save assistant message
    const assistantMessage: ChatMessage = {
      id: response.messageId,
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString(),
      metadata: response.metadata
    }

    await saveChatMessage(supabase, session.id, assistantMessage)

    // Update persona stats
    await supabase
      .from('ai_personas')
      .update({
        total_chats: persona.total_chats + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', params.personaId)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          message: response.message,
          messageId: response.messageId,
          sessionId: session.id,
          metadata: response.metadata
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
