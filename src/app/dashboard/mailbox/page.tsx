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

  // Mobile navigation state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [showEmailContent, setShowEmailContent] = useState(false)

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
      if (accountId) params.append('account_id', accountId)
      if (classificationFilter !== 'all') params.append('classification', classificationFilter)
      if (searchTerm) params.append('search', searchTerm)
      const response = await fetch(`/api/inbox/emails?${params.toString()}`)
      if (!response.ok) {
        setErrorMessage('Failed to load inbox emails')
        return
      }
      const data = await response.json()
      setInboxEmails(data.emails || [])
    } catch (error) {
      console.error('Error fetching inbox emails:', error)
      setErrorMessage('Failed to load inbox emails')
    } finally {
      setLoadingList(false)
    }
  }

  const fetchSentEmails = async (accountId: string | null) => {
    try {
      setLoadingList(true)
      setErrorMessage('')
      const params = new URLSearchParams()
      if (accountId) params.append('account_id', accountId)
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

  const getAccountLabel = (accountId: string | null) => {
    if (!accountId) return 'All accounts'
    const account = emailAccounts.find(acc => acc.id === accountId)
    return account ? account.email : 'Unknown account'
  }

  const composeTitle = composeMode === 'reply'
    ? 'Reply to email'
    : composeMode === 'forward'
    ? 'Forward email'
    : 'New email'

  const handleMailboxSelect = (key: string) => {
    setSelectedMailboxKey(key)
    setSearchTerm('')
    setClassificationFilter('all')
    setSelectedItem(null)
    setIsMobileSidebarOpen(false) // Close mobile sidebar after selection
    setShowEmailContent(false) // Reset to show email list on mobile
  }

  const renderInboxListItem = (email: IncomingEmail) => {
    const from = email.from_address || 'Unknown sender'
    const preview = email.text_content?.slice(0, 120) || email.html_content?.replace(/<[^>]*>/g, '').slice(0, 120) || ''
    const isActive = selectedItem?.type === 'inbox' && selectedItem.email.id === email.id
    return (
      <button
        key={email.id}
        onClick={() => {
          setSelectedItem({ type: 'inbox', email })
          setShowEmailContent(true) // Show email content on mobile
        }}
        className={clsx(
          'w-full text-left rounded-lg border px-4 py-3 transition-colors',
          isActive ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{email.subject || '(No subject)'}</p>
            <p className="text-xs text-gray-500 truncate">{from}</p>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(email.date_received)}</span>
        </div>
        {preview && (
          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
            {preview}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 capitalize">
            {email.classification_status.replace('_', ' ')}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
            {email.email_accounts?.email || 'Unknown account'}
          </span>
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
          setShowEmailContent(true) // Show email content on mobile
        }}
        className={clsx(
          'w-full text-left rounded-lg border px-4 py-3 transition-colors',
          isActive ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{email.subject || '(No subject)'}</p>
            <p className="text-xs text-gray-500 truncate">To: {to}</p>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(email.sent_at || email.created_at)}</span>
        </div>
        {preview && (
          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
            {preview}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 capitalize">
            {email.send_status}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
            {email.email_accounts?.email || 'Unknown account'}
          </span>
        </div>
      </button>
    )
  }

  const renderDetail = () => {
    if (!selectedItem) {
      return (
        <div className="flex h-full items-center justify-center text-gray-500">
          <p className="text-center">
            <span className="block">Select an email to preview.</span>
            <span className="mt-2 block text-sm text-gray-400">Choose a folder on the left, then pick a message to see its contents.</span>
          </p>
        </div>
      )
    }

    if (selectedItem.type === 'inbox') {
      const email = selectedItem.email
      const contact = email.email_replies?.[0]?.contacts || null
      const campaign = email.email_replies?.[0]?.campaigns || null
      return (
        <div className="h-full overflow-auto">
          {/* Apple Mail-inspired Toolbar */}
          <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-800 truncate max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
                    {email.subject || '(No subject)'}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                      {email.classification_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              <MailboxToolbar
                onReply={() => beginCompose('reply')}
                onForward={() => beginCompose('forward')}
                onNewEmail={() => beginCompose('new')}
                onDelete={() => deleteInboxEmail(email.id)}
                isInboxEmail={true}
              />
            </div>
          </div>

          {/* Email Header Content */}
          <div className="border-b border-gray-200 bg-white px-8 py-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 leading-tight">{email.subject || '(No subject)'}</h2>
                <p className="mt-2 text-base text-gray-700 font-medium">From {email.from_address}</p>
                {email.to_address && (
                  <p className="text-sm text-gray-600">To {email.to_address}</p>
                )}
                <p className="mt-3 text-sm text-gray-500">Received {new Date(email.date_received).toLocaleString()}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 capitalize">
                    Status: {email.classification_status.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 capitalize">
                    Processing: {email.processing_status}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    Account: {email.email_accounts?.email || 'Unknown'}
                  </span>
                  {campaign && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      Campaign: {campaign.name}
                    </span>
                  )}
                  {contact && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      Contact: {getContactDisplayName(contact)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="px-8 py-8">
            <div className="max-w-4xl">
              {email.html_content ? (
                <div
                  className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:hover:text-blue-700"
                  dangerouslySetInnerHTML={{ __html: email.html_content }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-base text-gray-700 leading-relaxed font-sans">
                  {email.text_content || 'No content available'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )
    }

    const email = selectedItem.email
    return (
      <div className="h-full overflow-auto">
        {/* Apple Mail-inspired Toolbar */}
        <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-800 truncate max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
                  {email.subject || '(No subject)'}
                </h3>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                    {email.send_status}
                  </span>
                </div>
              </div>
            </div>
            <MailboxToolbar
              onReply={() => beginCompose('reply')}
              onForward={() => beginCompose('forward')}
              onNewEmail={() => beginCompose('new')}
              onDelete={() => {}}
              isInboxEmail={false}
            />
          </div>
        </div>

        {/* Email Header Content */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 leading-tight">{email.subject || '(No subject)'}</h2>
              <p className="mt-2 text-base text-gray-700 font-medium">
                Sent from {email.email_accounts?.email || 'Unknown account'}
              </p>
              {email.contacts && (
                <p className="text-sm text-gray-600">
                  To {getContactDisplayName(email.contacts)}
                </p>
              )}
              <p className="mt-3 text-sm text-gray-500">
                {email.sent_at ? `Sent ${new Date(email.sent_at).toLocaleString()}` : 'Not yet sent'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 capitalize">
                  Status: {email.send_status}
                </span>
                {email.campaigns && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    Campaign: {email.campaigns.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="px-8 py-8">
          <div className="max-w-4xl">
            <pre className="whitespace-pre-wrap text-base text-gray-700 leading-relaxed font-sans">
              {email.content || 'No content available'}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  // Mobile Sidebar Component
  const renderMobileSidebar = () => (
    <>
      {/* Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={clsx(
        'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 md:hidden',
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Mailbox</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto h-full pb-20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unified mailboxes</p>
          <div className="mt-3 space-y-1">
            <button
              onClick={() => handleMailboxSelect('all:inbox')}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                selectedMailboxKey === 'all:inbox'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Inbox className="h-4 w-4 flex-shrink-0" />
              <span>All Inboxes</span>
            </button>
            <button
              onClick={() => handleMailboxSelect('all:outbox')}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                selectedMailboxKey === 'all:outbox'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Send className="h-4 w-4 flex-shrink-0" />
              <span>All Sent</span>
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {emailAccounts.map((account) => {
              const isActiveInbox = selectedMailboxKey === `${account.id}:inbox`
              const isActiveSent = selectedMailboxKey === `${account.id}:outbox`
              return (
                <div key={account.id}>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <CircleDot className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{account.email}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <button
                      onClick={() => handleMailboxSelect(`${account.id}:inbox`)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                        isActiveInbox ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Inbox className="h-4 w-4 flex-shrink-0" />
                        <span>Inbox</span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    </button>
                    <button
                      onClick={() => handleMailboxSelect(`${account.id}:outbox`)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                        isActiveSent ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Send className="h-4 w-4 flex-shrink-0" />
                        <span>Sent</span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </aside>
    </>
  )

  return (
    <>
      <div className="flex h-full bg-gray-50 max-w-[95vw] mx-auto">
      {renderMobileSidebar()}
      <aside className="hidden md:flex w-44 lg:w-48 xl:w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-3 xl:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unified mailboxes</p>
          <div className="mt-3 space-y-1">
            <button
              onClick={() => handleMailboxSelect('all:inbox')}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-2 xl:px-3 py-2 text-sm font-medium transition-colors',
                selectedMailboxKey === 'all:inbox'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Inbox className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">All Inboxes</span>
            </button>
            <button
              onClick={() => handleMailboxSelect('all:outbox')}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-2 xl:px-3 py-2 text-sm font-medium transition-colors',
                selectedMailboxKey === 'all:outbox'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Send className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">All Sent</span>
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {emailAccounts.map((account) => {
              const isActiveInbox = selectedMailboxKey === `${account.id}:inbox`
              const isActiveSent = selectedMailboxKey === `${account.id}:outbox`
              return (
                <div key={account.id}>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <CircleDot className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate" title={account.email}>{account.email}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <button
                      onClick={() => handleMailboxSelect(`${account.id}:inbox`)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-lg px-2 xl:px-3 py-2 text-sm transition-colors',
                        isActiveInbox ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Inbox className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Inbox</span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    </button>
                    <button
                      onClick={() => handleMailboxSelect(`${account.id}:outbox`)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-lg px-2 xl:px-3 py-2 text-sm transition-colors',
                        isActiveSent ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Send className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Sent</span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-gray-200 bg-white px-4 md:px-6 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Mobile back button for email content */}
              {showEmailContent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEmailContent(false)}
                  className="md:hidden"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
              )}

              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Mailbox</h1>
                <p className="text-sm text-gray-600">
                  {mailboxTarget.folder === 'inbox' ? 'Inbox' : 'Sent'} • {getAccountLabel(mailboxTarget.accountId)} • {currentCount} message{currentCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mailboxTarget.folder === 'inbox' && (
                <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
                  <RefreshCw className={clsx('h-4 w-4', syncing && 'animate-spin')} />
                  <span className="ml-2 hidden sm:inline">Sync</span>
                </Button>
              )}
            </div>
          </div>
          {syncStatus && (
            <div className="mt-2 text-xs text-blue-600">{syncStatus}</div>
          )}
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={mailboxTarget.folder === 'inbox' ? 'Search incoming mail…' : 'Search sent mail…'}
                className="pl-9"
              />
            </div>
            {mailboxTarget.folder === 'inbox' && (
              <Select value={classificationFilter} onValueChange={(value) => setClassificationFilter(value as typeof classificationFilter)}>
                <SelectTrigger className="w-full lg:w-52">
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
        </header>

        {errorMessage && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Email List - Responsive width */}
          <section className={clsx(
            'bg-gray-50 overflow-y-auto flex-shrink-0 border-r border-gray-200',
            'w-full md:w-[42%] lg:w-[38%] xl:w-[32%] md:min-w-[320px] md:max-w-[480px]',
            showEmailContent ? 'hidden md:block' : 'block'
          )}>
            {loadingList ? (
              <div className="flex h-full items-center justify-center text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : currentEmails.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-500">
                <Mail className="h-10 w-10" />
                <p className="mt-3 text-sm">No emails found</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {mailboxTarget.folder === 'inbox'
                  ? inboxEmails.map((email) => renderInboxListItem(email))
                  : sentEmails.map((email) => renderSentListItem(email))}
              </div>
            )}
          </section>
          </div>
        </div>

      {/* Email Content - Responsive width for better reading experience */}
      <section className={clsx(
        'bg-white min-w-0',
        'flex-1',
        showEmailContent ? 'block' : 'hidden md:block'
      )}>
        {renderDetail()}
      </section>
      </div>

      <Dialog
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open)
          if (!open) setComposeError('')
        }}
      >
        <DialogContent className="max-w-3xl">
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
    </>
  )
}
