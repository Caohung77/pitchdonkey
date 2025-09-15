'use client'

import { useEffect, useMemo, useState } from 'react'
import { 
  Mail,
  MailOpen,
  Trash2,
  User,
  Target,
  Clock,
  AlertCircle,
  MessageSquare,
  CheckCircle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

interface EmailReply {
  campaign_id: string | null
  contact_id: string | null
  campaigns: Campaign | null
  contacts: Contact | null
}

interface IncomingEmail {
  id: string
  from_address: string
  to_address?: string
  subject: string
  date_received: string
  classification_status: 'unclassified' | 'bounce' | 'auto_reply' | 'human_reply' | 'unsubscribe' | 'spam'
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  classification_confidence: number | null
  text_content: string | null
  html_content: string | null
  created_at: string
  email_accounts: EmailAccount
  email_replies: EmailReply[]
}

interface EmailListItemProps {
  email: IncomingEmail
  onEmailClick: (email: IncomingEmail) => void
  onDelete: (emailId: string) => void
  onContactClick?: (contact: Contact) => void
  onOpenThread?: (email: IncomingEmail) => void
  isSelected?: boolean
  selectionMode?: boolean
  onSelectionToggle?: (emailId: string) => void
}

export const EmailListItem: React.FC<EmailListItemProps> = ({
  email,
  onEmailClick,
  onDelete,
  onContactClick,
  onOpenThread,
  isSelected = false,
  selectionMode = false,
  onSelectionToggle
}) => {
  const [lookupContact, setLookupContact] = useState<Contact | null>(null)
  const [lookupTried, setLookupTried] = useState(false)


  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      onSelectionToggle?.(email.id)
    } else {
      // Navigate directly to single-column email view
      onOpenThread?.(email)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onOpenThread?.(email)
  }

  const handleContactClick = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation()
    onContactClick?.(contact)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(email.id)
  }

  const getClassificationBadge = (classification: string, confidence: number | null) => {
    const badges = {
      human_reply: { icon: MessageSquare, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Reply' },
      bounce: { icon: AlertCircle, color: 'bg-red-50 text-red-700 border-red-200', label: 'Bounce' },
      auto_reply: { icon: Clock, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Auto-Reply' },
      unsubscribe: { icon: Trash2, color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Unsubscribe' },
      spam: { icon: AlertCircle, color: 'bg-gray-50 text-gray-700 border-gray-200', label: 'Spam' },
      unclassified: { icon: Mail, color: 'bg-slate-50 text-slate-600 border-slate-200', label: 'Unclassified' }
    }

    const badge = badges[classification as keyof typeof badges] || badges.unclassified
    const Icon = badge.icon

    return (
      <Badge variant="secondary" className={`${badge.color} border flex items-center gap-1.5 px-2 py-1 text-xs font-medium`}>
        <Icon className="h-3 w-3" />
        {badge.label}
        {confidence && confidence > 0.7 && (
          <span className="text-xs opacity-75 ml-1">
            {Math.round(confidence * 100)}%
          </span>
        )}
      </Badge>
    )
  }

  const getContactInfo = (email: IncomingEmail) => {
    return email.email_replies?.[0]?.contacts || null
  }

  const getCampaignInfo = (email: IncomingEmail) => {
    return email.email_replies?.[0]?.campaigns || null
  }

  const getContactDisplayName = (contact: Contact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    }
    return contact.email
  }

  const getEmailPreview = (email: IncomingEmail) => {
    const text = email.text_content || email.html_content?.replace(/<[^>]*>/g, '') || ''
    return text.length > 120 ? `${text.substring(0, 120)}...` : text
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const isUnread = email.processing_status !== 'completed'
  const contact = getContactInfo(email) || lookupContact || null
  const campaign = getCampaignInfo(email)

  // Prefer showing the other participant. If the IMAP record's from equals the
  // account email, fall back to a recipient that isn't the account (from `to_address`).
  const extractFirstEmail = (value?: string) => {
    if (!value) return ''
    // Try angle-bracket first
    const m = value.match(/<([^>]+)>/)
    if (m) return m[1].trim()
    // Fallback simple email pattern
    const m2 = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    return m2 ? m2[0] : value
  }

  const accountEmail = (email.email_accounts?.email || '').toLowerCase()
  const fromAddr = extractFirstEmail(email.from_address).toLowerCase()
  const toAddr = extractFirstEmail(email.to_address).toLowerCase()

  const counterpartyEmail = useMemo(() => {
    if (accountEmail && fromAddr === accountEmail) {
      if (toAddr && toAddr !== accountEmail) return toAddr
    }
    return fromAddr
  }, [accountEmail, fromAddr, toAddr])

  // Lookup contact by counterparty email if not provided via relations
  useEffect(() => {
    const doLookup = async () => {
      if (contact || lookupTried || !counterpartyEmail) return
      try {
        setLookupTried(true)
        const resp = await fetch(`/api/contacts/lookup?email=${encodeURIComponent(counterpartyEmail)}`)
        if (resp.ok) {
          const data = await resp.json()
          if (data?.contact) setLookupContact(data.contact)
        }
      } catch {}
    }
    doLookup()
  }, [contact, counterpartyEmail, lookupTried])

  const displayFrom = (() => {
    // If the sender appears to be the account itself, show the counterparty
    if (accountEmail && fromAddr === accountEmail) {
      if (contact) return `${getContactDisplayName(contact)} <${contact.email}>`
      if (toAddr && toAddr !== accountEmail) return email.to_address as string
    }
    if (contact) return `${getContactDisplayName(contact)} <${counterpartyEmail || extractFirstEmail(email.from_address)}>`
    return email.from_address
  })()

  return (
    <div className="relative">
      {/* Email Item */}
      <div
        className={`
          relative bg-white border border-slate-200 rounded-xl shadow-sm 
          transition-all duration-200 cursor-pointer
          ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'hover:shadow-md hover:border-slate-300'}
          ${isUnread ? 'border-l-4 border-l-blue-500' : ''}
        `}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="p-4">
          <div className="flex items-start gap-4">
            {/* Selection Checkbox / Email Icon */}
            <div className="flex-shrink-0 mt-1">
              {selectionMode ? (
                <div className={`
                  w-5 h-5 border-2 rounded flex items-center justify-center
                  ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}
                `}>
                  {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                </div>
              ) : (
                <div className="p-1">
                  {isUnread ? (
                    <Mail className="h-4 w-4 text-blue-600" />
                  ) : (
                    <MailOpen className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              )}
            </div>

            {/* Email Content */}
            <div className="flex-1 min-w-0">
              {/* Header Row */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <p className={`
                    truncate text-sm
                    ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}
                  `}>
                    {displayFrom}
                  </p>
                  {getClassificationBadge(email.classification_status, email.classification_confidence)}
                </div>
                <time className="flex-shrink-0 text-xs text-slate-500 font-medium">
                  {formatDate(email.date_received)}
                </time>
              </div>

              {/* Subject */}
              <h3 className={`
                text-sm truncate mb-2
                ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}
              `}>
                {email.subject || '(No Subject)'}
              </h3>

              {/* Metadata Row (Gmail-style) */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4 text-xs text-slate-600 min-w-0">
                  {campaign && (
                    <span className="inline-flex items-center gap-1.5 text-blue-600">
                      <Target className="h-3 w-3" />
                      <span className="truncate max-w-32">{campaign.name}</span>
                    </span>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {contact ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => handleContactClick(e as any, contact)}
                    >
                      View Contact
                    </Button>
                  ) : (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        const evt = new CustomEvent('inbox:add-contact', { detail: { email: counterpartyEmail } })
                        window.dispatchEvent(evt)
                      }}
                    >
                      Add Contact
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Preview */}
              <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                {getEmailPreview(email)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
