'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Contact } from '@/lib/contacts'
import { Loader2, Mail, Reply, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ContactEmailsTabProps {
  contact?: Contact
  contactId?: string
}

interface TimelineMessage {
  id: string
  direction: 'inbound' | 'outbound'
  source: 'incoming' | 'outgoing' | 'campaign'
  subject: string | null
  preview: string | null
  timestamp: string
  from_address: string | null
  to_address: string | null
  thread_id: string | null
  message_id: string | null
  email_account?: {
    id: string
    email: string | null
  } | null
}

const directionMeta: Record<TimelineMessage['direction'], { label: string; icon: JSX.Element; color: string }> = {
  inbound: {
    label: 'Received',
    icon: <Reply className="h-3.5 w-3.5" />,
    color: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  outbound: {
    label: 'Sent',
    icon: <Send className="h-3.5 w-3.5" />,
    color: 'bg-sky-100 text-sky-700 border border-sky-200',
  },
}

const sourceMeta: Record<TimelineMessage['source'], { label: string; tone: string }> = {
  incoming: { label: 'Inbox', tone: 'text-emerald-600' },
  outgoing: { label: 'Mailbox', tone: 'text-sky-600' },
  campaign: { label: 'Campaign', tone: 'text-violet-600' },
}

const formatTimestamp = (iso: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function ContactEmailsTab({ contact, contactId }: ContactEmailsTabProps) {
  const id = contactId || contact?.id
  const email = contact?.email || ''

  const [messages, setMessages] = useState<TimelineMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('No contact ID provided')
      return
    }

    let mounted = true

    const fetchMessages = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/contacts/${id}/emails`)
        const payload = await response.json().catch(() => null)

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to load conversation history')
        }

        if (mounted) {
          setMessages(payload.data?.messages || [])
        }
      } catch (err) {
        console.error('Failed to fetch contact emails:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load conversation history')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchMessages()
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center text-slate-500">
        <Loader2 className="mb-3 h-6 w-6 animate-spin" />
        <p className="text-sm font-medium">Loading email history…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold">Unable to load conversation</p>
        <p className="mt-2 text-rose-600/80">{error}</p>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center text-slate-500">
        <Mail className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium">No emails linked to this contact yet</p>
        <p className="mt-2 max-w-md text-center text-xs text-slate-400">
          Once emails are synced or sent through the mailbox, the full conversation history will appear here.
        </p>
        <Link
          href="/dashboard/mailbox"
          className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-500"
        >
          Open Mailbox
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Showing {messages.length} message{messages.length === 1 ? '' : 's'}{email && (
          <>
            {' '}exchanged with <span className="font-semibold text-slate-800">{email}</span>
          </>
        )}
      </div>

      <ol className="relative border-l border-slate-200 pl-6">
        {messages.map((message, index) => {
          const direction = directionMeta[message.direction]
          const source = sourceMeta[message.source]
          const isLast = index === messages.length - 1

          return (
            <li key={message.id} className="mb-8">
              <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full bg-white">
                {direction.icon}
              </span>
              {!isLast && (
                <span className="absolute -left-[1px] top-6 h-full w-[2px] bg-slate-200" aria-hidden />
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={direction.color}>{direction.label}</Badge>
                  <span className={`text-[11px] font-medium uppercase tracking-wide ${source.tone}`}>
                    {source.label}
                  </span>
                  <span className="text-xs text-slate-400">{formatTimestamp(message.timestamp)}</span>
                  {message.email_account?.email && (
                    <span className="text-xs text-slate-500">
                      via {message.email_account.email}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  {message.subject || '(No subject)'}
                </h3>

                <p className="mt-2 text-xs text-slate-500">
                  {message.direction === 'inbound'
                    ? `From ${message.from_address || 'Unknown sender'}`
                    : `To ${message.to_address || email || 'Unknown recipient'}`}
                </p>

                {message.preview && (
                  <p className="mt-3 text-sm text-slate-600">
                    {message.preview}
                    {message.preview.length >= 400 && '…'}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
