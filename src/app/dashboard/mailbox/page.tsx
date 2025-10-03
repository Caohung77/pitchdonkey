'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Inbox,
  Send,
  RefreshCw,
  Mail,
  Search,
  Settings,
  ChevronRight,
  CircleDot,
  Trash2,
  Reply,
  CornerUpRight,
  PenSquare,
  Menu,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmailRichTextEditor } from '@/components/ui/EmailRichTextEditor'
import { MailboxToolbar } from '../../../components/mailbox/MailboxToolbar'

interface EmailAccount {
  id: string
  email: string
  provider: string
}

interface Campaign {
  id: string
  name: string
}

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

interface IncomingEmail {
  id: string
  from_address: string
  to_address?: string | null
  subject: string | null
  date_received: string
  classification_status: 'unclassified' | 'bounce' | 'auto_reply' | 'human_reply' | 'unsubscribe' | 'spam'
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  text_content: string | null
  html_content: string | null
  ai_summary?: EmailInsight | null
  email_accounts: EmailAccount
  email_replies?: Array<{
    campaigns: Campaign | null
    contacts: Contact | null
  }>
}

interface SentEmail {
  id: string
  subject: string
  content: string
  send_status: string
  sent_at: string | null
  created_at: string | null
  email_accounts: EmailAccount
  contacts: Contact | null
  campaigns: Campaign | null
}

type MailboxSelection =
  | { type: 'inbox'; email: IncomingEmail }
  | { type: 'outbox'; email: SentEmail }

type MailboxTarget = {
  key: string
  accountId: string | null
  folder: 'inbox' | 'outbox'
}

interface EmailInsight {
  sender_name: string
  sender_email: string
  subject: string
  firstliner: string
  summary: string
  intent: string
  contact_status: 'green' | 'yellow' | 'red'
}

const INTENT_META: Record<string, { label: string; icon: string; color: string }> = {
  purchase_interest: { label: 'Purchase Interest', icon: '💰', color: 'bg-emerald-100 text-emerald-700' },
  meeting_request: { label: 'Meeting Request', icon: '📅', color: 'bg-blue-100 text-blue-700' },
  info_request: { label: 'Info Request', icon: '❓', color: 'bg-sky-100 text-sky-700' },
  positive_reply: { label: 'Positive Reply', icon: '✨', color: 'bg-indigo-100 text-indigo-700' },
  negative_reply: { label: 'Negative Reply', icon: '⚠️', color: 'bg-rose-100 text-rose-700' },
  unsubscribe: { label: 'Unsubscribe', icon: '🚫', color: 'bg-rose-100 text-rose-700' },
  auto_reply: { label: 'Auto Reply', icon: '🤖', color: 'bg-slate-100 text-slate-600' },
  other: { label: 'Other', icon: '📨', color: 'bg-slate-100 text-slate-600' },
}

