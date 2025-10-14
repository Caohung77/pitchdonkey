import { useMemo } from 'react'
import {
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
  type MessageStatus,
  type ThreadMessageLike,
  type ThreadAssistantMessagePart,
  type ThreadUserMessagePart,
  useLocalRuntime
} from '@assistant-ui/react'

import type { ChatMessage } from '@/lib/persona-chat'
import type { ContactContext } from '@/lib/ai-persona-contact-context'
import type { AIQueryResult } from '@/lib/ai-contact-query-service'

export interface PersonaRuntimeCallbacks {
  getSessionId: () => string | null
  setSessionId: (id: string) => void
  consumePendingContactId: () => string | null
  handleContactContext: (context: ContactContext | null) => void
  handleContactQuery: (result: AIQueryResult | null) => void
  shouldFetchContacts?: () => boolean
}

export interface PersonaRuntimeOptions extends PersonaRuntimeCallbacks {
  personaId: string
  initialMessages?: ThreadMessageLike[]
}

export function usePersonaAssistantRuntime({
  personaId,
  initialMessages,
  ...callbacks
}: PersonaRuntimeOptions) {
  const adapter = useMemo(() => new PersonaChatAdapter(personaId, callbacks), [personaId, callbacks])

  return useLocalRuntime(adapter, {
    initialMessages
  })
}

class PersonaChatAdapter implements ChatModelAdapter {
  constructor(
    private readonly personaId: string,
    private readonly callbacks: PersonaRuntimeCallbacks
  ) {}

  async run(options: ChatModelRunOptions): Promise<ChatModelRunResult> {
    const lastUserMessage = [...options.messages].reverse().find(message => message.role === 'user')

    if (!lastUserMessage) {
      return EMPTY_RESULT
    }

    const prompt = extractUserMessageText(lastUserMessage.content as ThreadUserMessagePart[])

    if (!prompt) {
      return EMPTY_RESULT
    }

    const contactId = this.callbacks.consumePendingContactId()
    const fetchContacts = this.callbacks.shouldFetchContacts?.() ?? true

    const response = await fetch(`/api/ai-personas/${this.personaId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: prompt,
        sessionId: this.callbacks.getSessionId() ?? undefined,
        contactId: contactId ?? undefined,
        fetchContacts
      })
    })

    if (!response.ok) {
      throw new Error(`Persona chat failed (${response.status} ${response.statusText})`)
    }

    const payload = await response.json()

    if (!payload.success) {
      throw new Error(payload.error || 'Persona chat failed')
    }

    const data = payload.data as {
      message: string
      messageId: string
      sessionId: string
      metadata?: Record<string, unknown>
      contactContext?: ContactContext | null
      contactQuery?: AIQueryResult | null
    }

    this.callbacks.setSessionId(data.sessionId)
    this.callbacks.handleContactContext(data.contactContext ?? null)
    this.callbacks.handleContactQuery(data.contactQuery ?? null)

    const assistantContent: ThreadAssistantMessagePart = {
      type: 'text',
      text: data.message
    }

    return {
      content: [assistantContent],
      metadata: {
        unstable_state: {
          sessionId: data.sessionId,
          messageId: data.messageId,
          metadata: data.metadata ?? null
        }
      },
      status: COMPLETE_STATUS
    }
  }
}

const COMPLETE_STATUS: MessageStatus = {
  type: 'complete',
  reason: 'stop'
}

const EMPTY_RESULT: ChatModelRunResult = {
  content: [],
  status: COMPLETE_STATUS
}

function extractUserMessageText(parts: ThreadUserMessagePart[]): string {
  const chunks = parts
    .filter(part => part.type === 'text')
    .map(part => part.text.trim())
    .filter(Boolean)

  return chunks.join('\n').trim()
}

export function toThreadMessages(messages: ChatMessage[]): ThreadMessageLike[] {
  return messages.map(message => {
    const base = {
      id: message.id,
      createdAt: new Date(message.timestamp)
    }

    if (message.role === 'user') {
      return {
        ...base,
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: message.content
          }
        ]
      }
    }

    return {
      ...base,
      role: 'assistant' as const,
      content: [
        {
          type: 'text' as const,
          text: message.content
        }
      ],
      status: COMPLETE_STATUS
    }
  })
}
