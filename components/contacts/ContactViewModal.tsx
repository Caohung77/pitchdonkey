'use client'

import { Contact } from '@/lib/contacts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  Building, 
  MapPin, 
  Phone, 
  Globe, 
  User,
  Edit,
  Sparkles,
  Calendar,
  Tag,
  Send,
  List,
  Clock
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ContactViewModalProps {
  contact: Contact | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (contact: Contact) => void
}

export function ContactViewModal({ 
  contact, 
  isOpen, 
  onClose,
  onEdit
}: ContactViewModalProps) {
  if (!contact) return null

  const formatName = (contact: Contact) => {
    // Priority 1: First Name + Last Name
    const firstName = contact.first_name || ''
    const lastName = contact.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    
    if (fullName) {
      return fullName
    }
    
    // Priority 2: Company Name
    if (contact.company && contact.company.trim()) {
      return contact.company.trim()
    }
    
    // Priority 3: Email (fallback)
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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" hideCloseButton={true}>
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-gray-600" />
              {formatName(contact)}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* AI Enriched indicator */}
              {'enrichment_status' in contact && contact.enrichment_status === 'completed' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Enriched
                </Badge>
              )}
              {/* Status badge */}
              <Badge className={getStatusColor(contact.status)}>
                {contact.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Details
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Campaigns & Lists
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email</p>
                    <p className="text-sm text-gray-600">{contact.email}</p>
                  </div>
                </div>

                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <p className="text-sm text-gray-600">{contact.phone}</p>
                    </div>
                  </div>
                )}
                {'sex' in contact && contact.sex && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Gender</p>
                      <p className="text-sm text-gray-600">
                        {contact.sex === 'm' ? 'Male' : contact.sex === 'f' ? 'Female' : 'Not specified'}
                      </p>
                    </div>
                  </div>
                )}

                {contact.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Website</p>
                      <a 
                        href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {contact.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Professional</h3>
              
              <div className="space-y-3">
                {contact.company && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Company</p>
                      <p className="text-sm text-gray-600">{contact.company}</p>
                    </div>
                  </div>
                )}

                {contact.position && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Position</p>
                      <p className="text-sm text-gray-600">{contact.position}</p>
                    </div>
                  </div>
                )}

                {(('address' in contact && contact.address) || ('city' in contact && contact.city) || ('state' in contact && contact.state) || ('zip_code' in contact && contact.zip_code)) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Address</p>
                      <div className="text-sm text-gray-600">
                        {'address' in contact && contact.address && <p>{contact.address as string}</p>}
                        {(('city' in contact && contact.city) || ('state' in contact && contact.state) || ('zip_code' in contact && contact.zip_code)) && (
                          <p>
                            {[
                              'city' in contact ? contact.city : undefined,
                              'state' in contact ? contact.state : undefined, 
                              'zip_code' in contact ? contact.zip_code : undefined
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Tags</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI Enrichment Data */}
          {contact.enrichment_data && contact.enrichment_status === 'completed' && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <h3 className="text-lg font-medium text-blue-900">AI Enrichment Data</h3>
              </div>
              
              <div className="space-y-3">
                {contact.enrichment_data.industry && (
                  <div>
                    <p className="text-sm font-medium text-blue-800">Industry</p>
                    <p className="text-sm text-blue-700">{contact.enrichment_data.industry}</p>
                  </div>
                )}
                
                {contact.enrichment_data.products_services && contact.enrichment_data.products_services.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-800">Products & Services</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.enrichment_data.products_services.map((service, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {contact.enrichment_data.target_audience && contact.enrichment_data.target_audience.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-800">Target Audience</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.enrichment_data.target_audience.map((audience, index) => (
                        <Badge key={index} variant="outline" className="text-xs border-blue-300 text-blue-700">
                          {audience}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {contact.enrichment_data.unique_points && contact.enrichment_data.unique_points.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-800">Unique Points</p>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      {contact.enrichment_data.unique_points.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {contact.enrichment_data.tone_style && (
                  <div>
                    <p className="text-sm font-medium text-blue-800">Communication Style</p>
                    <p className="text-sm text-blue-700">{contact.enrichment_data.tone_style}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900">Timeline</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">Created</p>
                <p className="text-gray-600">{formatDate(contact.created_at)}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Last Updated</p>
                <p className="text-gray-600">{formatDate(contact.updated_at)}</p>
              </div>
              {'enrichment_updated_at' in contact && contact.enrichment_updated_at && (
                <div className="md:col-span-2">
                  <p className="font-medium text-gray-700">AI Enriched</p>
                  <p className="text-gray-600">{formatDate(contact.enrichment_updated_at as string)}</p>
                </div>
              )}
            </div>
          </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            {/* Lists Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <List className="h-4 w-4 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Contact Lists</h3>
              </div>
              
              {contact.lists && contact.lists.length > 0 ? (
                <div className="space-y-2">
                  {contact.lists.map((listName: string, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <List className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">{listName}</span>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        Active
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <List className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">Not in any lists</p>
                  <p className="text-sm text-gray-500">This contact hasn't been added to any contact lists yet</p>
                </div>
              )}
            </div>

            {/* Campaign History Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Send className="h-4 w-4 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Campaign History</h3>
              </div>
              
              {/* TODO: This will be populated with actual campaign data */}
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Send className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">No campaign history</p>
                <p className="text-sm text-gray-500">This contact hasn't been included in any campaigns yet</p>
              </div>

              {/* Example of what campaign history would look like when implemented */}
              {false && (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-blue-900">Welcome Series Campaign</h4>
                        <p className="text-sm text-blue-700">3-step email sequence</p>
                      </div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                        Completed
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">Email 1: Welcome & Introduction</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Sent 2 days ago</span>
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                            Opened
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">Email 2: Product Features</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Sent 1 day ago</span>
                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                            Delivered
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-xs text-gray-500">
            Contact ID: {contact.id}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button
                onClick={() => {
                  onEdit(contact)
                  onClose()
                }}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Contact
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}