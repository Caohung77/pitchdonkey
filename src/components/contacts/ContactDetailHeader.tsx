'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowLeft,
  Edit,
  MoreHorizontal,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Building,
  User,
  Calendar,
  Star,
  StarOff
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getEngagementStatusInfo, getEngagementScoreColor } from '@/lib/contact-engagement'

interface Contact {
  id: string
  email: string
  first_name?: string
  last_name?: string
  company?: string
  job_title?: string
  phone?: string
  website?: string
  linkedin_url?: string
  engagement_status?: string
  engagement_score?: number
  engagement_sent_count?: number
  engagement_open_count?: number
  engagement_click_count?: number
  engagement_reply_count?: number
  engagement_bounce_count?: number
  engagement_last_positive_at?: string
  notes?: string
  custom_fields?: Record<string, any>
  enriched_data?: Record<string, any>
  created_at: string
  updated_at: string
}

interface ContactDetailHeaderProps {
  contact: Contact
  onBackToList: () => void
  onContactUpdate: (contact: Contact) => void
}

export function ContactDetailHeader({ contact, onBackToList, onContactUpdate }: ContactDetailHeaderProps) {
  const [isStarred, setIsStarred] = useState(false) // TODO: Add starred field to contact model

  const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact'
  const engagementStatus = getEngagementStatusInfo(contact.engagement_status as any)
  const scoreColors = getEngagementScoreColor(contact.engagement_score || 0)

  const handleStarToggle = () => {
    setIsStarred(!isStarred)
    // TODO: Implement starring functionality
  }

  const handleQuickActions = {
    sendEmail: () => {
      // TODO: Implement email sending
      console.log('Send email to:', contact.email)
    },
    addToList: () => {
      // TODO: Implement add to list
      console.log('Add to list:', contact.id)
    },
    addToCampaign: () => {
      // TODO: Implement add to campaign
      console.log('Add to campaign:', contact.id)
    },
    duplicate: () => {
      // TODO: Implement duplication
      console.log('Duplicate contact:', contact.id)
    },
    delete: () => {
      // TODO: Implement deletion with confirmation
      console.log('Delete contact:', contact.id)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-4">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={onBackToList}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Contacts</span>
          </Button>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStarToggle}
              className="text-gray-500 hover:text-yellow-500"
            >
              {isStarred ? (
                <Star className="h-4 w-4 fill-current text-yellow-500" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleQuickActions.sendEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleQuickActions.addToList}>
                  Add to List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleQuickActions.addToCampaign}>
                  Add to Campaign
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleQuickActions.duplicate}>
                  Duplicate Contact
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleQuickActions.delete}
                  className="text-red-600 focus:text-red-600"
                >
                  Delete Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Contact Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Name and Title */}
            <div className="mb-3">
              <div className="flex items-center space-x-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 truncate">{contactName}</h1>
                <Badge className={`${scoreColors.bgColor} ${scoreColors.color} border-0 text-xs px-2 py-1 flex-shrink-0`}>
                  {Math.min(contact.engagement_score || 0, 100)}%
                </Badge>
              </div>

              {(contact.job_title || contact.company) && (
                <div className="flex items-center space-x-2 text-base text-gray-600">
                  {contact.job_title && (
                    <>
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{contact.job_title}</span>
                    </>
                  )}
                  {contact.job_title && contact.company && <span className="text-gray-400">•</span>}
                  {contact.company && (
                    <>
                      <Building className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium truncate">{contact.company}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
              {contact.email && (
                <div className="flex items-center space-x-1">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:text-blue-600 truncate">
                    {contact.email}
                  </a>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center space-x-1">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                    {contact.phone}
                  </a>
                </div>
              )}

              {contact.website && (
                <div className="flex items-center space-x-1">
                  <Globe className="h-3 w-3 flex-shrink-0" />
                  <a
                    href={contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600"
                  >
                    Website
                  </a>
                </div>
              )}

              {contact.linkedin_url && (
                <div className="flex items-center space-x-1">
                  <Linkedin className="h-3 w-3 flex-shrink-0" />
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600"
                  >
                    LinkedIn
                  </a>
                </div>
              )}
            </div>

            {/* Engagement Status and Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge className={`${engagementStatus.bgColor} ${engagementStatus.color} border-0 text-xs`}>
                {engagementStatus.label}
              </Badge>

              <div className="flex items-center space-x-1 text-gray-500">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">Added {formatDate(contact.created_at)}</span>
              </div>

              {contact.engagement_last_positive_at && (
                <div className="flex items-center space-x-1 text-gray-500">
                  <span className="text-xs">Last engaged {formatDate(contact.engagement_last_positive_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3 text-center min-w-[280px] flex-shrink-0">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-lg font-bold text-gray-900">
                {contact.engagement_sent_count || 0}
              </div>
              <div className="text-xs text-gray-600">Sent</div>
            </div>

            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-lg font-bold text-green-600">
                {contact.engagement_open_count || 0}
              </div>
              <div className="text-xs text-gray-600">Opens</div>
            </div>

            <div className="bg-blue-50 rounded-lg p-2">
              <div className="text-lg font-bold text-blue-600">
                {contact.engagement_click_count || 0}
              </div>
              <div className="text-xs text-gray-600">Clicks</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-2">
              <div className="text-lg font-bold text-purple-600">
                {contact.engagement_reply_count || 0}
              </div>
              <div className="text-xs text-gray-600">Replies</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}