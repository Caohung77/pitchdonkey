'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import clsx from 'clsx'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { EmailRichTextEditor } from '@/components/ui/EmailRichTextEditor'
import { MailboxToolbar } from '../../../components/mailbox/MailboxToolbar'
import { AISummaryButton } from '@/components/mailbox/AISummaryButton'
import { AISummaryCard } from '@/components/mailbox/AISummaryCard'
import { toast } from 'sonner'

interface EmailAccount {
  id: string
  email: string
  provider: string
  outreach_agent_id?: string | null
  assigned_agent_id?: string | null
  outreach_agents_via_outreach?: {
    id: string
    name: string
    sender_name: string | null
  } | null
  outreach_agents_via_assigned?: {
    id: string
    name: string
    sender_name: string | null
  } | null
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

interface OutreachAgentOption {
  id: string
  name: string
  sender_name: string | null
  tone?: string | null
  purpose?: string | null
  status?: 'draft' | 'active' | 'inactive'
}

interface IncomingEmail {
  id: string
  email_account_id: string
  from_address: string
  to_address?: string | null
  subject: string | null
  date_received: string
  message_id?: string | null
  thread_id?: string | null
  gmail_message_id?: string | null
  classification_status: 'unclassified' | 'bounce' | 'auto_reply' | 'human_reply' | 'unsubscribe' | 'spam'
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  text_content: string | null
  html_content: string | null
  ai_summary?: EmailInsight | null
  contact_id?: string | null
  contact?: Contact | null
  email_accounts: EmailAccount & {
    assigned_agent?: {
      id: string
      name: string
    } | null
  }
  email_replies?: Array<{
    campaigns: Campaign | null
    contacts: Contact | null
  }>
  reply_jobs?: Array<{
    id: string
    status: string
    draft_subject: string
    scheduled_at: string
    agent?: {
      id: string
      name: string
    } | null
  }>
}

interface SentEmail {
  id: string
  subject: string
  content: string
  send_status: string
  sent_at: string | null
  created_at: string | null
  to_address?: string | null
  from_address?: string | null
  email_accounts: EmailAccount
  contact_id?: string | null
  contacts: Contact | null
  campaigns: Campaign | null
  source?: string
}

type MailboxSelection =
  | { type: 'inbox'; email: IncomingEmail }
  | { type: 'outbox'; email: SentEmail }

type MailboxTarget = {
  key: string
  accountId: string | null
  folder: 'inbox' | 'outbox'
}

interface AutoReplyDraft {
  jobId: string
  subject: string
  body: string
  scheduledAt: string
  status: string
  riskScore: number
  agentName?: string
  contactEmail?: string
  emailAccountId?: string
  incomingSubject: string
  incomingFrom: string
  incomingDate: string
  incomingPreviewHtml: string
}

interface EmailInsight {
  sender_name: string
  sender_email: string
  subject: string
  firstliner: string
  summary: string
  intent: string
  contact_status: 'green' | 'yellow' | 'red'
  agent_id?: string | null
  agent_persona?: string | null
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

const formatDateTimeLocal = (isoString: string) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const toIsoIfNeeded = (value: string) => {
  if (!value) return new Date().toISOString()
  if (value.endsWith('Z')) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

const htmlToPlainText = (html?: string | null) => {
  if (!html) return ''
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  const [composeAgents, setComposeAgents] = useState<OutreachAgentOption[]>([])
  const [composeAgentId, setComposeAgentId] = useState<string | null>(null)
  const [composeAssistMode, setComposeAssistMode] = useState<'improve' | 'generate'>('improve')
  const [assistPrompt, setAssistPrompt] = useState('')
  const [assistStatus, setAssistStatus] = useState<string | null>(null)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [assistLoading, setAssistLoading] = useState(false)
  const [assistSnapshot, setAssistSnapshot] = useState<{ subject: string; body: string } | null>(null)
  const [composeAgentsLoading, setComposeAgentsLoading] = useState(false)
  const [composeAgentError, setComposeAgentError] = useState<string | null>(null)
  const [autoReplyDraft, setAutoReplyDraft] = useState<AutoReplyDraft | null>(null)
  const [autoReplyModalOpen, setAutoReplyModalOpen] = useState(false)
  const [autoReplyLoading, setAutoReplyLoading] = useState(false)
  const [autoReplyActionLoading, setAutoReplyActionLoading] = useState(false)
  const selectedComposeAgent = useMemo(
    () => composeAgents.find(agent => agent.id === composeAgentId) || null,
    [composeAgents, composeAgentId]
  )

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [emailInsights, setEmailInsights] = useState<Record<string, EmailInsight>>({})
  const [generatingInsights, setGeneratingInsights] = useState<Record<string, boolean>>({})
  const [showingSummary, setShowingSummary] = useState<Record<string, boolean>>({})
  const [creatingContact, setCreatingContact] = useState(false)

  useEffect(() => {
    fetchEmailAccounts()
  }, [])

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setComposeAgentsLoading(true)
        setComposeAgentError(null)
        const response = await fetch('/api/outreach-agents')
        if (!response.ok) {
          throw new Error('Failed to load outreach agents')
        }
        const data = await response.json()
        const activeAgents = (data?.data || []).filter((agent: any) => agent.status === 'active')
        setComposeAgents(activeAgents)
        if (activeAgents.length === 0) {
          setComposeAgentError('Create an outreach agent to enable AI drafting.')
        }
      } catch (error: any) {
        console.error('Error loading outreach agents:', error)
        setComposeAgentError(error.message || 'Failed to load outreach agents')
        setComposeAgents([])
      } finally {
        setComposeAgentsLoading(false)
      }
    }

