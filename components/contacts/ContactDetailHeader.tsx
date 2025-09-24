'use client'

import { useState } from 'react'
import { Contact } from '@/lib/contacts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseCompanyName } from '@/lib/contact-utils'
import { EngagementBadge } from './EngagementBadge'
import { EnrichmentBadges } from './EnrichmentBadges'
import { EditContactModal } from './EditContactModal'
import type { ContactEngagementStatus } from '@/lib/contact-engagement'
import {
  ArrowLeft,
  User,
  Building,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Edit,
  Star,
  Send,
  List,
  Copy,
  Trash2,
  MoreVertical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ContactDetailHeaderProps {
  contact: Contact
  onBackToList: () => void
  onContactUpdate: (contact: Contact) => void
}

export function ContactDetailHeader({
  contact,
  onBackToList,
  onContactUpdate
}: ContactDetailHeaderProps) {
  const [isStarred, setIsStarred] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const formatName = (contact: Contact) => {
    const firstName = contact.first_name || ''
    const lastName = contact.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()

    if (fullName) {
      return fullName
    }

    const companyName = parseCompanyName(contact.company)
    if (companyName && companyName.trim()) {
      return companyName.trim()
    }

    return contact.email
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'unsubscribed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'bounced':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'complained':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const handleToggleStar = () => {
    setIsStarred(!isStarred)
    // TODO: Implement star functionality with API call
  }

  const handleEdit = () => {
    setIsEditModalOpen(true)
  }

  const handleContactUpdated = () => {
    // Refresh the contact data by calling the parent's update function
    // The modal will handle updating the contact data via API
    window.location.reload() // Simple refresh for now, could be improved with proper state management
  }

  const handleSendEmail = () => {
    // TODO: Open email composer or create campaign
    console.log('Send email')
  }

  const handleAddToList = () => {
    // TODO: Open add to list modal
    console.log('Add to list')
  }

  const handleDuplicate = () => {
    // TODO: Duplicate contact
    console.log('Duplicate contact')
  }

  const handleDelete = () => {
    // TODO: Delete contact with confirmation
    console.log('Delete contact')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Top Action Row */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={onBackToList}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleStar}
            className={isStarred ? 'text-yellow-500' : 'text-gray-400'}
          >
            <Star className={`h-4 w-4 ${isStarred ? 'fill-current' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Contact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSendEmail}>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddToList}>
                <List className="h-4 w-4 mr-2" />
                Add to Campaign/List
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Contact
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contact Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Main Contact Info */}
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="h-6 w-6 text-blue-600" />
            </div>

            {/* Name and Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 truncate">
                    {formatName(contact)}
                  </h1>
                  {contact.position && (
                    <p className="text-base text-gray-600 mt-1">{contact.position}</p>
                  )}
                  {parseCompanyName(contact.company) && (
                    <div className="flex items-center gap-2 mt-1">
                      <Building className="h-3 w-3 text-gray-400" />
                      <p className="text-sm text-gray-600 truncate">{parseCompanyName(contact.company)}</p>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor((contact as any).status || 'active')}>
                    {(contact as any).status || 'active'}
                  </Badge>
                </div>
              </div>

              {/* Contact Methods */}
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-gray-400" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-blue-600 hover:text-blue-800 truncate"
                  >
                    {contact.email}
                  </a>
                </div>

                {contact.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-gray-400" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3 text-gray-400" />
                    <a
                      href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 truncate"
                    >
                      {contact.website}
                    </a>
                  </div>
                )}

                {contact.linkedin_url && (
                  <div className="flex items-center gap-1">
                    <Linkedin className="h-3 w-3 text-gray-400" />
                    <a
                      href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 truncate"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
              </div>

              {/* Enrichment and Engagement Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <EnrichmentBadges
                  contact={contact}
                />
                <EngagementBadge
                  status={((contact as any).engagement_status || 'not_contacted') as ContactEngagementStatus}
                  score={(contact as any).engagement_score || 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Stats */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Email Engagement</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white rounded p-2 text-center">
                <p className="text-xs text-gray-500">Sent</p>
                <p className="text-base font-semibold text-gray-900">
                  {(contact as any).engagement_sent_count || 0}
                </p>
              </div>
              <div className="bg-green-50 rounded p-2 text-center">
                <p className="text-xs text-gray-500">Opened</p>
                <p className="text-base font-semibold text-green-600">
                  {(contact as any).engagement_open_count || 0}
                </p>
              </div>
              <div className="bg-blue-50 rounded p-2 text-center">
                <p className="text-xs text-gray-500">Clicked</p>
                <p className="text-base font-semibold text-blue-600">
                  {(contact as any).engagement_click_count || 0}
                </p>
              </div>
              <div className="bg-purple-50 rounded p-2 text-center">
                <p className="text-xs text-gray-500">Replied</p>
                <p className="text-base font-semibold text-purple-600">
                  {(contact as any).engagement_reply_count || 0}
                </p>
              </div>
            </div>

            {/* Engagement Score */}
            {(contact as any).engagement_score !== undefined && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Engagement Score</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {Math.min(Math.round(((contact as any).engagement_score || 0) * 100), 100)}%
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(Math.round(((contact as any).engagement_score || 0) * 100), 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Contact Modal */}
      <EditContactModal
        contact={contact}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onContactUpdated={handleContactUpdated}
      />
    </div>
  )
}