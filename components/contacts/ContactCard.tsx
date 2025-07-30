'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  Building, 
  Globe, 
  Phone,
  MoreHorizontal,
  Edit,
  Trash2,
  Tag
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Contact {
  id: string
  email: string
  first_name: string
  last_name: string
  company_name?: string
  job_title?: string
  website?: string
  phone?: string
  tags: string[]
  status: 'active' | 'unsubscribed' | 'bounced' | 'deleted'
  email_status: 'valid' | 'invalid' | 'risky' | 'unknown'
  created_at: string
}

interface ContactCardProps {
  contact: Contact
  onEdit?: (contact: Contact) => void
  onDelete?: (contactId: string) => void
  onAddTag?: (contactId: string) => void
  onSelect?: (contactId: string, selected: boolean) => void
  isSelected?: boolean
}

export function ContactCard({
  contact,
  onEdit,
  onDelete,
  onAddTag,
  onSelect,
  isSelected = false
}: ContactCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'unsubscribed':
        return 'bg-gray-100 text-gray-800'
      case 'bounced':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getEmailStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-green-100 text-green-800'
      case 'risky':
        return 'bg-yellow-100 text-yellow-800'
      case 'invalid':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <Card className={`relative transition-all hover:shadow-md ${
      isSelected ? 'ring-2 ring-blue-500' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {onSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(contact.id, e.target.checked)}
                className="mt-1"
              />
            )}
            
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-lg">
                  {contact.first_name} {contact.last_name}
                </h3>
                <Badge className={getStatusColor(contact.status)}>
                  {contact.status}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2 text-gray-600">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{contact.email}</span>
                <Badge className={getEmailStatusColor(contact.email_status)} variant="outline">
                  {contact.email_status}
                </Badge>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(contact)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onAddTag && (
                <DropdownMenuItem onClick={() => onAddTag(contact.id)}>
                  <Tag className="h-4 w-4 mr-2" />
                  Add Tag
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(contact.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Company and Job Title */}
          {(contact.company_name || contact.job_title) && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Building className="h-4 w-4" />
              <span>
                {contact.job_title && contact.company_name
                  ? `${contact.job_title} at ${contact.company_name}`
                  : contact.job_title || contact.company_name
                }
              </span>
            </div>
          )}

          {/* Website */}
          {contact.website && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Globe className="h-4 w-4" />
              <a 
                href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {contact.website}
              </a>
            </div>
          )}

          {/* Phone */}
          {contact.phone && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Phone className="h-4 w-4" />
              <span>{contact.phone}</span>
            </div>
          )}

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contact.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Created Date */}
          <div className="text-xs text-gray-500 pt-2 border-t">
            Added {formatDate(contact.created_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}