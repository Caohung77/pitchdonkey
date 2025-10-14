'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { Loader2, Sparkles } from 'lucide-react'

import { ApiClient } from '@/lib/api-client'
import type { AIPersona } from '@/lib/ai-personas'
import type { Contact } from '@/lib/contacts'
import type { AIQueryResult } from '@/lib/ai-contact-query-service'
import type { ChatMessage } from '@/lib/persona-chat'
import {
  toThreadMessages,
  usePersonaAssistantRuntime,
  type PersonaRuntimeCallbacks
} from '@/lib/persona-assistant-runtime'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Thread } from '@/components/assistant-ui/Thread'

interface PersonaChatSession {
  sessionId: string
  messages: ChatMessage[]
  context?: Record<string, any>
}

interface ContactSearchResponse {
  contacts: Contact[]
  total: number
  page: number
  limit: number
}

export default function PersonaChatPage() {
  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)

  const [initialMessages, setInitialMessages] = useState<ReturnType<typeof toThreadMessages> | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [runtimeRevision, setRuntimeRevision] = useState(0)

  const [contactQueryResult, setContactQueryResult] = useState<AIQueryResult | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Load personas on mount
  useEffect(() => {
    async function loadPersonas() {
      try {
        const response = await ApiClient.get('/api/ai-personas?status=active&chat_enabled=true')
        if (!response.success) throw new Error(response.error || 'Failed to load personas')
        const data: AIPersona[] = response.data || []
        setPersonas(data)
        if (data.length > 0) {
          setSelectedPersonaId(data[0].id)
        }
      } catch (error) {
        console.error('Failed to load personas', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load personas')
      } finally {
        setIsLoadingPersonas(false)
      }
    }

    loadPersonas()
  }, [])

  // Load chat session when persona changes
  useEffect(() => {
    if (!selectedPersonaId) return

    let isCancelled = false

    async function loadSession() {
      setInitialMessages(null)
      setSessionId(null)
      setContactQueryResult(null)

      try {
        const response = await ApiClient.get(`/api/ai-personas/${selectedPersonaId}/chat`)
        if (!response.success) throw new Error(response.error || 'Failed to load chat session')

        if (isCancelled) return

        const session = response.data as PersonaChatSession | null
        if (session) {
          setInitialMessages(toThreadMessages(session.messages))
          setSessionId(session.sessionId)
        } else {
          setInitialMessages([])
        }

        setRuntimeRevision(prev => prev + 1)
      } catch (error) {
        console.error('Failed to load chat session', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load chat session')
        setInitialMessages([])
        setRuntimeRevision(prev => prev + 1)
      }
    }

    loadSession()

    return () => {
      isCancelled = true
    }
  }, [selectedPersonaId])

  const personaLookup = useMemo(
    () =>
      personas.reduce<Record<string, AIPersona>>((acc, persona) => {
        acc[persona.id] = persona
        return acc
      }, {}),
    [personas]
  )

  const currentPersona = selectedPersonaId ? personaLookup[selectedPersonaId] : null

  const getSessionId = useCallback(() => sessionIdRef.current, [])
  const setSessionIdFromRuntime = useCallback((id: string) => {
    sessionIdRef.current = id
    setSessionId(id)
  }, [])

  const handleContactQuery = useCallback((result: AIQueryResult | null) => {
    setContactQueryResult(result)
  }, [])

  const runtimeCallbacks = useMemo<PersonaRuntimeCallbacks>(
    () => ({
      getSessionId,
      setSessionId: setSessionIdFromRuntime,
      consumePendingContactId: () => null,
      handleContactContext: () => {},
      handleContactQuery,
      shouldFetchContacts: () => true
    }),
    [getSessionId, setSessionIdFromRuntime, handleContactQuery]
  )

  const runtimeReady = selectedPersonaId && initialMessages !== null

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Persona Chat</h1>
          <p className="max-w-2xl text-sm text-gray-500">
            Talk with any active AI persona and let it search contacts and campaigns directly from the database.
          </p>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(260px,0.85fr)]">
        <Card className="flex min-h-0 flex-col border border-gray-100 shadow-sm">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-white via-blue-50/50 to-white">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            {runtimeReady ? (
              <PersonaChatThread
                key={`${selectedPersonaId}-${runtimeRevision}`}
                personaId={selectedPersonaId!}
                initialMessages={initialMessages ?? []}
                runtimeCallbacks={runtimeCallbacks}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading conversation…
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <PersonaSelectorCard
            personas={personas}
            isLoading={isLoadingPersonas}
            selectedPersonaId={selectedPersonaId}
            onSelect={setSelectedPersonaId}
          />

          {contactQueryResult?.contacts?.length ? (
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Suggested contacts
                </CardTitle>
                {contactQueryResult.reasoning ? (
                  <p className="text-xs leading-relaxed text-gray-500">
                    {contactQueryResult.reasoning}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3">
                  {contactQueryResult.contacts.slice(0, 6).map(contact => (
                    <ContactPreviewCard key={contact.id} contact={contact} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PersonaChatThread({
  personaId,
  initialMessages,
  runtimeCallbacks
}: {
  personaId: string
  initialMessages: ReturnType<typeof toThreadMessages>
  runtimeCallbacks: PersonaRuntimeCallbacks
}) {
  const runtime = usePersonaAssistantRuntime({
    personaId,
    initialMessages,
    ...runtimeCallbacks
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        welcome={
          <div className="w-full max-w-xl space-y-2 text-center text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">Start a conversation</h2>
            <p className="text-sm">
              Ask about campaigns, contact history, or anything your persona knows.
            </p>
          </div>
        }
      />
    </AssistantRuntimeProvider>
  )
}

function PersonaSelectorCard({
  personas,
  isLoading,
  selectedPersonaId,
  onSelect
}: {
  personas: AIPersona[]
  isLoading: boolean
  selectedPersonaId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
          <span>Personas</span>
          <span>{isLoading ? 'Loading…' : `${personas.length} available`}</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-5">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        ) : personas.length === 0 ? (
          <div className="py-4 text-sm text-gray-500">No active personas with chat enabled yet.</div>
        ) : (
          <div className="space-y-3">
            {personas.map(persona => {
              const isActive = persona.id === selectedPersonaId
              return (
                <button
                  key={persona.id}
                  onClick={() => onSelect(persona.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-transparent bg-white hover:border-blue-200 hover:bg-blue-50/60'
                  }`}
                >
                  <Avatar className="h-11 w-11 ring-2 ring-offset-1 ring-blue-100">
                    {persona.avatar_url ? (
                      <AvatarImage src={persona.avatar_url} alt={persona.name} />
                    ) : (
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                        {persona.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{persona.name}</span>
                    <span className="text-xs text-gray-500 capitalize">
                      {persona.persona_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {isActive && (
                    <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700">
                      Active
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ContactPreviewCard({ contact }: { contact: Contact }) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email
  const location = [contact.city, contact.country].filter(Boolean).join(', ')

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 bg-gradient-to-br from-blue-100 to-purple-100 text-blue-700 font-semibold">
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900">{name}</span>
          <span className="text-xs text-gray-500">{contact.email}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {contact.company ? <span>{contact.company}</span> : null}
        {location ? <span>{location}</span> : null}
      </div>
    </div>
  )
}
