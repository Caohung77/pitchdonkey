'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { Loader2, Search, Sparkles, User, Mail, MapPin, Building, X } from 'lucide-react'

import { ApiClient } from '@/lib/api-client'
import type { AIPersona } from '@/lib/ai-personas'
import type { Contact } from '@/lib/contacts'
import type { ContactContext } from '@/lib/ai-persona-contact-context'
import type { AIQueryResult } from '@/lib/ai-contact-query-service'
import type { ChatMessage } from '@/lib/persona-chat'
import {
  toThreadMessages,
  usePersonaAssistantRuntime,
  type PersonaRuntimeCallbacks
} from '@/lib/persona-assistant-runtime'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

interface ContactDisplayCard {
  id: string
  name: string
  email: string
  company?: string | null
  position?: string | null
  tags: string[]
}

export default function PersonaChatPage() {
  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)

  const [initialMessages, setInitialMessages] = useState<ReturnType<typeof toThreadMessages> | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [runtimeRevision, setRuntimeRevision] = useState(0)

  const [activeContact, setActiveContact] = useState<ContactContext | null>(null)
  const [contactQueryResult, setContactQueryResult] = useState<AIQueryResult | null>(null)

  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [contactSearchResults, setContactSearchResults] = useState<Contact[]>([])
  const [isSearchingContacts, setIsSearchingContacts] = useState(false)

  const [pendingContact, setPendingContact] = useState<Contact | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const pendingContactRef = useRef<Contact | null>(null)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    pendingContactRef.current = pendingContact
  }, [pendingContact])

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

  // Load session when persona changes
  useEffect(() => {
    if (!selectedPersonaId) return

    let isCancelled = false

    async function loadSession() {
      setInitialMessages(null)
      setSessionId(null)
      setActiveContact(null)
      setContactQueryResult(null)
      setPendingContact(null)
      pendingContactRef.current = null

      try {
        const response = await ApiClient.get(`/api/ai-personas/${selectedPersonaId}/chat`)
        if (!response.success) throw new Error(response.error || 'Failed to load chat session')

        if (isCancelled) return

        const session = response.data as PersonaChatSession | null
        if (session) {
          const threads = toThreadMessages(session.messages)
          setInitialMessages(threads)
          setSessionId(session.sessionId)

          const activeSnapshot = session.context?.activeContact?.snapshot as ContactContext | undefined
          if (activeSnapshot) {
            setActiveContact(activeSnapshot)
          }
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

  // Contact search debounce
  useEffect(() => {
    if (contactSearchTerm.trim().length < 2) {
      setContactSearchResults([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        setIsSearchingContacts(true)
        const response = await ApiClient.get(
          `/api/contacts?limit=6&search=${encodeURIComponent(contactSearchTerm.trim())}`
        )
        if (response.success) {
          const data = response.data as ContactSearchResponse
          setContactSearchResults(data.contacts || [])
        } else {
          throw new Error(response.error || 'Failed to search contacts')
        }
      } catch (error) {
        console.error('Contact search failed', error)
        toast.error(error instanceof Error ? error.message : 'Failed to search contacts')
      } finally {
        setIsSearchingContacts(false)
      }
    }, 350)

    return () => clearTimeout(timeout)
  }, [contactSearchTerm])

  const handleSelectContact = useCallback((contact: Contact) => {
    setPendingContact(contact)
  }, [])

  const clearPendingContact = useCallback(() => {
    setPendingContact(null)
  }, [])

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

  const consumePendingContactId = useCallback(() => pendingContactRef.current?.id ?? null, [])

  const handleContactContext = useCallback((context: ContactContext | null) => {
    setActiveContact(context)
    if (context) {
      pendingContactRef.current = null
      setPendingContact(null)
    }
  }, [])

  const handleContactQuery = useCallback((result: AIQueryResult | null) => {
    setContactQueryResult(result)
  }, [])

  const runtimeCallbacks = useMemo<PersonaRuntimeCallbacks>(
    () => ({
      getSessionId,
      setSessionId: setSessionIdFromRuntime,
      consumePendingContactId,
      handleContactContext,
      handleContactQuery,
      shouldFetchContacts: () => true
    }),
    [
      getSessionId,
      setSessionIdFromRuntime,
      consumePendingContactId,
      handleContactContext,
      handleContactQuery
    ]
  )

  const runtimeReady = selectedPersonaId && initialMessages !== null

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Persona Chat</h1>
          <p className="max-w-2xl text-sm text-gray-500">
            Talk with any active AI persona, attach contacts for full context, and review suggested
            leads—all without leaving this screen.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Personas
          </span>
          <span className="text-xs text-gray-400">
            {isLoadingPersonas ? 'Loading…' : `${personas.length} available`}
          </span>
        </div>
        {isLoadingPersonas ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        ) : personas.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-sm text-gray-500">
            No active personas with chat enabled yet.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {personas.map(persona => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isActive={persona.id === selectedPersonaId}
                onSelect={() => setSelectedPersonaId(persona.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.9fr)]">
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
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">Active contact</CardTitle>
              <p className="text-sm text-gray-500">
                Attach a contact to give the persona full history context.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts by name, email, company..."
                  value={contactSearchTerm}
                  onChange={event => setContactSearchTerm(event.target.value)}
                  className="pl-10 rounded-xl border-gray-200"
                />
                {isSearchingContacts && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-blue-500" />
                )}
              </div>

              {contactSearchResults.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-2">
                  {contactSearchResults.map(contact => {
                    const name =
                      [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email

                    return (
                      <button
                        key={contact.id}
                        onClick={() => handleSelectContact(contact)}
                        className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-white px-3 py-2 text-left text-sm transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <Avatar className="h-9 w-9 bg-blue-100 text-blue-700 font-semibold">
                          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{name}</span>
                          <span className="text-xs text-gray-500">{contact.email}</span>
                        </div>
                        <Badge variant="outline" className="ml-auto">
                          Select
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              )}

              <ActiveContactCard
                activeContact={activeContact}
                pendingContact={pendingContact}
                onClearPending={clearPendingContact}
              />
            </CardContent>
          </Card>

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

function PersonaCard({
  persona,
  isActive,
  onSelect
}: {
  persona: AIPersona
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border px-4 py-3 transition ${
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
      <div className="flex flex-col text-left">
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
}

function ActiveContactCard({
  activeContact,
  pendingContact,
  onClearPending
}: {
  activeContact: ContactContext | null
  pendingContact: Contact | null
  onClearPending: () => void
}) {
  const pendingDisplay = pendingContact ? contactToDisplay(pendingContact) : null
  const activeDisplay = activeContact ? contactContextToDisplay(activeContact) : null

  if (!pendingDisplay && !activeDisplay) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-gray-500">
        <User className="h-10 w-10 text-gray-300" />
        <p className="text-sm">No contact attached yet. Search and select someone to give the persona full context.</p>
      </div>
    )
  }

  const display = pendingDisplay ?? activeDisplay!
  const isPending = !!pendingDisplay

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 bg-blue-100 text-blue-700 font-semibold">
          <AvatarFallback>{display.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{display.name}</span>
          <span className="text-sm text-gray-500">{display.email}</span>
        </div>
        {isPending ? (
          <Badge variant="secondary" className="ml-auto bg-amber-100 text-amber-700">
            Pending
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto">
            Attached
          </Badge>
        )}
      </div>
      <div className="space-y-2 text-sm text-gray-600">
        {display.company ? (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-400" />
            <span>
              {display.position ? `${display.position} · ` : ''}
              {display.company}
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <span>{display.email}</span>
        </div>
        {display.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {display.tags.slice(0, 4).map(tag => (
              <Badge key={tag} variant="outline" className="bg-gray-50">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {isPending ? (
        <Button variant="ghost" size="sm" onClick={onClearPending} className="text-gray-500 hover:text-gray-700">
          <X className="mr-1 h-4 w-4" />
          Cancel pending contact
        </Button>
      ) : null}
    </div>
  )
}

function contactToDisplay(contact: Contact): ContactDisplayCard {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email
  return {
    id: contact.id,
    name,
    email: contact.email,
    company: contact.company,
    position: contact.position,
    tags: contact.tags || []
  }
}

function contactContextToDisplay(context: ContactContext): ContactDisplayCard {
  const name = context.contact.fullName || context.contact.email
  return {
    id: context.contact.id,
    name,
    email: context.contact.email,
    company: context.contact.company,
    position: context.contact.position,
    tags: context.contact.tags || []
  }
}

function ContactPreviewCard({ contact }: { contact: Contact }) {
  const display = contactToDisplay(contact)
  const location = [contact.city, contact.country].filter(Boolean).join(', ')

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 bg-gradient-to-br from-blue-100 to-purple-100 text-blue-700 font-semibold">
          <AvatarFallback>{display.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900">{display.name}</span>
          <span className="text-xs text-gray-500">{display.email}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {display.company ? (
          <span className="inline-flex items-center gap-1">
            <Building className="h-3 w-3" />
            {display.company}
          </span>
        ) : null}
        {location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {location}
          </span>
        ) : null}
      </div>
    </div>
  )
}
