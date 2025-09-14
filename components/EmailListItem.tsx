'use client'

import { motion } from 'framer-motion'
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
import { useSwipeGesture } from '../hooks/useSwipeGesture'

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
  isSelected?: boolean
  selectionMode?: boolean
  onSelectionToggle?: (emailId: string) => void
}

export const EmailListItem: React.FC<EmailListItemProps> = ({
  email,
  onEmailClick,
  onDelete,
  onContactClick,
  isSelected = false,
  selectionMode = false,
  onSelectionToggle
}) => {
  const { swipeState, handlers, resetSwipe } = useSwipeGesture({
    onSwipeLeft: () => onDelete(email.id),
    threshold: 80,
    preventScrollOnSwipe: true,
  })

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click if we're in the middle of a swipe
    if (swipeState.isSwipeActive || swipeState.isSwiped) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (selectionMode) {
      onSelectionToggle?.(email.id)
    } else {
      onEmailClick(email)
    }
  }

  const handleContactClick = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation()
    if (!swipeState.isSwipeActive) {
      onContactClick?.(contact)
    }
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
  const contact = getContactInfo(email)
  const campaign = getCampaignInfo(email)

  return (
    <div className="relative">
      {/* Delete Action Background */}
      <motion.div
        className="absolute inset-0 bg-red-500 rounded-xl flex items-center justify-end px-6"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: swipeState.translateX < -40 ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center gap-2 text-white font-medium">
          <Trash2 className="h-5 w-5" />
          <span>Delete</span>
        </div>
      </motion.div>

      {/* Email Item */}
      <motion.div
        className={`
          relative bg-white border border-slate-200 rounded-xl shadow-sm 
          transition-all duration-200 cursor-pointer
          ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'hover:shadow-md hover:border-slate-300'}
          ${isUnread ? 'border-l-4 border-l-blue-500' : ''}
        `}
        animate={{
          x: swipeState.translateX,
          scale: swipeState.isSwipeActive ? 0.98 : 1,
        }}
        transition={{ 
          type: "spring",
          stiffness: 300,
          damping: 30 
        }}
        onClick={handleClick}
        {...handlers}
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
                    {email.from_address}
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

              {/* Metadata Row */}
              {(contact || campaign) && (
                <div className="flex items-center gap-4 mb-2 text-xs text-slate-600">
                  {contact && (
                    <button
                      className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                      onClick={(e) => handleContactClick(e, contact)}
                    >
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-32">
                        {getContactDisplayName(contact)}
                      </span>
                    </button>
                  )}
                  {campaign && (
                    <span className="inline-flex items-center gap-1.5 text-blue-600">
                      <Target className="h-3 w-3" />
                      <span className="truncate max-w-32">{campaign.name}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Preview */}
              <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                {getEmailPreview(email)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}