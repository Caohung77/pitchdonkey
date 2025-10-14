'use client'

import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import { Contact } from '@/lib/contacts'
import { AIQueryResult } from '@/lib/ai-contact-query-service'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Mail,
  Building,
  MapPin,
  Sparkles,
  TrendingUp,
  Search,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { useState } from 'react'
import { ContactDetailModal } from './ContactDetailModal'
import { parseCompanyName } from '@/lib/contact-utils'
import { EngagementBadge } from '@/components/contacts/EngagementBadge'
import type { ContactEngagementStatus } from '@/lib/contact-engagement'

/**
 * Custom ToolUI for displaying AI contact query results in the chat
 * This renders contact cards inline with the conversation
 */
export const ContactQueryToolUI: ToolCallMessagePartComponent<
  { query: string; agentId: string }, // Tool arguments
  AIQueryResult // Tool result type
> = ({ args, status, result }) => {
  // Loading state
  if (status.type === 'running') {
    return (
        <Card className="my-2 border border-blue-200 bg-gradient-to-br from-blue-50/50 to-purple-50/30 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-900">
                Searching contacts...
              </p>
              <p className="text-xs text-gray-500">
                {args.query}
              </p>
            </div>
          </CardContent>
        </Card>
    )
  }

  // Error state
  if (status.type === 'error') {
    return (
        <Card className="my-2 border border-red-200 bg-red-50/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <Search className="h-4 w-4" />
              <p>Failed to search contacts. Please try again.</p>
            </div>
          </CardContent>
        </Card>
    )
  }

  // Success state - render contact results
  if (!result || !result.contacts) {
    return null
  }

  return (
      <div className="my-3 space-y-3">
        {/* Query summary header */}
        <Card className="border border-blue-100 bg-gradient-to-br from-blue-50/40 to-transparent shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Found {result.contacts.length} contact{result.contacts.length === 1 ? '' : 's'}
                </p>
                {result.reasoning && (
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">
                    {result.reasoning}
                  </p>
                )}
                {result.functionsUsed && result.functionsUsed.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.functionsUsed.map((func, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <Sparkles className="mr-1 h-3 w-3" />
                        {formatFunctionName(func.name)} ({func.resultCount})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact cards */}
        {result.contacts.length > 0 && (
          <div className="grid gap-2.5">
            {result.contacts.slice(0, 8).map((contact) => (
              <ContactCardInline key={contact.id} contact={contact} />
            ))}
            {result.contacts.length > 8 && (
              <Card className="border border-gray-200 bg-gray-50">
                <CardContent className="p-3 text-center text-xs text-gray-600">
                  +{result.contacts.length - 8} more contact{result.contacts.length - 8 === 1 ? '' : 's'}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
  )
}

/**
 * Inline contact card component for chat display
 */
function ContactCardInline({ contact }: { contact: Contact }) {
  const [showModal, setShowModal] = useState(false)

  const formatName = (contact: Contact) => {
    const firstName = contact.first_name || ''
    const lastName = contact.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()

    if (fullName) return fullName

    const companyName = parseCompanyName(contact.company)
    if (companyName?.trim()) return companyName.trim()

    return contact.email
  }

  const name = formatName(contact)
  const location = [contact.city, contact.country].filter(Boolean).join(', ')
  const companyName = parseCompanyName(contact.company)
  const isCompanyAsName = !contact.first_name && !contact.last_name && companyName

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md"
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10 flex-shrink-0 bg-gradient-to-br from-blue-100 to-purple-100 text-blue-700 ring-2 ring-blue-50">
            <AvatarFallback className="text-sm font-semibold">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Contact info */}
          <div className="flex-1 min-w-0">
            {/* Name and engagement */}
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {name}
              </h4>
              {contact.engagement_status && (
                <EngagementBadge
                  status={contact.engagement_status as ContactEngagementStatus}
                  score={contact.engagement_score}
                  size="sm"
                />
              )}
            </div>

            {/* Email */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Mail className="h-3 w-3 flex-shrink-0 text-gray-400" />
              <span className="text-xs text-gray-600 truncate">{contact.email}</span>
            </div>

            {/* Company and position */}
            {(() => {
              let displayText = ''
              if (isCompanyAsName && contact.position) {
                displayText = contact.position
              } else if (contact.position && companyName) {
                displayText = `${contact.position} at ${companyName}`
              } else if (contact.position) {
                displayText = contact.position
              } else if (companyName && !isCompanyAsName) {
                displayText = companyName
              }

              return displayText ? (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Building className="h-3 w-3 flex-shrink-0 text-gray-400" />
                  <span className="text-xs text-gray-600 truncate">{displayText}</span>
                </div>
              ) : null
            })()}

            {/* Location */}
            {location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />
                <span className="text-xs text-gray-500 truncate">{location}</span>
              </div>
            )}

            {/* Engagement score */}
            {contact.engagement_score !== undefined && contact.engagement_score > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-blue-500" />
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all"
                      style={{ width: `${Math.min(contact.engagement_score, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-600">
                  {contact.engagement_score}
                </span>
              </div>
            )}
          </div>
        </div>
      </button>

      <ContactDetailModal
        contact={contact}
        open={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  )
}

/**
 * Format function name for display
 */
function formatFunctionName(name: string): string {
  const nameMap: Record<string, string> = {
    query_contacts_basic: 'Profile Filter',
    query_contacts_by_engagement: 'Engagement',
    query_never_contacted: 'Never Contacted',
    query_contacts_by_agent_fit: 'ICP Fit',
    query_contacts_by_status: 'Status',
    query_contacts_by_recency: 'Recency',
    query_contacts_by_enrichment: 'Enrichment',
    query_contact_by_name: 'Name Search'
  }

  return nameMap[name] || name
}
