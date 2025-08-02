'use client'

import { Contact } from '@/lib/contacts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Mail, 
  Building,
  Edit,
  Trash2,
  Tag
} from 'lucide-react'

interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (contactId: string) => void
  onAddTag: (contactId: string) => void
  isSelected?: boolean
  onSelect?: (contactId: string, selected: boolean) => void
}

export function ContactCard({ 
  contact, 
  onEdit, 
  onDelete, 
  onAddTag,
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
    const firstName = contact.first_name || ''
    const lastName = contact.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    return fullName || contact.email.split('@')[0]
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelect) {
      onSelect(contact.id, e.target.checked)
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {onSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleSelectChange}
                className="mt-1"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {formatName(contact)}
              </h3>
              <div className="flex items-center mt-1">
                <Mail className="h-3 w-3 text-gray-400 mr-1" />
                <p className="text-xs text-gray-600 truncate">{contact.email}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(contact)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(contact.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Company and Position */}
          {(contact.company || contact.position) && (
            <div className="flex items-center text-xs text-gray-600">
              <Building className="h-3 w-3 mr-1" />
              <span className="truncate">
                {contact.position && contact.company 
                  ? `${contact.position} at ${contact.company}`
                  : contact.position || contact.company
                }
              </span>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge 
              variant="secondary" 
              className={`text-xs ${getStatusColor(contact.status)}`}
            >
              {contact.status}
            </Badge>
            
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex items-center space-x-1">
                <Tag className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {contact.tags.length} tag{contact.tags.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {contact.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {contact.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{contact.tags.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {/* Add Tag Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddTag(contact.id)}
            className="w-full h-8 text-xs text-gray-600 hover:text-gray-900"
          >
            <Tag className="h-3 w-3 mr-1" />
            Add Tag
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}