const STATUS_META: Record<'green' | 'yellow' | 'red', { label: string; className: string }> = {
  green: { label: 'Engaged', className: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30' },
  yellow: { label: 'Neutral', className: 'bg-amber-500/10 text-amber-700 border border-amber-500/30' },
  red: { label: 'At Risk', className: 'bg-rose-500/10 text-rose-700 border border-rose-500/30' },
}

const parseMailboxKey = (key: string): MailboxTarget => {
  const [accountToken, folderToken] = key.split(':')
  return {
    key,
    accountId: accountToken === 'all' ? null : accountToken,
    folder: folderToken === 'outbox' ? 'outbox' : 'inbox',
  }
}

const extractEmailAddress = (value?: string | null): string | null => {
  if (!value) return null
  const angle = value.match(/<([^>]+)>/)
  if (angle) return angle[1].trim()
  const simple = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return simple ? simple[0] : value.trim()
}

const buildQuoteBlock = (html: string, sender: string, timestamp: string) => {
  return `
<div style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 20px 0; color: #6b7280;">
  <p style="font-weight: 600; margin-bottom: 8px;">
    On ${new Date(timestamp).toLocaleString()} ${sender} wrote:
  </p>
  <div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${html}</div>
</div>`
}

const textToHtml = (text: string) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const getContactDisplayName = (contact: Contact | null | undefined) => {
  if (!contact) return null
  if (contact.first_name || contact.last_name) {
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
  }
  return contact.email
}

const deriveNameFromEmail = (email?: string | null) => {
  if (!email) return 'Mailbox User'
  const local = email.split('@')[0] || ''
  if (!local) return email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || email
}

const getInitialFromText = (value?: string | null) => {
  if (!value) return 'M'
  const trimmed = value.trim()
  if (!trimmed) return 'M'
  return trimmed.charAt(0).toUpperCase()
}

export default function MailboxPage() {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [selectedMailboxKey, setSelectedMailboxKey] = useState<string>('all:inbox')
  const mailboxTarget = useMemo(() => parseMailboxKey(selectedMailboxKey), [selectedMailboxKey])

  const [searchTerm, setSearchTerm] = useState('')
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'unclassified' | 'human_reply' | 'bounce' | 'auto_reply' | 'spam' | 'unsubscribe'>('all')
  const [loadingList, setLoadingList] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')

  const [inboxEmails, setInboxEmails] = useState<IncomingEmail[]>([])
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])
  const [selectedItem, setSelectedItem] = useState<MailboxSelection | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMode, setComposeMode] = useState<'reply' | 'forward' | 'new'>('reply')
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeAccountId, setComposeAccountId] = useState<string | null>(null)
  const [composeSending, setComposeSending] = useState(false)
  const [composeError, setComposeError] = useState('')

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [emailInsights, setEmailInsights] = useState<Record<string, EmailInsight>>({})

  useEffect(() => {
    fetchEmailAccounts()
  }, [])

  useEffect(() => {
    const { accountId, folder } = mailboxTarget
    if (folder === 'inbox') {
      fetchInboxEmails(accountId)
    } else {
      fetchSentEmails(accountId)
    }
  }, [mailboxTarget, classificationFilter, searchTerm])

  useEffect(() => {
    const { folder } = mailboxTarget
    if (folder === 'inbox') {
      if (inboxEmails.length === 0) {
        if (selectedItem?.type === 'inbox') {
          setSelectedItem(null)
        }
      } else {
        if (!selectedItem || selectedItem.type !== 'inbox') {
          setSelectedItem({ type: 'inbox', email: inboxEmails[0] })
        } else {
          const updated = inboxEmails.find(e => e.id === selectedItem.email.id)
          if (updated) {
            setSelectedItem({ type: 'inbox', email: updated })
          } else {
            setSelectedItem({ type: 'inbox', email: inboxEmails[0] })
          }
        }
      }
    } else {
      if (sentEmails.length === 0) {
        if (selectedItem?.type === 'outbox') {
          setSelectedItem(null)
        }
      } else {
        if (!selectedItem || selectedItem.type !== 'outbox') {
          setSelectedItem({ type: 'outbox', email: sentEmails[0] })
        } else {
          const updated = sentEmails.find(e => e.id === selectedItem.email.id)
          if (updated) {
            setSelectedItem({ type: 'outbox', email: updated })
          } else {
            setSelectedItem({ type: 'outbox', email: sentEmails[0] })
          }
        }
      }
    }
  }, [mailboxTarget, inboxEmails, sentEmails])

  const fetchEmailAccounts = async () => {
    try {
      const response = await fetch('/api/inbox/email-accounts')
      if (!response.ok) return
      const data = await response.json()
      setEmailAccounts(data.emailAccounts || [])
    } catch (error) {
      console.error('Error fetching email accounts:', error)
    }
  }

  const fetchInboxEmails = async (accountId: string | null) => {
    try {
      setLoadingList(true)
      setErrorMessage('')
      const params = new URLSearchParams()
      // Always pass account_id - use 'all' for unified view
      params.append('account_id', accountId || 'all')
      if (classificationFilter !== 'all') params.append('classification', classificationFilter)
      if (searchTerm) params.append('search', searchTerm)
      const response = await fetch(`/api/inbox/emails?${params.toString()}`)
      if (!response.ok) {
        setErrorMessage('Failed to load inbox emails')
        return
      }
      const data = await response.json()
      setInboxEmails(data.emails || [])

      if (data.emails?.length) {
        // First, load cached AI summaries from the email data itself
        const cachedInsights: Record<string, EmailInsight> = {}
        const emailsNeedingAI: IncomingEmail[] = []

        ;(data.emails as IncomingEmail[]).forEach((email: IncomingEmail) => {
          if (email.ai_summary) {
            // We have a cached summary - use it directly
            cachedInsights[email.id] = email.ai_summary
          } else {
            // No cached summary - need to generate one
            emailsNeedingAI.push(email)
          }
        })

        // Update state with cached insights immediately
        if (Object.keys(cachedInsights).length > 0) {
          setEmailInsights(prev => ({ ...prev, ...cachedInsights }))
        }

        // Generate AI summaries for emails that don't have them yet (in background)
        if (emailsNeedingAI.length > 0) {
          console.log(`🤖 Generating AI summaries for ${emailsNeedingAI.length} emails...`)
          emailsNeedingAI.forEach(email => {
            fetchEmailInsight(email.id) // Fire and forget - UI will update when ready
          })
        }
      }
    } catch (error) {
      console.error('Error fetching inbox emails:', error)
      setErrorMessage('Failed to load inbox emails')
    } finally {
      setLoadingList(false)
    }
  }

  const fetchEmailInsight = async (emailId: string) => {
    try {
      const response = await fetch('/api/mailbox/email-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })

      if (!response.ok) {
        throw new Error('Failed to load email insight')
      }

      const payload = await response.json()
      if (!payload?.success) {
        throw new Error(payload?.error || 'Failed to generate insight')
      }

      const insight = payload.data as EmailInsight
      console.log('🔍 Insight received', emailId, insight)
      setEmailInsights((prev) => ({ ...prev, [emailId]: insight }))
      return insight
    } catch (error) {
      console.error('Error fetching email insight:', error)
      return null
    }
  }

  const fetchSentEmails = async (accountId: string | null) => {
    try {
      setLoadingList(true)
      setErrorMessage('')
      const params = new URLSearchParams()
      // Always pass account_id - use 'all' for unified view
      params.append('account_id', accountId || 'all')
      if (searchTerm) params.append('search', searchTerm)
      const response = await fetch(`/api/mailbox/sent?${params.toString()}`)
      if (!response.ok) {
        setErrorMessage('Failed to load sent emails')
        return
      }
      const data = await response.json()
      setSentEmails(data.emails || [])
    } catch (error) {
      console.error('Error fetching sent emails:', error)
      setErrorMessage('Failed to load sent emails')
    } finally {
      setLoadingList(false)
    }
  }

  const deleteInboxEmail = async (emailId: string) => {
    try {
      await fetch('/api/inbox/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds: [emailId] }),
      })
      setInboxEmails((prev) => prev.filter((email) => email.id !== emailId))
      if (selectedItem?.type === 'inbox' && selectedItem.email.id === emailId) {
        setSelectedItem(null)
      }
    } catch (error) {
      console.error('Error deleting email:', error)
      setErrorMessage('Failed to delete email')
    }
  }

  const beginCompose = (mode: 'reply' | 'forward' | 'new') => {
    if (!selectedItem) return

    const isInbox = selectedItem.type === 'inbox'
    const email = selectedItem.email
    const accountId = (email as any).email_accounts?.id || null

    if (!accountId) {
      setErrorMessage('The linked email account is unavailable. Please reconnect the account before sending emails.')
      return
    }

    let to = ''
    let subject = email.subject || ''
    let body = ''

    if (isInbox) {
      to = extractEmailAddress((email as IncomingEmail).from_address) || ''
    } else {
      to = extractEmailAddress(selectedItem.email.contacts?.email) || ''
    }

    const originalContent = isInbox
      ? (selectedItem.email as IncomingEmail).html_content || textToHtml((selectedItem.email as IncomingEmail).text_content || '')
      : textToHtml((selectedItem.email as SentEmail).content || '')

    const timestamp = isInbox
      ? (selectedItem.email as IncomingEmail).date_received
      : (selectedItem.email as SentEmail).sent_at || (selectedItem.email as SentEmail).created_at || new Date().toISOString()

    const senderLabel = isInbox ? (selectedItem.email as IncomingEmail).from_address : (getContactDisplayName(selectedItem.email.contacts) || 'Recipient')

    switch (mode) {
      case 'reply':
        subject = subject?.match(/^Re:/i) ? subject : `Re: ${subject || ''}`
        body = `${'<p></p>'}${buildQuoteBlock(originalContent || 'No content available', senderLabel, timestamp)}`
        break
      case 'forward':
        subject = subject?.match(/^Fwd:/i) ? subject : `Fwd: ${subject || ''}`
        to = ''
        body = `${'<p></p>'}${buildQuoteBlock(originalContent || 'No content available', senderLabel, timestamp)}`
        break
      case 'new':
        body = '<p></p>'
        if (!to) {
          to = isInbox ? extractEmailAddress((selectedItem.email as IncomingEmail).from_address) || '' : ''
        }
        break
    }

    setComposeMode(mode)
    setComposeAccountId(accountId)
    setComposeTo(to)
    setComposeSubject(subject)
    setComposeBody(body)
    setComposeError('')
    setComposeOpen(true)
  }

  const handleComposeSend = async () => {
    if (!composeAccountId) {
      setComposeError('Email account is missing.')
      return
    }
    if (!composeTo.trim()) {
      setComposeError('Recipient is required.')
      return
    }
    if (!composeSubject.trim()) {
      setComposeError('Subject is required.')
      return
    }
    if (!composeBody.trim()) {
      setComposeError('Message cannot be empty.')
      return
    }

    setComposeSending(true)
    setComposeError('')
    try {
      const response = await fetch(`/api/email-accounts/${composeAccountId}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          message: composeBody,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send email')
      }

      setComposeOpen(false)
      setComposeBody('')
      setComposeSubject('')
      // Refresh sent folder for the account used
      await fetchSentEmails(composeAccountId)
    } catch (error: any) {
      console.error('Failed to send email:', error)
      setComposeError(error.message || 'Failed to send email')
    } finally {
      setComposeSending(false)
    }
  }

  const handleSync = async () => {
    const { accountId } = mailboxTarget
    try {
      setSyncing(true)
      setSyncStatus('Syncing...')
      const response = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAccountId: accountId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Sync failed')
      }
      setSyncStatus('Sync completed')
      await fetchInboxEmails(accountId)
      setTimeout(() => setSyncStatus(''), 2500)
    } catch (error: any) {
      console.error('Sync error:', error)
      setSyncStatus(error.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const currentEmails = mailboxTarget.folder === 'inbox' ? inboxEmails : sentEmails
  const currentCount = currentEmails.length

  const primaryAccountId = emailAccounts[0]?.id || null
  const primaryEmail = emailAccounts[0]?.email || null
  const userDisplayName = useMemo(() => deriveNameFromEmail(primaryEmail), [primaryEmail])
  const userInitial = useMemo(() => getInitialFromText(userDisplayName), [userDisplayName])
  const accountCount = emailAccounts.length

  const getAccountLabel = (accountId: string | null) => {
    if (!accountId) return 'All accounts'
    const account = emailAccounts.find(acc => acc.id === accountId)
    return account ? account.email : 'Unknown account'
  }

  const emailSections = useMemo(
    () => {
      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const yesterdayStart = new Date(todayStart)
      yesterdayStart.setDate(todayStart.getDate() - 1)
      const weekStart = new Date(todayStart)
      weekStart.setDate(todayStart.getDate() - 7)

      const baseSections = [
        { key: 'today', label: 'Today', emails: [] as Array<IncomingEmail | SentEmail> },
        { key: 'yesterday', label: 'Yesterday', emails: [] as Array<IncomingEmail | SentEmail> },
        { key: 'week', label: 'Last 7 Days', emails: [] as Array<IncomingEmail | SentEmail> },
        { key: 'older', label: 'Earlier', emails: [] as Array<IncomingEmail | SentEmail> },
      ]

      const source = mailboxTarget.folder === 'inbox' ? inboxEmails : sentEmails

      source.forEach((email) => {
        const rawDate = mailboxTarget.folder === 'inbox'
          ? (email as IncomingEmail).date_received
          : (email as SentEmail).sent_at || (email as SentEmail).created_at

        if (!rawDate) {
          baseSections[3].emails.push(email)
          return
        }

        const date = new Date(rawDate)

        if (date >= todayStart) {
          baseSections[0].emails.push(email)
        } else if (date >= yesterdayStart && date < todayStart) {
          baseSections[1].emails.push(email)
        } else if (date >= weekStart) {
          baseSections[2].emails.push(email)
        } else {
          baseSections[3].emails.push(email)
        }
      })

      return baseSections.filter((section) => section.emails.length > 0)
    },
    [mailboxTarget.folder, inboxEmails, sentEmails]
  )

  const composeTitle = composeMode === 'reply'
    ? 'Reply to email'
    : composeMode === 'forward'
    ? 'Forward email'
    : 'New email'

  const openBlankCompose = () => {
    if (!primaryAccountId) {
      setErrorMessage('Connect an email account before composing a message.')
      return
    }

    setComposeMode('new')
    setComposeAccountId(primaryAccountId)
    setComposeTo('')
    setComposeSubject('')
    setComposeBody('<p></p>')
    setComposeError('')
    setComposeOpen(true)
  }

  const handleMailboxSelect = (key: string) => {
    setSelectedMailboxKey(key)
    setSearchTerm('')
    setClassificationFilter('all')
    setSelectedItem(null)
    setIsMobileSidebarOpen(false)
    setDetailOpen(false)
  }

  const renderInboxListItem = (email: IncomingEmail) => {
    const insight = emailInsights[email.id]
    const isActive = selectedItem?.type === 'inbox' && selectedItem.email.id === email.id
    const fallbackPreview = email.text_content?.slice(0, 160) || cleanHtmlPreview(email.html_content).slice(0, 160) || ''
    const subject = insight?.subject || email.subject || '(No subject)'
    const senderEmail = insight?.sender_email || extractEmailAddress(email.from_address) || 'unknown@example.com'
    const senderName = insight?.sender_name || getSenderName(email.from_address, senderEmail)
    const firstLine = insight?.firstliner || fallbackPreview
    const summary = insight?.summary?.trim()

    // Show loading state while AI is generating, otherwise show summary or fallback
    const isGeneratingSummary = !insight
    const summaryText = isGeneratingSummary
      ? 'Generating AI summary...'
      : (summary && summary.length > 0 ? summary : fallbackPreview || 'No content available')

    const receivedLabel = formatDate(email.date_received)
    const intentMeta = insight ? INTENT_META[insight.intent] || INTENT_META.other : null
    const statusMeta = insight ? STATUS_META[insight.contact_status] : null

    return (
      <button
        key={email.id}
        onClick={() => {
          setSelectedItem({ type: 'inbox', email })
          setDetailOpen(true)
        }}
        className={clsx(
          'group w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200',
          isActive
            ? 'border-transparent bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500 text-white shadow-lg shadow-blue-200/60'
            : 'border-transparent bg-white/95 text-slate-900 shadow-sm hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg'
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={clsx('truncate text-sm font-semibold', isActive ? 'text-white' : 'text-slate-900')}>
                {senderName}
              </p>
              <p className={clsx('truncate text-xs', isActive ? 'text-white/80' : 'text-slate-500')}>
                {senderEmail}
              </p>
            </div>
            {statusMeta && (
              <span className={clsx('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide', statusMeta.className)}>
                {statusMeta.label}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <p className={clsx('truncate text-sm font-semibold', isActive ? 'text-white' : 'text-slate-900')}>{subject}</p>
            <p className={clsx('truncate text-xs', isActive ? 'text-white/80' : 'text-slate-400')}>{firstLine}</p>
            <div className={clsx('flex items-start gap-2 text-xs leading-relaxed', isActive ? 'text-white/80' : 'text-slate-500')}>
              {isGeneratingSummary && (
                <RefreshCw className={clsx('h-3 w-3 shrink-0 animate-spin mt-0.5', isActive ? 'text-white/60' : 'text-blue-500')} />
              )}
              <p className={clsx(isGeneratingSummary && 'italic')}>
                {summaryText}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx('rounded-full px-2.5 py-1 font-medium capitalize', isActive ? 'bg-white/10 text-white/90' : 'bg-slate-100 text-slate-600')}>
                {email.email_accounts?.email || 'Unknown account'}
              </span>
              {intentMeta && (
                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium', intentMeta.color)}>
                  <span>{intentMeta.icon}</span>
                  <span>{intentMeta.label}</span>
                </span>
              )}
            </div>
            <span className={clsx('whitespace-nowrap font-medium', isActive ? 'text-white/80' : 'text-slate-400')}>
              {receivedLabel}
            </span>
          </div>
        </div>
      </button>
    )
  }

  const renderSentListItem = (email: SentEmail) => {
    const to = getContactDisplayName(email.contacts) || 'Unknown recipient'
    const preview = email.content ? email.content.slice(0, 120) : ''
    const isActive = selectedItem?.type === 'outbox' && selectedItem.email.id === email.id
    return (
      <button
        key={email.id}
        onClick={() => {
          setSelectedItem({ type: 'outbox', email })
          setDetailOpen(true)
        }}
        className={clsx(
          'group w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200',
          isActive
            ? 'border-transparent bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500 text-white shadow-lg shadow-blue-200/60'
            : 'border-transparent bg-white/95 text-slate-900 shadow-sm hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={clsx('truncate text-sm font-semibold', isActive ? 'text-white' : 'text-slate-900')}>
                  {email.subject || '(No subject)'}
                </p>
                <p className={clsx('mt-1 truncate text-xs', isActive ? 'text-white/80' : 'text-slate-500')}>
                  To: {to}
                </p>
              </div>
              <span className={clsx('whitespace-nowrap text-xs font-medium', isActive ? 'text-white/80' : 'text-slate-400')}>
                {formatDate(email.sent_at || email.created_at)}
              </span>
            </div>
            {preview && (
              <p className={clsx('mt-3 line-clamp-2 text-xs leading-relaxed', isActive ? 'text-white/80' : 'text-slate-500')}>
                {preview}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium capitalize',
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
                )}
              >
                {email.send_status}
              </span>
              <span
                className={clsx(
                  'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium',
                  isActive ? 'bg-white/10 text-white/90' : 'bg-slate-100 text-slate-600'
                )}
              >
                {email.email_accounts?.email || 'Unknown account'}
              </span>
            </div>
          </div>
        </div>
      </button>
    )
  }

  function cleanHtmlPreview(value?: string | null) {
    if (!value) return ''
    return value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function getSenderName(fromAddress: string, fallback: string) {
    const trimmed = fromAddress?.split('<')[0]?.trim()
    if (trimmed) return trimmed
    return fallback
  }

  const renderDetail = () => {
    if (!selectedItem) {
      return (
        <div className="flex h-full flex-col items-center justify-center bg-white text-slate-400">
          <Mail className="mb-4 h-12 w-12" />
          <p className="text-sm font-semibold text-slate-500">Select an email to preview</p>
          <p className="mt-2 max-w-sm text-center text-xs text-slate-400">
            Choose a message from the list to explore its full content, attachments, and conversation history.
          </p>
        </div>
      )
    }

    if (selectedItem.type === 'inbox') {
      const email = selectedItem.email
      const contact = email.email_replies?.[0]?.contacts || null
      const campaign = email.email_replies?.[0]?.campaigns || null
      const fromName = email.from_address || 'Unknown sender'
      const receivedAt = new Date(email.date_received).toLocaleString()

      return (
        <div className="flex h-full flex-col bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28rem] text-blue-500">Incoming Message</p>
                    <h2 className="text-2xl font-semibold leading-tight text-slate-900">{email.subject || '(No subject)'}</h2>
                    <p className="text-sm text-slate-600">From {fromName}</p>
                    {email.to_address && (
                      <p className="text-xs text-slate-500">To {email.to_address}</p>
                    )}
                    <p className="text-xs text-slate-400">Received {receivedAt}</p>
                  </div>
                </div>
                <MailboxToolbar
                  onReply={() => beginCompose('reply')}
                  onForward={() => beginCompose('forward')}
                  onNewEmail={() => beginCompose('new')}
                  onDelete={() => deleteInboxEmail(email.id)}
                  isInboxEmail={true}
                  className="bg-white/70 backdrop-blur border border-slate-200 shadow-sm shrink-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium capitalize text-blue-600">
                  {email.classification_status.replace('_', ' ')}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                  {email.processing_status === 'completed' ? 'Processed' : `Processing: ${email.processing_status}`}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {email.email_accounts?.email || 'Unknown account'}
                </span>
                {campaign && (
                  <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600">
                    Campaign: {campaign.name}
                  </span>
                )}
                {contact && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                    Contact: {getContactDisplayName(contact)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-8">
            <article className="mx-auto max-w-3xl rounded-3xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-100">
              {email.html_content ? (
                <div
                  className="prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-blue-600"
                  dangerouslySetInnerHTML={{ __html: email.html_content }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-slate-600">
                  {email.text_content || 'No content available'}
                </pre>
              )}
            </article>
          </div>
        </div>
      )
    }

    const email = selectedItem.email
    const toDisplay = getContactDisplayName(email.contacts) || email.contacts?.email || 'Unknown recipient'
    const sentAt = email.sent_at ? new Date(email.sent_at).toLocaleString() : null

    return (
        <div className="flex h-full flex-col bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28rem] text-sky-500">Sent Email</p>
                    <h2 className="text-2xl font-semibold leading-tight text-slate-900">{email.subject || '(No subject)'}</h2>
                  <p className="text-sm text-slate-600">From {email.email_accounts?.email || 'Unknown account'}</p>
                  <p className="text-xs text-slate-500">To {toDisplay}</p>
                  <p className="text-xs text-slate-400">{sentAt ? `Sent ${sentAt}` : 'Queued to send soon'}</p>
                </div>
              </div>
              <MailboxToolbar
                onReply={() => beginCompose('reply')}
                onForward={() => beginCompose('forward')}
                onNewEmail={() => beginCompose('new')}
                onDelete={() => {}}
                isInboxEmail={false}
                className="bg-white/70 backdrop-blur border border-slate-200 shadow-sm shrink-0"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                Status: {email.send_status}
              </span>
              {email.campaigns && (
                <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600">
                  Campaign: {email.campaigns.name}
                </span>
              )}
              {email.created_at && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Created {new Date(email.created_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-8">
          <article className="mx-auto max-w-3xl rounded-3xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-100">
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-slate-600">
              {email.content || 'No content available'}
            </pre>
          </article>
        </div>
      </div>
    )
  }

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex h-full w-full max-w-[18rem] flex-col bg-white">
      <div className="relative border-b border-slate-100 px-6 pt-6 pb-5">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-sm font-semibold text-white shadow-sm">
            CR
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24rem] text-slate-400">Workspace</p>
            <h2 className="text-lg font-semibold text-slate-900">ColdReach Mailbox</h2>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-b border-slate-100 px-6 py-5">
        <div className="rounded-2xl bg-slate-100/80 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-base font-semibold text-blue-600 shadow-sm">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{userDisplayName}</p>
              <p className="truncate text-xs text-slate-500">{primaryEmail || 'No accounts connected'}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{accountCount} account{accountCount === 1 ? '' : 's'} connected</p>
            </div>
          </div>
        </div>
        <Button
          className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500 text-sm font-semibold text-white shadow-lg hover:from-indigo-500 hover:via-blue-500 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!primaryAccountId}
          onClick={() => {
            openBlankCompose()
            onClose?.()
          }}
        >
          <PenSquare className="mr-2 h-4 w-4" />
          Compose Mail
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Unified View</p>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => handleMailboxSelect('all:inbox')}
              className={clsx(
                'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all',
                selectedMailboxKey === 'all:inbox'
                  ? 'border-transparent bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md'
                  : 'border-transparent bg-slate-100/70 text-slate-700 hover:border-blue-200 hover:bg-white hover:text-blue-700 shadow-sm'
              )}
            >
              <span className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Inbox
              </span>
              <ChevronRight className={clsx('h-4 w-4 transition-transform', selectedMailboxKey === 'all:inbox' && 'translate-x-0.5')} />
            </button>
            <button
              onClick={() => handleMailboxSelect('all:outbox')}
              className={clsx(
                'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all',
                selectedMailboxKey === 'all:outbox'
                  ? 'border-transparent bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md'
                  : 'border-transparent bg-slate-100/70 text-slate-700 hover:border-blue-200 hover:bg-white hover:text-blue-700 shadow-sm'
              )}
            >
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Sent Mail
              </span>
              <ChevronRight className={clsx('h-4 w-4 transition-transform', selectedMailboxKey === 'all:outbox' && 'translate-x-0.5')} />
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Accounts</p>
          <div className="mt-4 space-y-4">
            {emailAccounts.map((account) => {
              const isActiveInbox = selectedMailboxKey === `${account.id}:inbox`
              const isActiveSent = selectedMailboxKey === `${account.id}:outbox`
              return (
                <div key={account.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CircleDot className="h-3.5 w-3.5 text-blue-500" />
                    <span className="truncate" title={account.email}>{account.email}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMailboxSelect(`${account.id}:inbox`)}
                      className={clsx(
                        'flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all',
                        isActiveInbox
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow'
                          : 'bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Inbox className="h-3.5 w-3.5" />
                        Inbox
                      </span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMailboxSelect(`${account.id}:outbox`)}
                      className={clsx(
                        'flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all',
                        isActiveSent
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow'
                          : 'bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Send className="h-3.5 w-3.5" />
                        Sent
                      </span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  const renderMobileSidebar = () => (
    <>
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-64 transform border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 md:hidden',
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent onClose={() => setIsMobileSidebarOpen(false)} />
      </aside>
    </>
  )

  return (
    <>
      {renderMobileSidebar()}
      <div className="flex h-full min-h-[720px] w-full bg-slate-100">
        <aside className="hidden h-full flex-shrink-0 border-r border-slate-200 bg-white md:flex md:w-56 lg:w-64">
          <SidebarContent />
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500 text-white shadow-lg">
            <div className="flex flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="md:hidden text-white hover:bg-white/10"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <div>
                    <div className="flex items-center gap-2 text-white/80">
                      <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25rem]">ColdReach</span>
                      <span className="hidden text-sm sm:inline">Unified Mailbox</span>
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">Mailbox</h1>
                    <p className="text-sm text-white/90">
                      {mailboxTarget.folder === 'inbox' ? 'Inbox' : 'Sent'} • {getAccountLabel(mailboxTarget.accountId)} • {currentCount} message{currentCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mailboxTarget.folder === 'inbox' && (
                    <Button
                      onClick={handleSync}
                      disabled={syncing}
                      variant="outline"
                      className="rounded-2xl border-white/40 bg-white/20 text-sm font-semibold text-white hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={clsx('mr-2 h-4 w-4', syncing && 'animate-spin')} />
                      Sync
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden text-white hover:bg-white/10 sm:flex"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={mailboxTarget.folder === 'inbox' ? 'Search incoming mail…' : 'Search sent mail…'}
                    className="h-11 rounded-2xl border border-white/30 bg-white/20 pl-11 text-white placeholder:text-white/70 focus-visible:ring-white/70"
                  />
                </div>
                {mailboxTarget.folder === 'inbox' && (
                  <Select value={classificationFilter} onValueChange={(value) => setClassificationFilter(value as typeof classificationFilter)}>
                    <SelectTrigger className="h-11 w-full rounded-2xl border-none bg-white text-sm font-medium text-slate-700 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-60">
                      <SelectValue placeholder="All classifications" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classifications</SelectItem>
                      <SelectItem value="unclassified">Unclassified</SelectItem>
                      <SelectItem value="human_reply">Replies</SelectItem>
                      <SelectItem value="bounce">Bounces</SelectItem>
                      <SelectItem value="auto_reply">Auto replies</SelectItem>
                      <SelectItem value="spam">Spam</SelectItem>
                      <SelectItem value="unsubscribe">Unsubscribes</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {syncStatus && (
                <div className="rounded-2xl bg-white/15 px-4 py-2 text-xs font-medium text-white/90">
                  {syncStatus}
                </div>
              )}
            </div>
          </header>

          {errorMessage && (
            <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-1 min-h-0 overflow-hidden">
            <section className="flex-1 overflow-hidden bg-white">
              {loadingList ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : currentEmails.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-400">
                  <Mail className="h-12 w-12" />
                  <p className="mt-3 text-sm font-semibold">No email yet</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Adjust your filters or sync a connected account to see messages here.
                  </p>
                </div>
              ) : (
                <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-6">
                  {emailSections.map((section) => (
                    <div key={section.key} className="space-y-3">
                      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.label}</p>
                      <div className="space-y-3">
                        {mailboxTarget.folder === 'inbox'
                          ? (section.emails as IncomingEmail[]).map((email) => renderInboxListItem(email))
                          : (section.emails as SentEmail[]).map((email) => renderSentListItem(email))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <Dialog
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open)
          if (!open) setComposeError('')
        }}
      >
        <DialogContent className="max-w-3xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>{composeTitle}</DialogTitle>
            {composeAccountId && (
              <p className="text-xs text-gray-500">Sending from {getAccountLabel(composeAccountId)}</p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <Input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="To: recipient@example.com"
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject"
              />
            </div>
            <EmailRichTextEditor
              value={composeBody}
              onChange={setComposeBody}
              minHeight="260px"
            />
            {composeError && <p className="text-sm text-red-600">{composeError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setComposeOpen(false)
                setComposeError('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleComposeSend} disabled={composeSending}>
              {composeSending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>

      <Dialog
        open={detailOpen && !!selectedItem}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setSelectedItem(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl p-0">
          <div className="flex h-full flex-col">
            <DialogHeader className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3rem] text-slate-400">Conversation</p>
                  <DialogTitle className="text-lg font-semibold text-slate-900">
                    {selectedItem?.type === 'inbox'
                      ? selectedItem?.email.subject || 'Incoming message'
                      : selectedItem?.email.subject || 'Sent email'}
                  </DialogTitle>
                </div>
                {selectedItem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedItem.type === 'inbox') beginCompose('reply')
                      else beginCompose('new')
                    }}
                    className="rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  >
                    Reply
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {renderDetail()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
