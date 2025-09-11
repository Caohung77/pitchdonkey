'use client'

import { Contact } from '@/lib/contacts'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseCompanyName } from '@/lib/contact-utils'
import { EnrichmentBadges } from './EnrichmentBadges'
import { 
  Mail, 
  Building,
  Edit,
  Trash2,
  Tag,
  Sparkles,
  List,
  MoreVertical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (contactId: string) => void
  onAddTag: (contactId: string) => void
  onClick?: (contact: Contact) => void
  isSelected?: boolean
  onSelect?: (contactId: string, selected: boolean) => void
}

export function ContactCard({ 
  contact, 
  onEdit, 
  onDelete, 
  onAddTag,
  onClick,
  isSelected = false,
  onSelect
}: ContactCardProps) {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'unsubscribed':
        return 'bg-yellow-100 text-yellow-800'
      case 'bounced':
        return 'bg-red-100 text-red-800'
      case 'complained':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatName = (contact: Contact) => {
    // Priority 1: First Name + Last Name
    const firstName = contact.first_name || ''
    const lastName = contact.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    
    if (fullName) {
      return fullName
    }
    
    // Priority 2: Company Name
    const companyName = parseCompanyName(contact.company)
    if (companyName && companyName.trim()) {
      return companyName.trim()
    }
    
    // Priority 3: Email (fallback)
    return contact.email
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (onSelect) {
      onSelect(contact.id, e.target.checked)
    }
  }

  // Get lists count for this contact
  const listsCount = contact.lists?.length || 0

  return (
    <Card 
      className={`hover:shadow-md transition-all duration-200 border-0 shadow-sm hover:shadow-lg transform hover:scale-[1.02] ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/30 shadow-blue-100' : 'bg-white hover:bg-gray-50/50'} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick ? () => onClick(contact) : undefined}
    >
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Checkbox */}
            {onSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleSelectChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
            
            {/* Contact Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-900 truncate flex-1">
                  {formatName(contact)}
                </h3>
              </div>
              
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <Mail className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
              
              {/* Company/Position */}
              {(() => {
                const companyName = parseCompanyName(contact.company)
                const isCompanyAsTitle = !contact.first_name && !contact.last_name && companyName
                
                let displayText = ''
                if (isCompanyAsTitle && contact.position) {
                  displayText = contact.position
                } else if (contact.position && companyName) {
                  displayText = `${contact.position} at ${companyName}`
                } else if (contact.position) {
                  displayText = contact.position
                } else if (companyName && !isCompanyAsTitle) {
                  displayText = companyName
                }

                return displayText ? (
                  <div className="flex items-center text-sm text-gray-600">
                    <Building className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{displayText}</span>
                  </div>
                ) : null
              })()}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(contact)
              }}
              className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-700 transition-colors"
              title="Edit contact"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAddTag(contact.id)
              }}
              className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-700 transition-colors"
              title="Add tag"
            >
              <Tag className="h-3.5 w-3.5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 w-7 p-0 hover:bg-gray-100 transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onEdit(contact)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddTag(contact.id)}>
                  <Tag className="h-4 w-4 mr-2" />
                  Add Tag
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(contact.id)}
                  className="text-red-600 focus:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta Information Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {/* Status */}
            <Badge 
              variant="secondary" 
              className={`text-xs font-medium px-2 py-1 ${getStatusColor(contact.status)}`}
            >
              {contact.status}
            </Badge>
            
            {/* Enrichment Badges */}
            <EnrichmentBadges contact={contact} size="sm" />
          </div>
          
          {/* Counts */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                <span>{contact.tags.length}</span>
              </div>
            )}
            {listsCount > 0 && (
              <div className="flex items-center gap-1">
                <List className="h-3 w-3" />
                <span>{listsCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {contact.tags.slice(0, 4).map((tag, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs px-2 py-0.5 bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors"
              >
                {tag}
              </Badge>
            ))}
            {contact.tags.length > 4 && (
              <Badge 
                variant="outline" 
                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 border-gray-300"
              >
                +{contact.tags.length - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}