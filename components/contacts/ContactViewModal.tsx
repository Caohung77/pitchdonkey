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
  Clock,
  Linkedin,
  Twitter,
  Hash,
  Clock4
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseCompanyName } from '@/lib/contact-utils'

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
    const companyName = parseCompanyName(contact.company)
    if (companyName && companyName.trim()) {
      return companyName.trim()
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
              {/* AI Enriched indicators */}
              {'enrichment_status' in contact && contact.enrichment_status === 'completed' && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Website Enriched
                </Badge>
              )}
              {'linkedin_extraction_status' in contact && contact.linkedin_extraction_status === 'completed' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                  <Linkedin className="h-3 w-3" />
                  LinkedIn Extracted
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
          <TabsList className={`grid w-full mb-6 ${contact.linkedin_profile_data ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Details
            </TabsTrigger>
            {contact.linkedin_profile_data && (
              <TabsTrigger value="linkedin" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn Profile
              </TabsTrigger>
            )}
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

                {contact.linkedin_url && (
                  <div className="flex items-center gap-3">
                    <Linkedin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">LinkedIn</p>
                      <a 
                        href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {contact.linkedin_url}
                      </a>
                    </div>
                  </div>
                )}

                {contact.twitter_url && (
                  <div className="flex items-center gap-3">
                    <Twitter className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Twitter</p>
                      <a 
                        href={contact.twitter_url.startsWith('http') ? contact.twitter_url : `https://${contact.twitter_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {contact.twitter_url}
                      </a>
                    </div>
                  </div>
                )}

                {contact.timezone && (
                  <div className="flex items-center gap-3">
                    <Clock4 className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Timezone</p>
                      <p className="text-sm text-gray-600">{contact.timezone}</p>
                    </div>
                  </div>
                )}

                {contact.source && (
                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Source</p>
                      <p className="text-sm text-gray-600">{contact.source}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Professional</h3>
              
              <div className="space-y-3">
                {parseCompanyName(contact.company) && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Company</p>
                      <p className="text-sm text-gray-600">{parseCompanyName(contact.company)}</p>
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

                {contact.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Address</p>
                      <p className="text-sm text-gray-600">{contact.address}</p>
                    </div>
                  </div>
                )}

                {contact.city && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">City</p>
                      <p className="text-sm text-gray-600">{contact.city}</p>
                    </div>
                  </div>
                )}

                {contact.postcode && (
                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Postcode</p>
                      <p className="text-sm text-gray-600">{contact.postcode}</p>
                    </div>
                  </div>
                )}

                {contact.country && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Country</p>
                      <p className="text-sm text-gray-600">{contact.country}</p>
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
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-green-600" />
                <h3 className="text-lg font-medium text-green-900">AI Website Enrichment Data</h3>
                {'enrichment_updated_at' in contact && contact.enrichment_updated_at && (
                  <span className="text-xs text-green-600 ml-auto">
                    Enriched {formatDate(contact.enrichment_updated_at as string)}
                  </span>
                )}
              </div>
              
              <div className="space-y-3">
                {contact.enrichment_data.industry && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Industry</p>
                    <p className="text-sm text-green-700">{contact.enrichment_data.industry}</p>
                  </div>
                )}
                
                {contact.enrichment_data.products_services && contact.enrichment_data.products_services.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Products & Services</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.enrichment_data.products_services.map((service, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {contact.enrichment_data.target_audience && contact.enrichment_data.target_audience.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Target Audience</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.enrichment_data.target_audience.map((audience, index) => (
                        <Badge key={index} variant="outline" className="text-xs border-green-300 text-green-700">
                          {audience}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {contact.enrichment_data.unique_points && contact.enrichment_data.unique_points.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Unique Points</p>
                    <ul className="text-sm text-green-700 mt-1 space-y-1">
                      {contact.enrichment_data.unique_points.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {contact.enrichment_data.tone_style && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Communication Style</p>
                    <p className="text-sm text-green-700">{contact.enrichment_data.tone_style}</p>
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
                <div>
                  <p className="font-medium text-gray-700">Website Enriched</p>
                  <p className="text-gray-600">{formatDate(contact.enrichment_updated_at as string)}</p>
                </div>
              )}
              {'linkedin_extracted_at' in contact && contact.linkedin_extracted_at && (
                <div>
                  <p className="font-medium text-gray-700">LinkedIn Extracted</p>
                  <p className="text-gray-600">{formatDate(contact.linkedin_extracted_at as string)}</p>
                </div>
              )}
            </div>
          </div>
          </TabsContent>

          {/* LinkedIn Profile Tab */}
          {contact.linkedin_profile_data && (
            <TabsContent value="linkedin" className="space-y-4">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                      <Linkedin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-blue-900">LinkedIn Profile</h2>
                      {'linkedin_extracted_at' in contact && contact.linkedin_extracted_at && (
                        <p className="text-xs text-blue-600">
                          Extracted {formatDate(contact.linkedin_extracted_at as string)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    ✓ Data Available
                  </Badge>
                </div>
              </div>

              {typeof contact.linkedin_profile_data === 'object' && contact.linkedin_profile_data && (
                <div className="grid gap-4">
                  
                  {/* Professional Summary Card */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Building className="h-4 w-4 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Professional Summary</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Company & Position */}
                      <div className="space-y-3">
                        {(contact.linkedin_profile_data as any).current_company && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</span>
                            <span className="text-sm font-medium text-gray-900">
                              {typeof (contact.linkedin_profile_data as any).current_company === 'object' 
                                ? (contact.linkedin_profile_data as any).current_company.name 
                                : (contact.linkedin_profile_data as any).current_company}
                            </span>
                          </div>
                        )}
                        
                        {(contact.linkedin_profile_data as any).position && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Position</span>
                            <span className="text-sm text-gray-800">{(contact.linkedin_profile_data as any).position}</span>
                          </div>
                        )}
                      </div>

                      {/* Location & Industry */}
                      <div className="space-y-3">
                        {(contact.linkedin_profile_data as any).city && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</span>
                            <span className="text-sm text-gray-800">
                              {(contact.linkedin_profile_data as any).city}
                              {(contact.linkedin_profile_data as any).country && `, ${(contact.linkedin_profile_data as any).country}`}
                            </span>
                          </div>
                        )}

                        {(contact.linkedin_profile_data as any).industry && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Industry</span>
                            <span className="text-sm text-gray-800">{(contact.linkedin_profile_data as any).industry}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* About Section - CRITICAL for personalization */}
                  {(contact.linkedin_profile_data as any).about && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">About</h3>
                        <Badge variant="outline" className="text-xs">Personalization Key</Badge>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-blue-400">
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                          {(contact.linkedin_profile_data as any).about}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Network Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(contact.linkedin_profile_data as any).followers && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {(contact.linkedin_profile_data as any).followers?.toLocaleString()}
                        </div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Followers</div>
                      </div>
                    )}
                    
                    {(contact.linkedin_profile_data as any).connections && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {(contact.linkedin_profile_data as any).connections}+
                        </div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Connections</div>
                      </div>
                    )}

                    {(contact.linkedin_profile_data as any).recommendations_count && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {(contact.linkedin_profile_data as any).recommendations_count}
                        </div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recommendations</div>
                      </div>
                    )}
                  </div>

                  {/* Languages */}
                  {(contact.linkedin_profile_data as any).languages && Array.isArray((contact.linkedin_profile_data as any).languages) && (contact.linkedin_profile_data as any).languages.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Languages</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(contact.linkedin_profile_data as any).languages.map((lang: any, index: number) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                            <p className="font-medium text-gray-900 text-sm">{lang.title}</p>
                            {lang.subtitle && lang.subtitle !== '-' && (
                              <p className="text-xs text-gray-600 mt-1">{lang.subtitle}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Services (Serviceleistungen) - CRITICAL for German profiles */}
                  {(contact.linkedin_profile_data as any).services && Array.isArray((contact.linkedin_profile_data as any).services) && (contact.linkedin_profile_data as any).services.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Building className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Services</h3>
                        <Badge variant="outline" className="text-xs">Serviceleistungen</Badge>
                      </div>
                      <div className="space-y-3">
                        {(contact.linkedin_profile_data as any).services.map((service: any, index: number) => (
                          <div key={index} className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg border-l-4 border-blue-500">
                            <p className="font-medium text-gray-900">{service.name || service}</p>
                            {service.description && (
                              <p className="text-sm text-gray-700 mt-1">{service.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {(contact.linkedin_profile_data as any).education && Array.isArray((contact.linkedin_profile_data as any).education) && (contact.linkedin_profile_data as any).education.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">🎓</div>
                        <h3 className="font-semibold text-gray-900">Education</h3>
                      </div>
                      <div className="space-y-3">
                        {(contact.linkedin_profile_data as any).education.map((edu: any, index: number) => (
                          <div key={index} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{edu.title || edu.school}</p>
                                {edu.degree && <p className="text-sm text-gray-700">{edu.degree}</p>}
                                {edu.field && <p className="text-sm text-gray-600">{edu.field}</p>}
                              </div>
                              {(edu.start_year || edu.end_year) && (
                                <div className="text-xs text-gray-500 text-right bg-white px-2 py-1 rounded">
                                  {edu.start_year} - {edu.end_year}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience */}
                  {(contact.linkedin_profile_data as any).experience && Array.isArray((contact.linkedin_profile_data as any).experience) && (contact.linkedin_profile_data as any).experience.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">💼</div>
                        <h3 className="font-semibold text-gray-900">Professional Experience</h3>
                      </div>
                      <div className="space-y-4">
                        {(contact.linkedin_profile_data as any).experience.slice(0, 3).map((exp: any, index: number) => (
                          <div key={index} className="border border-gray-100 rounded-lg p-3 bg-gray-50 relative">
                            {/* Timeline indicator */}
                            {index < (contact.linkedin_profile_data as any).experience.length - 1 && (
                              <div className="absolute left-4 top-16 w-px h-8 bg-gray-300"></div>
                            )}
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{exp.title}</p>
                                    <p className="text-sm text-gray-700">{exp.company}</p>
                                    {exp.location && <p className="text-xs text-gray-600">{exp.location}</p>}
                                  </div>
                                  <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded text-right">
                                    {exp.start_date && (
                                      <div>{exp.start_date} - {exp.end_date || 'Present'}</div>
                                    )}
                                    {exp.duration && <div className="text-gray-400">{exp.duration}</div>}
                                  </div>
                                </div>
                                
                                {/* Nested positions */}
                                {exp.positions && Array.isArray(exp.positions) && exp.positions.length > 0 && (
                                  <div className="mt-2 ml-4 space-y-1">
                                    {exp.positions.map((pos: any, posIndex: number) => (
                                      <div key={posIndex} className="bg-white p-2 rounded border-l-2 border-blue-200 text-xs">
                                        <p className="font-medium text-gray-800">{pos.title}</p>
                                        <p className="text-gray-600">{pos.start_date} - {pos.end_date}</p>
                                        {pos.location && <p className="text-gray-500">{pos.location}</p>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {(contact.linkedin_profile_data as any).experience.length > 3 && (
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs">
                              +{(contact.linkedin_profile_data as any).experience.length - 3} more positions
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Data Sections (Only if Available) */}
                  
                  {/* Recommendations */}
                  {(contact.linkedin_profile_data as any).recommendations && Array.isArray((contact.linkedin_profile_data as any).recommendations) && (contact.linkedin_profile_data as any).recommendations.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">⭐</div>
                        <h3 className="font-semibold text-gray-900">Recommendations</h3>
                      </div>
                      <div className="space-y-3">
                        {(contact.linkedin_profile_data as any).recommendations.slice(0, 2).map((rec: string, index: number) => (
                          <div key={index} className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border-l-4 border-orange-400">
                            <p className="text-sm text-gray-800 italic leading-relaxed">"{rec}"</p>
                          </div>
                        ))}
                        {(contact.linkedin_profile_data as any).recommendations.length > 2 && (
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs">
                              +{(contact.linkedin_profile_data as any).recommendations.length - 2} more recommendations
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Posts - CRITICAL for personalization */}
                  {(contact.linkedin_profile_data as any).posts && Array.isArray((contact.linkedin_profile_data as any).posts) && (contact.linkedin_profile_data as any).posts.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">📱</div>
                        <h3 className="font-semibold text-gray-900">Recent Posts</h3>
                        <Badge variant="outline" className="text-xs">Personalization</Badge>
                      </div>
                      <div className="space-y-3">
                        {(contact.linkedin_profile_data as any).posts.slice(0, 2).map((post: any, index: number) => (
                          <div key={index} className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border-l-4 border-green-400">
                            <p className="text-sm text-gray-800 leading-relaxed">{post.text}</p>
                            <div className="flex justify-between items-center mt-2">
                              {post.date && <p className="text-xs text-gray-500">{post.date}</p>}
                              {post.engagement && (
                                <div className="flex gap-2 text-xs text-gray-600">
                                  {post.engagement.likes && <span>👍 {post.engagement.likes}</span>}
                                  {post.engagement.comments && <span>💬 {post.engagement.comments}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </TabsContent>
          )}

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