    loadAgents()
  }, [])

  useEffect(() => {
    if (!composeOpen) return
    if (composeAgentId) return
    if (composeAgents.length === 0) return
    setComposeAgentId(composeAgents[0].id)
  }, [composeOpen, composeAgentId, composeAgents])

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

  useEffect(() => {
    const interval = setInterval(() => {
      if (mailboxTarget.folder === 'inbox') {
        fetchInboxEmails(mailboxTarget.accountId, { silent: true })
      } else {
        fetchSentEmails(mailboxTarget.accountId, { silent: true })
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [mailboxTarget.accountId, mailboxTarget.folder, classificationFilter, searchTerm])

  const fetchEmailAccounts = async () => {
    try {
      const response = await fetch('/api/inbox/email-accounts')
      if (!response.ok) return
      const data = await response.json()
      console.log('📧 Email accounts fetched:', JSON.stringify(data.emailAccounts, null, 2))
      setEmailAccounts(data.emailAccounts || [])
    } catch (error) {
      console.error('Error fetching email accounts:', error)
    }
  }

  const fetchInboxEmails = async (accountId: string | null, options: { silent?: boolean } = {}) => {
    try {
      if (!options.silent) {
        setLoadingList(true)
      }
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

      // Load cached AI summaries from email data (no auto-generation)
      if (data.emails?.length) {
        const cachedInsights: Record<string, EmailInsight> = {}

        ;(data.emails as IncomingEmail[]).forEach((email: IncomingEmail) => {
          if (email.ai_summary) {
            cachedInsights[email.id] = email.ai_summary
          }
        })

        if (Object.keys(cachedInsights).length > 0) {
          setEmailInsights(prev => ({ ...prev, ...cachedInsights }))
        }
      }
    } catch (error) {
      console.error('Error fetching inbox emails:', error)
      setErrorMessage('Failed to load inbox emails')
    } finally {
      if (!options.silent) {
        setLoadingList(false)
      }
    }
  }

  const fetchEmailInsight = async (emailId: string, forceRegenerate = false) => {
    try {
      console.log(`📡 Fetching email insight for ${emailId}, forceRegenerate: ${forceRegenerate}`)
      setGeneratingInsights(prev => ({ ...prev, [emailId]: true }))

      const response = await fetch('/api/mailbox/email-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId, forceRegenerate }),
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
      console.log('📝 Summary content:', insight.summary)
      console.log('📊 Full insight object:', JSON.stringify(insight, null, 2))
      setEmailInsights((prev) => ({ ...prev, [emailId]: insight }))
      return insight
    } catch (error) {
      console.error('Error fetching email insight:', error)
      return null
    } finally {
      setGeneratingInsights(prev => ({ ...prev, [emailId]: false }))
    }
  }

  // Helper to extract failed recipient from bounce emails
  // Enhanced version matching server-side implementation
  const extractFailedRecipient = (emailBody: string, emailSubject: string): string | null => {
    console.log('🔍 Extracting failed recipient from bounce email...')

    // Step 1: Check email headers for explicit failure information
    const headerPatterns = [
      /X-Failed-Recipients:\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
      /Original-Recipient:\s*(?:rfc822;)?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
      /Final-Recipient:\s*(?:rfc822;)?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
      /RCPT TO:\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
    ]

    for (const pattern of headerPatterns) {
      const match = emailBody.match(pattern)
      if (match && match[1]) {
        const email = match[1].trim()
        console.log(`✅ Extracted from header: ${email}`)
        return email
      }
    }

    // Step 2: Enhanced body text patterns (English & German)
    const bodyPatterns = [
      // English patterns
      /(?:could not be delivered to|delivery to the following recipient failed|undeliverable to|failed to deliver to|delivery has failed to)\s+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:message to the following address|the following recipient|recipient address|destination address)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:your message to|addressed to|sent to)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,

      // German patterns
      /(?:konnte nicht zugestellt werden an|zustellung fehlgeschlagen an|empfänger|nicht zugestellt werden an)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:nachricht an folgende adresse|folgende empfänger|empfängeradresse)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:Die E-Mail an|wurde nicht zugestellt)[:\s]+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,

      // Standalone email on a line (common in bounce messages)
      /^[\s]*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})[\s]*$/im,

      // Generic patterns
      /(?:recipient|empfänger)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:to|an)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?(?:\s|$)/i,
      /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\s+(?:because of|wegen|due to|auf grund)/i,

      // Status notification formats
      /Action:\s*failed.*?Recipient:\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/is,
      /Status:\s*5\.\d+\.\d+.*?(?:for|to)\s+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/is,
    ]

    for (const pattern of bodyPatterns) {
      const match = emailBody.match(pattern)
      if (match && match[1]) {
        const email = match[1].trim()
        // Filter out system addresses
        if (!email.includes('mailer-daemon') && !email.includes('postmaster') && !email.includes('no-reply')) {
          console.log(`✅ Extracted from body: ${email}`)
          return email
        }
      }
    }

    // Step 3: Check subject line with bounce keyword validation
    const bounceKeywords = ['delivery', 'failed', 'bounce', 'undeliverable', 'zustellung', 'fehlgeschlagen']
    const hasBounceKeyword = bounceKeywords.some(keyword =>
      emailSubject.toLowerCase().includes(keyword)
    )

    if (hasBounceKeyword) {
      const allEmails = emailSubject.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []
      for (const email of allEmails) {
        const lowerEmail = email.toLowerCase()
        if (!lowerEmail.includes('mailer-daemon') &&
            !lowerEmail.includes('postmaster') &&
            !lowerEmail.includes('no-reply') &&
            !lowerEmail.includes('bounce')) {
          console.log(`✅ Extracted from subject: ${email}`)
          return email.trim()
        }
      }
    }

    console.warn('⚠️ Failed to extract recipient from bounce email')
    return null
  }

  const handleFlagContact = async (senderEmail: string, intent: string) => {
    try {
      console.log(`🚩 Flagging contact: ${senderEmail} with intent: ${intent}`)

      // For bounce/invalid_contact, extract the failed recipient from current email
      let contactEmail = senderEmail
      let extractionFailed = false

      if (intent === 'invalid_contact' && selectedItem?.type === 'inbox') {
        const email = selectedItem.email
        const emailBody = email.text_content || email.html_content || ''
        const emailSubject = email.subject || ''
        const failedRecipient = extractFailedRecipient(emailBody, emailSubject)

        if (failedRecipient) {
          console.log(`📧 Extracted failed recipient from bounce: ${failedRecipient}`)
          contactEmail = failedRecipient
        } else {
          console.warn(`⚠️ Could not extract failed recipient from bounce email`)
          extractionFailed = true

          // Show user-friendly prompt for manual email entry
          const manualEmail = window.prompt(
            'Could not automatically detect the bounced email address.\n\n' +
            'Please enter the email address that bounced (the recipient that failed):',
            ''
          )

          if (!manualEmail || !manualEmail.trim()) {
            throw new Error('Email address is required to flag contact')
          }

          // Basic email validation
          const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
          if (!emailRegex.test(manualEmail.trim())) {
            throw new Error('Invalid email address format')
          }

          contactEmail = manualEmail.trim()
          console.log(`📧 Using manually entered email: ${contactEmail}`)
        }
      }

      // Find contact by email using lookup endpoint
      const response = await fetch(`/api/contacts/lookup?email=${encodeURIComponent(contactEmail)}`)
      if (!response.ok) {
        const errorMsg = extractionFailed
          ? `Contact not found for: ${contactEmail}\n\nPlease verify the email address is correct and exists in your contacts.`
          : `Failed to lookup contact for email: ${contactEmail}`
        throw new Error(errorMsg)
      }

      const data = await response.json()
      const contact = data?.contact

      if (!contact || !data.exists) {
        const errorMsg = extractionFailed
          ? `Contact "${contactEmail}" not found in your database.\n\nOnly contacts that exist in your contact list can be flagged.`
          : `Contact not found in database: ${contactEmail}`
        throw new Error(errorMsg)
      }

      console.log(`✅ Found contact: ${contact.first_name} ${contact.last_name} (${contact.email})`)

      // Determine reason based on intent
      const reason = intent === 'unsubscribe' ? 'unsubscribe' :
                     intent === 'negative_reply' ? 'complaint' :
                     intent === 'invalid_contact' ? 'bounce' : 'unsubscribe'

      // Call flag status API
      const flagResponse = await fetch(`/api/contacts/${contact.id}/flag-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, senderEmail: contactEmail }),
      })

      if (!flagResponse.ok) {
        throw new Error('Failed to flag contact')
      }

      const flagData = await flagResponse.json()
      console.log('✅ Contact flagged successfully:', flagData)

      return flagData
    } catch (error) {
      console.error('Error flagging contact:', error)
      throw error
    }
  }

  const fetchSentEmails = async (accountId: string | null, options: { silent?: boolean } = {}) => {
    try {
      if (!options.silent) {
        setLoadingList(true)
      }
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
      console.log('📤 Sent emails API response:', {
        success: data?.success,
        total: data?.emails?.length,
        pagination: data?.pagination,
        sample: data?.emails?.slice?.(0, 1)
      })
      if (data?.success === false) {
        setErrorMessage(data?.error || 'Failed to load sent emails')
        setSentEmails([])
        return
      }
      setSentEmails(data.emails || [])
    } catch (error) {
      console.error('Error fetching sent emails:', error)
      setErrorMessage('Failed to load sent emails')
    } finally {
      if (!options.silent) {
        setLoadingList(false)
      }
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
    const account = emailAccounts.find(acc => acc.id === accountId) || null
    const defaultAgentId =
      account?.outreach_agents_via_outreach?.id ||
      account?.outreach_agents_via_assigned?.id ||
      composeAgentId ||
      (composeAgents.length > 0 ? composeAgents[0].id : null)

    setComposeAssistMode('improve')
    setAssistPrompt('')
    setAssistStatus(null)
    setAssistError(null)
    setAssistSnapshot(null)
    setComposeAgentId(defaultAgentId)
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

  const runDraftImprovement = async () => {
    if (!composeAgentId) {
      setAssistError('Select an outreach agent to continue.')
      return
    }

    const plainBody = htmlToPlainText(composeBody)

    if (!composeSubject.trim() && !plainBody.trim()) {
      setAssistError('Write a subject or message before asking the agent to improve it.')
      return
    }

    const snapshot = { subject: composeSubject, body: composeBody }

    setAssistError(null)
    setAssistStatus(`${selectedComposeAgent?.name || 'Your agent'} is polishing your draft…`)
    setAssistLoading(true)
    setAssistSnapshot(snapshot)

    try {
      const response = await fetch(`/api/outreach-agents/${composeAgentId}/compose/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: composeSubject,
          body: composeBody,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload) {
        const message =
          (payload && (payload.error || payload.message || payload.details)) ||
          'Failed to improve the draft.'
        throw new Error(message)
      }

      if (payload.success === false) {
        throw new Error(payload.error || 'Failed to improve the draft.')
      }

      const improved = payload.data || payload
      setComposeSubject(improved.subject ?? composeSubject)
      setComposeBody(improved.body ?? composeBody)
      setAssistStatus(`${selectedComposeAgent?.name || 'Your agent'} polished your draft.`)
      toast.success('Draft updated by outreach agent')
    } catch (error: any) {
      console.error('Failed to improve draft:', error)
      setAssistStatus(null)
      setAssistError(error.message || 'Failed to improve the draft.')
      setAssistSnapshot(snapshot)
    } finally {
      setAssistLoading(false)
    }
  }

  const runDraftGeneration = async () => {
    if (!composeAgentId) {
      setAssistError('Select an outreach agent to continue.')
      return
    }

    if (!assistPrompt.trim()) {
      setAssistError('Describe what you want the agent to write.')
      return
    }

    const snapshot = { subject: composeSubject, body: composeBody }

    setAssistError(null)
    setAssistStatus(`${selectedComposeAgent?.name || 'Your agent'} is generating a draft…`)
    setAssistLoading(true)
    setAssistSnapshot(snapshot)

    try {
      const response = await fetch(`/api/outreach-agents/${composeAgentId}/compose/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: assistPrompt.trim(),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload) {
        const message =
          (payload && (payload.error || payload.message || payload.details)) ||
          'Failed to generate a draft.'
        throw new Error(message)
      }

      if (payload.success === false) {
        throw new Error(payload.error || 'Failed to generate a draft.')
      }

      const generated = payload.data || payload
      setComposeSubject(generated.subject ?? composeSubject)
      setComposeBody(generated.body ?? composeBody)
      setAssistStatus(`${selectedComposeAgent?.name || 'Your agent'} created a new draft.`)
      toast.success('New draft generated')
    } catch (error: any) {
      console.error('Failed to generate draft:', error)
      setAssistStatus(null)
      setAssistError(error.message || 'Failed to generate the draft.')
      setAssistSnapshot(snapshot)
    } finally {
      setAssistLoading(false)
    }
  }

  const handleAssistRevert = () => {
    if (!assistSnapshot) return
    setComposeSubject(assistSnapshot.subject)
    setComposeBody(assistSnapshot.body)
    setAssistSnapshot(null)
    setAssistStatus('Reverted to your previous draft.')
    setAssistError(null)
  }

  const handleAutoReplyDraft = async () => {
    if (!selectedItem || selectedItem.type !== 'inbox') {
      toast.error('Select an incoming email first')
      return
    }

    const email = selectedItem.email as IncomingEmail
    const agentId = email.email_accounts?.assigned_agent?.id
    if (!agentId) {
      toast.error('No outreach agent assigned to this mailbox')
      return
    }

    if (!email.email_account_id) {
      toast.error('Missing email account information')
      return
    }

    setAutoReplyLoading(true)
    try {
      const contactId = email.contact?.id || email.email_replies?.[0]?.contacts?.id || null
      const plainBody = email.text_content?.trim() || htmlToPlainText(email.html_content) || ''
      if (!plainBody) {
        throw new Error('Email body is empty; unable to generate auto reply')
      }
      const threadId = email.thread_id || email.message_id || email.gmail_message_id || email.id
      const incomingFrom = extractEmailAddress(email.from_address) || 'unknown@example.com'
      const previewHtml = email.html_content || textToHtml(email.text_content || plainBody)

      const payload = {
        email_account_id: email.email_account_id,
        incoming_email_id: email.id,
        thread_id: threadId,
        contact_id: contactId,
        incoming_subject: email.subject || '(No subject)',
        incoming_body: plainBody,
        incoming_from: incomingFrom,
        message_ref: email.message_id || email.gmail_message_id || undefined,
      }

      const response = await fetch(`/api/outreach-agents/${agentId}/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate autonomous reply')
      }

      const { data } = await response.json()

      const draft: AutoReplyDraft = {
        jobId: data.reply_job_id,
        subject: data.draft_subject,
        body: data.draft_body,
        scheduledAt: data.scheduled_at,
        status: data.status,
        riskScore: data.risk_score,
        agentName: email.email_accounts?.assigned_agent?.name,
        contactEmail: extractEmailAddress(email.from_address) || email.from_address,
        emailAccountId: email.email_account_id,
        incomingSubject: email.subject || '(No subject)',
        incomingFrom: email.from_address,
        incomingDate: email.date_received,
        incomingPreviewHtml: previewHtml,
      }

      setAutoReplyDraft(draft)
      setAutoReplyModalOpen(true)
      toast.success('Autonomous reply draft created')
    } catch (error: any) {
      console.error('Failed to draft autonomous reply:', error)
      toast.error(error.message || 'Failed to draft autonomous reply')
    } finally {
      setAutoReplyLoading(false)
    }
  }

  const handleCreateContactFromEmail = async () => {
    if (!selectedItem || selectedItem.type !== 'inbox') {
      toast.error('Select an incoming email first')
      return
    }

    const email = selectedItem.email as IncomingEmail
    const contactEmail = extractEmailAddress(email.from_address) || email.from_address

    if (!contactEmail) {
      toast.error('Unable to determine sender address')
      return
    }

    const derivedName = deriveNameFromEmail(contactEmail)
    const nameParts = derivedName.split(' ')
    const maybeFirst = nameParts[0]
    const firstName = maybeFirst && maybeFirst.includes('@') ? undefined : maybeFirst
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') || undefined : undefined

    setCreatingContact(true)
    try {
      const response = await fetch('/api/inbox/create-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: email.id,
          emailAddress: contactEmail,
          first_name: firstName,
          last_name: lastName
        })
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        const message = payload?.error || 'Failed to create contact'
        throw new Error(message)
      }

      const newContact = payload.data?.contact as Contact | undefined

      if (newContact) {
        setInboxEmails(prev =>
          prev.map(item => {
            const itemEmail = extractEmailAddress(item.from_address) || item.from_address
            if (item.id === email.id || (itemEmail && itemEmail.toLowerCase() === contactEmail)) {
              return { ...item, contact: newContact, contact_id: newContact.id }
            }
            return item
          })
        )
        setSentEmails(prev =>
          prev.map(item => {
            const toAddress = extractEmailAddress(item.to_address) || item.to_address
            if (toAddress && toAddress.toLowerCase() === contactEmail) {
              return { ...item, contacts: newContact, contact_id: newContact.id }
            }
            return item
          })
        )
        setSelectedItem({ type: 'inbox', email: { ...email, contact: newContact, contact_id: newContact.id } })
      }

      toast.success(payload?.message || 'Contact created from email')
    } catch (error: any) {
      console.error('Error creating contact from email:', error)
      toast.error(error?.message || 'Failed to create contact')
    } finally {
      setCreatingContact(false)
    }
  }

  const handleAutoReplySchedule = async () => {
    if (!autoReplyDraft) return
    setAutoReplyActionLoading(true)
    try {
      const response = await fetch(`/api/scheduled-replies/${autoReplyDraft.jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_subject: autoReplyDraft.subject,
          draft_body: autoReplyDraft.body,
          scheduled_at: toIsoIfNeeded(autoReplyDraft.scheduledAt),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update scheduled reply')
      }

      toast.success('Reply scheduled successfully')
      setAutoReplyDraft((prev) => prev ? { ...prev, status: 'scheduled' } : prev)
      setAutoReplyModalOpen(false)
    } catch (error: any) {
      console.error('Failed to schedule reply job:', error)
      toast.error(error.message || 'Failed to schedule reply')
    } finally {
      setAutoReplyActionLoading(false)
    }
  }

  const handleAutoReplySendNow = async () => {
    if (!autoReplyDraft) return
    setAutoReplyActionLoading(true)
    try {
      const response = await fetch(`/api/scheduled-replies/${autoReplyDraft.jobId}/send-now`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send reply immediately')
      }

      toast.success('Reply sent successfully')
      setAutoReplyModalOpen(false)
      const accountId = autoReplyDraft.emailAccountId || null
      setAutoReplyDraft(null)
      if (accountId) {
        fetchSentEmails(accountId)
      }
    } catch (error: any) {
      console.error('Failed to send reply job now:', error)
      toast.error(error.message || 'Failed to send reply now')
    } finally {
      setAutoReplyActionLoading(false)
    }
  }

  const handleSync = async () => {
    const { accountId, folder } = mailboxTarget
    try {
      setSyncing(true)
      setSyncStatus('Syncing mailbox...')
      const response = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAccountId: accountId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Sync failed')
      }
      if (folder === 'inbox') {
        await fetchInboxEmails(accountId)
        await fetchSentEmails(accountId, { silent: true })
      } else {
        await fetchSentEmails(accountId)
        await fetchInboxEmails(accountId, { silent: true })
      }
      setSyncStatus('Sync completed')
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

    const account = emailAccounts.find(acc => acc.id === primaryAccountId) || null
    const defaultAgentId =
      account?.outreach_agents_via_outreach?.id ||
      account?.outreach_agents_via_assigned?.id ||
      composeAgentId ||
      (composeAgents.length > 0 ? composeAgents[0].id : null)

    setComposeMode('new')
    setComposeAccountId(primaryAccountId)
    setComposeTo('')
    setComposeSubject('')
    setComposeBody('<p></p>')
    setComposeError('')
    setComposeAssistMode('improve')
    setAssistPrompt('')
    setAssistStatus(null)
    setAssistError(null)
    setAssistSnapshot(null)
    setComposeAgentId(defaultAgentId)
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
    const insight = emailInsights[email.id] || email.ai_summary || null
    const isActive = selectedItem?.type === 'inbox' && selectedItem.email.id === email.id
    const fallbackPreview = email.text_content?.slice(0, 300) || cleanHtmlPreview(email.html_content).slice(0, 300) || ''
    const subject = insight?.subject || email.subject || '(No subject)'
    const senderEmail = insight?.sender_email || extractEmailAddress(email.from_address) || 'unknown@example.com'
    const senderName = insight?.sender_name || getSenderName(email.from_address, senderEmail)
    const isGenerating = generatingInsights[email.id]
    const hasInsight = Boolean(insight?.summary && insight.summary.trim().length > 0)
    const summaryPreference = showingSummary[email.id]
    const isSummaryShowing = summaryPreference === undefined ? hasInsight : summaryPreference

    const receivedLabel = formatDate(email.date_received)
    const intentMeta = insight ? INTENT_META[insight.intent] || INTENT_META.other : null
    const statusMeta = insight ? STATUS_META[insight.contact_status] : null

    // Debug logging
    if (isSummaryShowing) {
      console.log('📋 Rendering email card:', {
        emailId: email.id.slice(0, 8),
        isSummaryShowing,
        hasInsight: !!insight,
        summaryContent: insight?.summary?.slice(0, 100),
        summaryLength: insight?.summary?.length,
        firstliner: insight?.firstliner?.slice(0, 50)
      })
    }

    const handleSummaryToggle = async (e: React.MouseEvent) => {
      e.stopPropagation()

      console.log('🔘 Smart Summary clicked', email.id, {
        hasInsight,
        isSummaryShowing,
        summaryPreview: insight?.summary?.slice(0, 100)
      })

      // If a summary already exists and is currently displayed, allow toggling back to preview
      if (hasInsight && isSummaryShowing) {
        console.log('🔄 Hiding AI summary, showing preview')
        setShowingSummary(prev => ({ ...prev, [email.id]: false }))
        return
      }

      // Enhanced bad summary detection with pattern matching and logging
      let isBadSummary = false
      let detectionReason = ''

      if (insight?.summary) {
        const summary = insight.summary
        const first50 = summary.slice(0, 50)

        // Check 1: Quote markers anywhere in first 50 chars
        if (first50.includes('>')) {
          isBadSummary = true
          detectionReason = 'Contains quote marker (>) in first 50 chars'
        }
        // Check 2: German email forwarding patterns
        else if (summary.includes('Anfang der weitergeleiteten') ||
                 summary.includes('Anfang der') ||
                 summary.includes('Von:') ||
                 summary.includes('Gesendet:')) {
          isBadSummary = true
          detectionReason = 'Contains German email forwarding pattern'
        }
        // Check 3: German email reply patterns
        else if ((summary.includes('Am ') && summary.includes('schrieb')) ||
                 summary.includes('Am ') && summary.includes('um ')) {
          isBadSummary = true
          detectionReason = 'Contains German email reply pattern'
        }
        // Check 4: English email patterns
        else if (summary.match(/^On .* wrote:/i) ||
                 summary.match(/^From:/i) ||
                 summary.match(/^Sent:/i)) {
          isBadSummary = true
          detectionReason = 'Contains English email header pattern'
        }
        // Check 5: Summary equals firstliner (Gemini API failure)
        else if (insight.firstliner && summary.trim() === insight.firstliner.trim()) {
          isBadSummary = true
          detectionReason = 'Summary equals firstliner (API returned original text)'
        }
        // Check 6: Too short to be useful
        else if (summary.trim().length < 10) {
          isBadSummary = true
          detectionReason = 'Summary too short (<10 chars)'
        }

        if (isBadSummary) {
          console.log('⚠️ Bad summary detected:', {
            reason: detectionReason,
            summaryPreview: summary.slice(0, 100),
            emailId: email.id.slice(0, 8)
          })
        }
      }

      // If no insight exists OR cached summary is bad, regenerate
      if (!hasInsight || isBadSummary) {
        if (isBadSummary) {
          console.log('⚠️ Cached summary is bad quality, regenerating...')
        } else {
          console.log('📡 Generating new AI summary...')
        }
        const generatedInsight = await fetchEmailInsight(email.id, true)
        console.log('✅ API response:', generatedInsight)
        if (generatedInsight) {
          setShowingSummary(prev => ({ ...prev, [email.id]: true }))
        }
      } else {
        // Already have good insight, just show it
        console.log('✅ Showing existing AI summary')
        setShowingSummary(prev => ({ ...prev, [email.id]: true }))
      }
    }

    const displayContent = isSummaryShowing && hasInsight ? insight?.summary || fallbackPreview : fallbackPreview

    return (
      <div
        key={email.id}
        className={clsx(
          'group w-full rounded-2xl border px-4 py-3 transition-all duration-200 cursor-pointer',
          isActive
            ? 'border-transparent bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500 text-white shadow-lg shadow-blue-200/60'
            : 'border-transparent bg-white/95 text-slate-900 shadow-sm hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg'
        )}
        onClick={() => {
          setSelectedItem({ type: 'inbox', email })
          setDetailOpen(true)
        }}
      >
        <div className="flex flex-col gap-3">
          {/* Header with sender info and Smart Summary button */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className={clsx('truncate text-sm font-semibold', isActive ? 'text-white' : 'text-slate-900')}>
                {senderName}
              </p>
              <p className={clsx('truncate text-xs', isActive ? 'text-white/80' : 'text-slate-500')}>
                {senderEmail}
              </p>
            </div>

            {/* Smart Summary Button - Top Right */}
            <button
              onClick={handleSummaryToggle}
              disabled={isGenerating}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all shrink-0 z-10',
                isGenerating && 'cursor-not-allowed opacity-60',
                isSummaryShowing
                  ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white hover:from-slate-600 hover:to-slate-700'
                  : hasInsight
                  ? 'bg-gradient-to-r from-blue-500 to-sky-500 text-white hover:from-blue-600 hover:to-sky-600'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
              )}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>{isSummaryShowing ? '📄' : '✨'}</span>
                  <span>
                    {isSummaryShowing
                      ? 'Preview'
                      : hasInsight
                      ? 'Smart Summary'
                      : 'Smart Summarize'}
                  </span>
                </>
              )}
            </button>

            {statusMeta && (
              <span className={clsx('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide', statusMeta.className)}>
                {statusMeta.label}
              </span>
            )}
          </div>

          {/* Subject and Content Preview */}
          <div className="space-y-2">
            <p className={clsx('truncate text-sm font-semibold', isActive ? 'text-white' : 'text-slate-900')}>
              {subject}
            </p>

            {/* Content area with 3-line max truncation */}
            {isSummaryShowing && hasInsight ? (
              <div className={clsx(
                'rounded-lg border p-3 space-y-1',
                isActive
                  ? 'border-white/20 bg-white/10'
                  : 'border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-purple-50/50'
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">AI Summary</span>
                </div>
                <p className={clsx(
                  'text-xs leading-relaxed line-clamp-3',
                  isActive ? 'text-white' : 'text-slate-700'
                )}>
                  {displayContent}
                </p>
              </div>
            ) : (
              <p className={clsx(
                'text-xs leading-relaxed line-clamp-3',
                isActive ? 'text-white/80' : 'text-slate-600'
              )}>
                {displayContent}
              </p>
            )}
          </div>

          {/* Footer with metadata */}
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
              {email.reply_jobs && email.reply_jobs.length > 0 && email.reply_jobs[0].agent && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium bg-green-100 text-green-700 border border-green-300">
                  <span>🤖</span>
                  <span>{email.reply_jobs[0].agent.name}: replied</span>
                </span>
              )}
            </div>
            <span className={clsx('whitespace-nowrap font-medium', isActive ? 'text-white/80' : 'text-slate-400')}>
              {receivedLabel}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const renderSentListItem = (email: SentEmail) => {
    const to = getContactDisplayName(email.contacts) || email.contacts?.email || email.to_address || 'Unknown recipient'
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
      const contact = email.contact || email.email_replies?.[0]?.contacts || null
      const campaign = email.email_replies?.[0]?.campaigns || null
      const fromName = email.from_address || 'Unknown sender'
      const receivedAt = new Date(email.date_received).toLocaleString()
      const assignedAgentId = email.email_accounts?.assigned_agent?.id

      return (
        <div className="flex h-full flex-col bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-4 sm:px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 space-y-1 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28rem] text-blue-500">Incoming Message</p>
                    <h2 className="text-xl sm:text-2xl font-semibold leading-tight text-slate-900">{email.subject || '(No subject)'}</h2>
                    <p className="text-sm text-slate-600">From {fromName}</p>
                    {email.to_address && (
                      <p className="text-xs text-slate-500">To {email.to_address}</p>
                    )}
                    <p className="text-xs text-slate-400">Received {receivedAt}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <MailboxToolbar
                    showReply={false}
                    showForward={false}
                    onForward={() => beginCompose('forward')}
                    onNewEmail={() => beginCompose('new')}
                    onDelete={() => deleteInboxEmail(email.id)}
                    isInboxEmail={true}
                    className="bg-white/70 backdrop-blur border border-slate-200 shadow-sm shrink-0"
                  />
                  {!contact && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCreateContactFromEmail}
                      disabled={creatingContact}
                      className={clsx(
                        'rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs sm:text-sm whitespace-nowrap',
                        creatingContact && 'opacity-70 cursor-not-allowed'
                      )}
                    >
                      {creatingContact ? 'Creating...' : 'Add to Contacts'}
                    </Button>
                  )}
                  {contact && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs sm:text-sm whitespace-nowrap"
                      asChild
                    >
                      <Link href={`/dashboard/contacts/${contact.id}`}>
                        View Contact
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleAutoReplyDraft}
                    disabled={autoReplyLoading || !assignedAgentId}
                    className={clsx(
                      'rounded-full px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 shadow-sm hover:from-purple-600 hover:to-pink-600 whitespace-nowrap',
                      (autoReplyLoading || !assignedAgentId) && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {autoReplyLoading ? 'Drafting...' : 'Auto Reply'}
                  </Button>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 text-xs sm:text-sm whitespace-nowrap ml-auto"
                      onClick={() => {
                        setSelectedItem(null)
                      }}
                    >
                      Close
                    </Button>
                  </DialogClose>
                </div>
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

          <div className="flex-1 overflow-auto px-4 sm:px-6 py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* AI Summary Card */}
              <AISummaryCard
                insight={emailInsights[email.id]}
                loading={generatingInsights[email.id] || false}
                onGenerate={(forceRegenerate) => fetchEmailInsight(email.id, forceRegenerate)}
                onRegenerate={() => fetchEmailInsight(email.id, true)}
                onFlagContact={handleFlagContact}
              />

              {/* Email Content */}
              <article className="rounded-3xl bg-white px-4 sm:px-6 py-8 shadow-sm ring-1 ring-slate-100">
                {email.html_content ? (
                  <div
                    className="prose prose-sm sm:prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-blue-600"
                    dangerouslySetInnerHTML={{ __html: email.html_content }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm sm:text-[15px] leading-relaxed text-slate-600">
                    {email.text_content || 'No content available'}
                  </pre>
                )}
              </article>
            </div>
          </div>
        </div>
      )
    }

    const email = selectedItem.email
    const toDisplay = getContactDisplayName(email.contacts) || email.contacts?.email || email.to_address || 'Unknown recipient'
    const sentAt = email.sent_at ? new Date(email.sent_at).toLocaleString() : null

    return (
        <div className="flex h-full flex-col bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-4 sm:px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 space-y-1 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28rem] text-sky-500">Sent Email</p>
                    <h2 className="text-xl sm:text-2xl font-semibold leading-tight text-slate-900">{email.subject || '(No subject)'}</h2>
                  <p className="text-sm text-slate-600">From {email.email_accounts?.email || 'Unknown account'}</p>
                  <p className="text-xs text-slate-500">To {toDisplay}</p>
                  <p className="text-xs text-slate-400">{sentAt ? `Sent ${sentAt}` : 'Queued to send soon'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MailboxToolbar
                  onReply={() => beginCompose('reply')}
                  onForward={() => beginCompose('forward')}
                  onNewEmail={() => beginCompose('new')}
                  onDelete={() => {}}
                  isInboxEmail={false}
                  className="bg-white/70 backdrop-blur border border-slate-200 shadow-sm shrink-0"
                />
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 text-xs sm:text-sm whitespace-nowrap ml-auto"
                    onClick={() => {
                      setSelectedItem(null)
                    }}
                  >
                    Close
                  </Button>
                </DialogClose>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
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

        <div className="flex-1 overflow-auto px-4 sm:px-6 py-8">
          <article className="mx-auto max-w-3xl rounded-3xl bg-white px-4 sm:px-6 py-8 shadow-sm ring-1 ring-slate-100">
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

              // Check both possible agent relationships
              const agent = account.outreach_agents_via_outreach || account.outreach_agents_via_assigned
              const agentName = agent?.name || agent?.sender_name

              console.log(`🔍 Account: ${account.email}`, {
                hasAgent: !!agent,
                agentViaOutreach: account.outreach_agents_via_outreach,
                agentViaAssigned: account.outreach_agents_via_assigned,
                agentName,
                outreach_agent_id: account.outreach_agent_id,
                assigned_agent_id: account.assigned_agent_id
              })

              return (
                <div key={account.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <CircleDot className="h-3.5 w-3.5 text-blue-500" />
                      <span className="truncate" title={account.email}>{account.email}</span>
                    </div>
                    {agentName && (
                      <div className="flex items-center gap-1.5 pl-5">
                        <span className="text-[10px] font-medium text-slate-500">🤖</span>
                        <span className="truncate text-[11px] font-medium text-slate-600" title={agentName}>
                          {agentName}
                        </span>
                      </div>
                    )}
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
                  <Button
                    onClick={handleSync}
                    disabled={syncing}
                    variant="outline"
                    className="rounded-2xl border-white/40 bg-white/20 text-sm font-semibold text-white hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={clsx('mr-2 h-4 w-4', syncing && 'animate-spin')} />
                    Sync
                  </Button>
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
          if (!open) {
            setComposeError('')
            setAssistStatus(null)
            setAssistError(null)
            setAssistPrompt('')
            setAssistSnapshot(null)
            setAssistLoading(false)
          }
        }}
      >
        <DialogContent className="max-w-3xl w-full overflow-hidden rounded-3xl border border-slate-200 bg-transparent p-0">
          <div className="flex max-h-[90vh] flex-col bg-[#f3f5f9]">
            <div className="flex items-start justify-between bg-[linear-gradient(115deg,#2F84FB_0%,#31C4F5_50%,#25D4EB_100%)] px-6 py-6 text-white">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold text-white">{composeTitle}</DialogTitle>
                <p className="text-sm text-white/80">
                  Sending from {composeAccountId ? getAccountLabel(composeAccountId) : getAccountLabel(primaryAccountId)}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-7">
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Outreach agent
                    </label>
                    <Select
                      value={composeAgentId || undefined}
                      onValueChange={(value) => {
                        setComposeAgentId(value)
                        setAssistError(null)
                        setAssistStatus(null)
                      }}
                      disabled={composeAgentsLoading || assistLoading || composeAgents.length === 0}
                    >
                      <SelectTrigger className="h-12 w-full rounded-full border border-slate-200 bg-white px-4 text-left text-sm font-medium shadow-sm focus-visible:ring-blue-400">
                        <SelectValue placeholder={composeAgentsLoading ? 'Loading agents…' : 'Select an agent'} />
                      </SelectTrigger>
                      <SelectContent>
                        {composeAgents.length === 0 ? (
                          <SelectItem value="__no_agents" disabled>
                            No active agents available
                          </SelectItem>
                        ) : (
                          composeAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{agent.name}</span>
                                {agent.purpose && (
                                  <span className="text-xs text-slate-500">{agent.purpose}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedComposeAgent?.sender_name && (
                      <p className="text-xs text-slate-500">
                        Writing as {selectedComposeAgent.sender_name}
                      </p>
                    )}
                    {composeAgentError && (
                      <p className="text-xs text-red-600">{composeAgentError}</p>
                    )}
                  </div>

                  <div className="flex h-12 items-center gap-1 self-start rounded-full bg-slate-200/70 p-1 text-xs font-semibold text-slate-600 sm:self-auto">
                    <button
                      type="button"
                      className={clsx(
                        'flex h-full items-center rounded-full px-4 transition',
                        composeAssistMode === 'improve'
                          ? 'bg-white text-slate-900 shadow'
                          : 'text-slate-500 hover:text-slate-800'
                      )}
                      onClick={() => {
                        setComposeAssistMode('improve')
                        setAssistError(null)
                        setAssistStatus(null)
                      }}
                      disabled={assistLoading}
                    >
                      Improve
                    </button>
                    <button
                      type="button"
                      className={clsx(
                        'flex h-full items-center rounded-full px-4 transition',
                        composeAssistMode === 'generate'
                          ? 'bg-white text-slate-900 shadow'
                          : 'text-slate-500 hover:text-slate-800'
                      )}
                      onClick={() => {
                        setComposeAssistMode('generate')
                        setAssistError(null)
                        setAssistStatus(null)
                      }}
                      disabled={assistLoading}
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    type="email"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="To: recipient@example.com"
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-200"
                  />
                  <Input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject"
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-200"
                  />
                </div>

                {composeAssistMode === 'generate' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tell {selectedComposeAgent?.name || 'your agent'} what to write
                    </label>
                    <Textarea
                      rows={3}
                      value={assistPrompt}
                      onChange={(e) => {
                        setAssistPrompt(e.target.value)
                        if (assistError) {
                          setAssistError(null)
                        }
                      }}
                      placeholder="e.g., Follow up after yesterday’s demo and suggest booking a quick recap call."
                      className="resize-none rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-200"
                      disabled={assistLoading}
                    />
                  </div>
                )}

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Templates (coming soon)
                  </div>
                  <EmailRichTextEditor
                    value={composeBody}
                    onChange={setComposeBody}
                    minHeight="260px"
                    hideVariables
                  />
                </div>

                <div className="space-y-3">
                  {assistStatus && (
                    <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      <Sparkles className="h-4 w-4" />
                      <span className="flex-1">{assistStatus}</span>
                    </div>
                  )}
                  {assistError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {assistError}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (composeAssistMode === 'improve') {
                          runDraftImprovement()
                        } else {
                          runDraftGeneration()
                        }
                      }}
                      disabled={
                        assistLoading ||
                        !composeAgentId ||
                        (composeAssistMode === 'generate' && !assistPrompt.trim())
                      }
                      className="flex items-center gap-2 rounded-2xl border-blue-200 bg-white px-5 py-2 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
                    >
                      {assistLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {composeAssistMode === 'improve'
                        ? `Improve with ${selectedComposeAgent?.name || 'agent'}`
                        : `Generate with ${selectedComposeAgent?.name || 'agent'}`}
                    </Button>
                  </div>
                </div>

                {composeError && <p className="text-sm text-red-600">{composeError}</p>}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {assistSnapshot ? (
                  <button
                    onClick={handleAssistRevert}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                    disabled={assistLoading}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Undo agent changes
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">&nbsp;</span>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    className="rounded-xl px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => {
                      setComposeOpen(false)
                      setComposeError('')
                      setAssistStatus(null)
                      setAssistError(null)
                    }}
                    disabled={assistLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleComposeSend}
                    disabled={composeSending || assistLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(120deg,#2F84FB,#31C4F5)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {composeSending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Send'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {autoReplyDraft && (
        <Dialog
          open={autoReplyModalOpen}
          onOpenChange={(open) => {
            setAutoReplyModalOpen(open)
            if (!open) {
              setAutoReplyDraft(null)
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle>Autonomous Reply</DialogTitle>
              <p className="text-xs text-slate-500">
                Prepared by {autoReplyDraft.agentName || 'Assigned agent'} • Risk {(autoReplyDraft.riskScore * 100).toFixed(0)}%
              </p>
            </DialogHeader>
            <div className="space-y-5">
              <div className="grid gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
                  <Input
                    value={autoReplyDraft.contactEmail || ''}
                    readOnly
                    className="bg-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                  <Input
                    value={autoReplyDraft.subject}
                    onChange={(e) =>
                      setAutoReplyDraft(prev => prev ? { ...prev, subject: e.target.value } : prev)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</label>
                  <Textarea
                    rows={12}
                    value={autoReplyDraft.body}
                    onChange={(e) =>
                      setAutoReplyDraft(prev => prev ? { ...prev, body: e.target.value } : prev)
                    }
                    className="font-mono text-sm"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule send</label>
                    <Input
                      type="datetime-local"
                      value={formatDateTimeLocal(autoReplyDraft.scheduledAt)}
                      onChange={(e) =>
                        setAutoReplyDraft(prev => prev ? { ...prev, scheduledAt: toIsoIfNeeded(e.target.value) } : prev)
                      }
                    />
                  </div>
                  <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <div>Status: {autoReplyDraft.status}</div>
                    <div>Risk: {(autoReplyDraft.riskScore * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original Message</span>
                  <span className="text-xs text-slate-400">
                    {autoReplyDraft.incomingFrom} • {new Date(autoReplyDraft.incomingDate).toLocaleString()}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-64 overflow-y-auto text-sm text-slate-700">
                  <div dangerouslySetInnerHTML={{ __html: autoReplyDraft.incomingPreviewHtml }} />
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setAutoReplyModalOpen(false)
                  setAutoReplyDraft(null)
                }}
              >
                Cancel
              </Button>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleAutoReplySchedule}
                  disabled={autoReplyActionLoading}
                >
                  {autoReplyActionLoading ? 'Scheduling…' : 'Save & Schedule'}
                </Button>
                <Button
                  onClick={handleAutoReplySendNow}
                  disabled={autoReplyActionLoading}
                >
                  {autoReplyActionLoading ? 'Sending…' : 'Send Now'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={detailOpen && !!selectedItem}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setSelectedItem(null)
          }
        }}
      >
        <DialogContent hideCloseButton className="w-full max-w-[95vw] sm:max-w-5xl lg:max-w-6xl rounded-3xl p-0">
          <DialogTitle className="sr-only">
            {selectedItem
              ? selectedItem.email.subject ||
                (selectedItem.type === 'inbox' ? 'Inbox email detail' : 'Sent email detail')
              : 'Email detail'}
          </DialogTitle>
          <div className="flex max-h-[90vh] flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {renderDetail()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
