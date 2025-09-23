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
  Clock4,
  Award,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseCompanyName } from '@/lib/contact-utils'
import { EnrichmentButton } from './EnrichmentButton'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { EngagementBadge } from './EngagementBadge'
import { EngagementBreakdown } from './EngagementBreakdown'
import { EngagementTimeline, type EngagementEvent } from './EngagementTimeline'
import type { ContactEngagementStatus } from '@/lib/contact-engagement'
import { useEffect, useState } from 'react'

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

  // Always display freshest data from Supabase
  const [latestContact, setLatestContact] = useState<Contact | null>(contact)
  
  // Notes state management
  const [notes, setNotes] = useState<string>('')
  const [notesLoading, setNotesLoading] = useState(false)
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignHistory, setCampaignHistory] = useState<any[]>([])
  const [campaignPage, setCampaignPage] = useState(1)
  const [campaignPagination, setCampaignPagination] = useState<{
    page: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
  } | null>(null)
  const [engagementEvents, setEngagementEvents] = useState<EngagementEvent[]>([])
  const [engagementLoading, setEngagementLoading] = useState(false)

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        if (!isOpen || !contact?.id) return
        // Fetch general contact record (includes JSON fields)
        const resp = await fetch(`/api/contacts?ids=${contact.id}`)
        let freshest: any = null
        if (resp.ok) {
          const json = await resp.json()
          freshest = json?.data?.contacts?.[0] || null
        }

        // Fetch LinkedIn-specific data to ensure JSON is present even if list endpoint omits it
        const liResp = await fetch(`/api/contacts/${contact.id}/extract-linkedin`, { method: 'GET' })
        if (liResp.ok) {
          const liJson = await liResp.json()
          const liData = liJson?.data
          if (liData && (liData.linkedin_profile_data || liData.linkedin_extraction_status || liData.linkedin_extracted_at)) {
            freshest = {
              ...(freshest || contact),
              linkedin_profile_data: liData.linkedin_profile_data ?? (freshest?.linkedin_profile_data || (contact as any).linkedin_profile_data),
              linkedin_extraction_status: liData.linkedin_extraction_status ?? (freshest?.linkedin_extraction_status || (contact as any).linkedin_extraction_status),
              linkedin_extracted_at: liData.linkedin_extracted_at ?? (freshest?.linkedin_extracted_at || (contact as any).linkedin_extracted_at)
            }
          }
        }

        if (freshest) setLatestContact(freshest as Contact)
      } catch (e) {
        // ignore
      }
    }
    fetchLatest()
  }, [isOpen, contact?.id])

  // Load campaign history for the contact when opening or page changes
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!isOpen || !contact?.id) return
      try {
        setCampaignsLoading(true)
        const resp = await fetch(`/api/contacts/${contact.id}/campaigns?page=${campaignPage}&limit=5`)
        if (resp.ok) {
          const json = await resp.json()
          setCampaignHistory(json.campaigns || [])
          setCampaignPagination(json.pagination || null)
        } else {
          setCampaignHistory([])
          setCampaignPagination(null)
        }
      } finally {
        setCampaignsLoading(false)
      }
    }
    loadCampaigns()
  }, [isOpen, contact?.id, campaignPage])

  // Reset pagination when modal opens
  useEffect(() => {
    if (isOpen) {
      setCampaignPage(1)
    }
  }, [isOpen])

  const hydratedContact: Contact = latestContact || contact
  
  // NEW: Check for individual LinkedIn fields first, fallback to legacy JSON blob
  const hasLinkedInData = !!(
    hydratedContact.linkedin_first_name ||
    hydratedContact.linkedin_headline ||
    hydratedContact.linkedin_about ||
    hydratedContact.linkedin_current_company ||
    (hydratedContact as any).linkedin_profile_data
  )
  
  // Backwards compatibility: use JSON blob if individual fields aren't populated yet
  const lp: any = hasLinkedInData ? {
    // Personal Information
    first_name: hydratedContact.linkedin_first_name,
    last_name: hydratedContact.linkedin_last_name,
    name: hydratedContact.linkedin_first_name && hydratedContact.linkedin_last_name ? 
          `${hydratedContact.linkedin_first_name} ${hydratedContact.linkedin_last_name}` : 
          hydratedContact.linkedin_first_name || hydratedContact.linkedin_last_name,
    headline: hydratedContact.linkedin_headline,
    summary: hydratedContact.linkedin_summary,
    about: hydratedContact.linkedin_about,
    
    // Professional Information
    current_company: hydratedContact.linkedin_current_company,
    position: hydratedContact.linkedin_current_position,
    industry: hydratedContact.linkedin_industry,
    
    // Location
    location: hydratedContact.linkedin_location,
    city: hydratedContact.linkedin_city,
    country: hydratedContact.linkedin_country,
    country_code: hydratedContact.linkedin_country_code,
    
    // Social Stats
    follower_count: hydratedContact.linkedin_follower_count,
    connection_count: hydratedContact.linkedin_connection_count,
    recommendations_count: hydratedContact.linkedin_recommendations_count,
    profile_completeness: hydratedContact.linkedin_profile_completeness,
    
    // Media
    avatar: hydratedContact.linkedin_avatar_url,
    banner_image: hydratedContact.linkedin_banner_url,
    
    // Complex Data (from JSONB fields)
    experience: hydratedContact.linkedin_experience,
    education: hydratedContact.linkedin_education,
    skills: hydratedContact.linkedin_skills,
    languages: hydratedContact.linkedin_languages,
    certifications: hydratedContact.linkedin_certifications,
    volunteer_experience: hydratedContact.linkedin_volunteer_experience,
    honors_and_awards: hydratedContact.linkedin_honors_awards,
    projects: hydratedContact.linkedin_projects,
    courses: hydratedContact.linkedin_courses,
    publications: hydratedContact.linkedin_publications,
    patents: hydratedContact.linkedin_patents,
    organizations: hydratedContact.linkedin_organizations,
    posts: hydratedContact.linkedin_posts,
    activity: hydratedContact.linkedin_activity,
    recommendations: hydratedContact.linkedin_recommendations,
    people_also_viewed: hydratedContact.linkedin_people_also_viewed,
    contact_info: hydratedContact.linkedin_contact_info,
    services: hydratedContact.linkedin_services
  } : (hydratedContact as any).linkedin_profile_data

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

  // Notes management functions
  const fetchNotes = async () => {
    if (!hydratedContact.id) return
    
    setNotesLoading(true)
    try {
      const response = await fetch(`/api/contacts/${hydratedContact.id}/notes`)
      const result = await response.json()
      
      if (result.success) {
        setNotes(result.data.notes || '')
      } else {
        console.error('Failed to fetch notes:', result.error)
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setNotesLoading(false)
    }
  }

  const saveNotes = async (content: string) => {
    if (!hydratedContact.id) return
    
    try {
      const response = await fetch(`/api/contacts/${hydratedContact.id}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: content })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save notes')
      }
    } catch (error) {
      console.error('Error saving notes:', error)
      throw error
    }
  }

  // Fetch notes when modal opens
  useEffect(() => {
    if (isOpen && hydratedContact.id) {
      fetchNotes()
    }
  }, [isOpen, hydratedContact.id])

  useEffect(() => {
    const fetchEngagementEvents = async () => {
      if (!isOpen || !contact?.id) {
        setEngagementEvents([])
        return
      }

      setEngagementLoading(true)
      try {
        const response = await fetch(`/api/contacts/${contact.id}/engagement`)
        if (!response.ok) {
          throw new Error(`Failed to load engagement events (${response.status})`)
        }

        const json = await response.json()
        if (json.success && Array.isArray(json.events)) {
          setEngagementEvents(json.events)
        } else {
          setEngagementEvents([])
        }
      } catch (error) {
        console.error('Error loading engagement events:', error)
        setEngagementEvents([])
      } finally {
        setEngagementLoading(false)
      }
    }

    fetchEngagementEvents()
  }, [isOpen, contact?.id])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" hideCloseButton={true}>
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-gray-600" />
              {formatName(hydratedContact)}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* AI Enriched indicators */}
              {'enrichment_status' in hydratedContact && hydratedContact.enrichment_status === 'completed' && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Website Enriched
                </Badge>
              )}
              {'linkedin_extraction_status' in hydratedContact && hydratedContact.linkedin_extraction_status === 'completed' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                  <Linkedin className="h-3 w-3" />
                  LinkedIn Extracted
                </Badge>
              )}
              {/* Status badge */}
              <Badge className={getStatusColor(hydratedContact.status)}>
                {hydratedContact.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className={`grid w-full mb-6 ${(hasLinkedInData && lp) || hydratedContact.linkedin_extraction_status === 'failed' ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Details
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Engagement
            </TabsTrigger>
            {((hasLinkedInData && lp) || hydratedContact.linkedin_extraction_status === 'failed') && (
              <TabsTrigger value="linkedin" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn Profile
              </TabsTrigger>
            )}
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
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
                    <p className="text-sm text-gray-600">{hydratedContact.email}</p>
                  </div>
                </div>

                {hydratedContact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <p className="text-sm text-gray-600">{hydratedContact.phone}</p>
                    </div>
                  </div>
                )}
                {'sex' in hydratedContact && hydratedContact.sex && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Gender</p>
                      <p className="text-sm text-gray-600">
                        {hydratedContact.sex === 'm' ? 'Male' : hydratedContact.sex === 'f' ? 'Female' : 'Not specified'}
                      </p>
                    </div>
                  </div>
                )}

                {hydratedContact.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Website</p>
                      <a 
                        href={hydratedContact.website.startsWith('http') ? hydratedContact.website : `https://${hydratedContact.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {hydratedContact.website}
                      </a>
                    </div>
                  </div>
                )}

                {hydratedContact.linkedin_url && (
                  <div className="flex items-center gap-3">
                    <Linkedin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">LinkedIn</p>
                      <a 
                        href={hydratedContact.linkedin_url.startsWith('http') ? hydratedContact.linkedin_url : `https://${hydratedContact.linkedin_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {hydratedContact.linkedin_url}
                      </a>
                    </div>
                  </div>
                )}

                {hydratedContact.twitter_url && (
                  <div className="flex items-center gap-3">
                    <Twitter className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Twitter</p>
                      <a 
                        href={hydratedContact.twitter_url.startsWith('http') ? hydratedContact.twitter_url : `https://${hydratedContact.twitter_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {hydratedContact.twitter_url}
                      </a>
                    </div>
                  </div>
                )}

                {hydratedContact.timezone && (
                  <div className="flex items-center gap-3">
                    <Clock4 className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Timezone</p>
                      <p className="text-sm text-gray-600">{hydratedContact.timezone}</p>
                    </div>
                  </div>
                )}

                {hydratedContact.source && (
                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Source</p>
                      <p className="text-sm text-gray-600">{hydratedContact.source}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Professional</h3>
              
              <div className="space-y-3">
                {parseCompanyName(hydratedContact.company) && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Company</p>
                      <p className="text-sm text-gray-600">{parseCompanyName(hydratedContact.company)}</p>
                    </div>
                  </div>
                )}

                {hydratedContact.position && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Position</p>
                      <p className="text-sm text-gray-600">{hydratedContact.position}</p>
                    </div>
                  </div>
                )}

                {hydratedContact.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Address</p>
                      <p className="text-sm text-gray-600">{hydratedContact.address}</p>
                    </div>
                  </div>
                )}

                {hydratedContact.city && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">City</p>
                      <p className="text-sm text-gray-600">{hydratedContact.city}</p>
                    </div>
                  </div>
                )}

                {hydratedContact.postcode && (
                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Postcode</p>
                      <p className="text-sm text-gray-600">{hydratedContact.postcode}</p>
                    </div>
                  </div>
                )}

                {hydratedContact.country && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Country</p>
                      <p className="text-sm text-gray-600">{hydratedContact.country}</p>
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

          {/* Enrichment Actions */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">AI Enrichment</h3>
            </div>
            <EnrichmentButton
              contactId={hydratedContact.id}
              hasWebsite={!!hydratedContact.website}
              hasLinkedIn={!!hydratedContact.linkedin_url}
              linkedInUrl={hydratedContact.linkedin_url}
              currentStatus={hydratedContact.enrichment_status}
              linkedInStatus={hydratedContact.linkedin_extraction_status || ('linkedin_extraction_status' in hydratedContact ? hydratedContact.linkedin_extraction_status as any : null)}
              onEnrichmentComplete={() => {
                // Pull fresh data after enrichment completes
                ;(async () => {
                  try {
                    const resp = await fetch(`/api/contacts?ids=${hydratedContact.id}`)
                    if (resp.ok) {
                      const json = await resp.json()
                      const updated = json?.data?.contacts?.[0]
                      if (updated) setLatestContact(updated)
                    }
                  } catch {}
                })()
              }}
              size="sm"
              className="w-full"
            />
          </div>

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
              {'enrichment_updated_at' in hydratedContact && hydratedContact.enrichment_updated_at && (
                <div>
                  <p className="font-medium text-gray-700">Website Enriched</p>
                  <p className="text-gray-600">{formatDate(hydratedContact.enrichment_updated_at as string)}</p>
                </div>
              )}
              {'linkedin_extracted_at' in hydratedContact && hydratedContact.linkedin_extracted_at && (
                <div>
                  <p className="font-medium text-gray-700">LinkedIn Extracted</p>
                  <p className="text-gray-600">{formatDate(hydratedContact.linkedin_extracted_at as string)}</p>
                </div>
              )}
            </div>
          </div>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement Breakdown */}
              <div className="lg:col-span-1">
                <EngagementBreakdown
                  status={(hydratedContact.engagement_status || 'not_contacted') as ContactEngagementStatus}
                  score={hydratedContact.engagement_score || 0}
                  openCount={hydratedContact.engagement_open_count || 0}
                  clickCount={hydratedContact.engagement_click_count || 0}
                  replyCount={hydratedContact.engagement_reply_count || 0}
                  bounceCount={hydratedContact.engagement_bounce_count || 0}
                  sentCount={hydratedContact.engagement_sent_count || 0}
                  lastPositiveAt={hydratedContact.engagement_last_positive_at}
                />
              </div>

              {/* Engagement Timeline */}
              <div className="lg:col-span-1">
                <EngagementTimeline
                  events={engagementEvents}
                  maxEvents={15}
                  className={engagementLoading ? 'opacity-75 animate-pulse' : ''}
                />
              </div>
            </div>

            {/* Quick Actions based on engagement status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Recommended Actions</h3>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const status = hydratedContact.engagement_status || 'not_contacted'
                  const score = hydratedContact.engagement_score || 0

                  switch (status) {
                    case 'not_contacted':
                      return (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                          🚀 Ready for first outreach
                        </Badge>
                      )
                    case 'pending':
                      return (
                        <>
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                            📧 Send follow-up email
                          </Badge>
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                            📞 Try different approach
                          </Badge>
                        </>
                      )
                    case 'engaged':
                      return (
                        <>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                            🎯 Prioritize for sales
                          </Badge>
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                            📅 Schedule call
                          </Badge>
                        </>
                      )
                    case 'bad':
                      return (
                        <Badge className="bg-red-100 text-red-800">
                          🚫 Automatically excluded from campaigns
                        </Badge>
                      )
                    default:
                      return null
                  }
                })()}
              </div>
            </div>
          </TabsContent>

          {/* LinkedIn Profile Tab */}
          {((hasLinkedInData && lp) || hydratedContact.linkedin_extraction_status === 'failed') && (
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
                      {'linkedin_extracted_at' in hydratedContact && hydratedContact.linkedin_extracted_at && (
                        <p className="text-xs text-blue-600">
                          Extracted {formatDate(hydratedContact.linkedin_extracted_at as string)}
                        </p>
                      )}
                    </div>
                  </div>
                  {hasLinkedInData && lp ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      ✓ Data Available
                    </Badge>
                  ) : hydratedContact.linkedin_extraction_status === 'failed' ? (
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      ⚠ Extraction Failed
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                      No Data
                    </Badge>
                  )}
                </div>
              </div>

              {/* Show failure message if extraction failed */}
              {hydratedContact.linkedin_extraction_status === 'failed' && (!hasLinkedInData || !lp) && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <Linkedin className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-red-900">LinkedIn Extraction Failed</h3>
                      <p className="text-sm text-red-700">Unable to extract data from this LinkedIn profile</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="bg-red-100 p-3 rounded-lg border-l-4 border-red-400">
                      <p className="font-medium text-red-800 mb-1">Possible Reasons:</p>
                      <ul className="text-red-700 space-y-1">
                        <li>• Profile privacy settings prevent data extraction</li>
                        <li>• Profile may be restricted or incomplete</li>
                        <li>• LinkedIn URL may be invalid or redirected</li>
                        <li>• Temporary API limitations or rate limiting</li>
                      </ul>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                      <p className="font-medium text-blue-800 mb-1">What you can try:</p>
                      <ul className="text-blue-700 space-y-1">
                        <li>• Verify the LinkedIn URL is correct and accessible</li>
                        <li>• Try again later (rate limits may have been reached)</li>
                        <li>• Use website enrichment instead for company information</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {typeof lp === 'object' && lp && (
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
                        {lp.current_company && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</span>
                            <span className="text-sm font-medium text-gray-900">
                              {typeof lp.current_company === 'object' 
                                ? lp.current_company.name 
                                : lp.current_company}
                            </span>
                          </div>
                        )}
                        
                        {lp.position && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Position</span>
                            <span className="text-sm text-gray-800">{lp.position}</span>
                          </div>
                        )}
                      </div>

                      {/* Location & Industry */}
                      <div className="space-y-3">
                        {lp.city && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</span>
                            <span className="text-sm text-gray-800">
                              {lp.city}
                              {lp.country && `, ${lp.country}`}
                            </span>
                          </div>
                        )}

                        {lp.industry && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Industry</span>
                            <span className="text-sm text-gray-800">{lp.industry}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* About Section - CRITICAL for personalization */}
                  {lp.about && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">About</h3>
                        <Badge variant="outline" className="text-xs">Personalization Key</Badge>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-blue-400">
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                          {lp.about}
                        </p>
                        {lp.about && (lp.about.endsWith('…') || lp.about.endsWith('...')) && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                              ⚠️ <span>Content may be truncated due to LinkedIn privacy settings</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Network Stats - Use BrightData field names */}
                  {(lp.followers || lp.connections || lp.follower_count || lp.connection_count || lp.profile_completeness) && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {(lp.followers || lp.follower_count) && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {(lp.followers || lp.follower_count)?.toLocaleString()}
                          </div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Followers</div>
                        </div>
                      )}
                      
                      {(lp.connections || lp.connection_count) && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {(lp.connections || lp.connection_count)}+
                          </div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Connections</div>
                        </div>
                      )}

                      {lp.recommendations_count && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {lp.recommendations_count}
                          </div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recommendations</div>
                        </div>
                      )}
                      
                      {lp.profile_completeness && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {lp.profile_completeness}%
                          </div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profile Complete</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Languages */}
                  {lp.languages && Array.isArray(lp.languages) && lp.languages.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Languages</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {lp.languages.map((lang: any, index: number) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                            <p className="font-medium text-gray-900 text-sm">{lang.title || lang.name || lang}</p>
                            {(lang.subtitle || lang.proficiency) && (lang.subtitle || lang.proficiency) !== '-' && (
                              <p className="text-xs text-gray-600 mt-1">{lang.subtitle || lang.proficiency}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Honors & Awards */}
                  {lp.honors_and_awards && Array.isArray(lp.honors_and_awards) && lp.honors_and_awards.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Honors & Awards</h3>
                        <Badge variant="outline" className="text-xs">Recognition</Badge>
                      </div>
                      <div className="space-y-3">
                        {lp.honors_and_awards.map((award: any, index: number) => (
                          <div key={index} className="bg-gradient-to-r from-amber-50 to-yellow-100 p-3 rounded-lg border-l-4 border-amber-500">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{award.title}</p>
                                {award.publication && (
                                  <p className="text-sm text-gray-700 mt-1">
                                    <span className="text-amber-600 font-medium">Issued by:</span> {award.publication}
                                  </p>
                                )}
                                {award.description && (
                                  <p className="text-sm text-gray-600 mt-1">{award.description}</p>
                                )}
                              </div>
                              {award.date && (
                                <div className="text-right ml-3">
                                  <span className="text-xs text-gray-500 bg-amber-100 px-2 py-1 rounded">
                                    {new Date(award.date).getFullYear()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Services (Serviceleistungen) - CRITICAL for German profiles */}
                  {lp.services && Array.isArray(lp.services) && lp.services.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Building className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Services</h3>
                        <Badge variant="outline" className="text-xs">Serviceleistungen</Badge>
                      </div>
                      <div className="space-y-3">
                        {lp.services.map((service: any, index: number) => (
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
                  {(((lp.education && Array.isArray(lp.education) && lp.education.length > 0) || 
                    (lp.educations_details && Array.isArray(lp.educations_details) && lp.educations_details.length > 0))) && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">🎓</div>
                        <h3 className="font-semibold text-gray-900">Education</h3>
                      </div>
                      <div className="space-y-3">
                        {/* Combine both education fields safely */}
                        {(Array.isArray(lp.education) ? lp.education : (Array.isArray(lp.educations_details) ? lp.educations_details : [])).map((edu: any, index: number) => (
                          <div key={index} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {edu.title || edu.school || edu.institute || edu.institution || (typeof edu === 'string' ? edu : `Education ${index + 1}`)}
                                </p>
                                {edu.degree && <p className="text-sm text-gray-700">{edu.degree}</p>}
                                {(edu.field_of_study || edu.field) && <p className="text-sm text-gray-600">{edu.field_of_study || edu.field}</p>}
                                {edu.description && <p className="text-sm text-gray-600">{edu.description}</p>}
                                {(edu.url || edu.school_url) && (
                                  <a 
                                    href={edu.url || edu.school_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    Visit Institution
                                  </a>
                                )}
                              </div>
                              {(edu.start_year || edu.end_year || edu.start_date || edu.end_date) && (
                                <div className="text-xs text-gray-500 text-right bg-white px-2 py-1 rounded">
                                  {(edu.start_year || edu.start_date) && (edu.start_year || edu.start_date).toString().replace(':', '')} {(edu.start_year || edu.start_date) && (edu.end_year || edu.end_date) ? '–' : ''} {(edu.end_year || edu.end_date) && (edu.end_year || edu.end_date).toString().replace(':', '')}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Volunteer Experience */}
                  {lp.volunteer_experience && Array.isArray(lp.volunteer_experience) && lp.volunteer_experience.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">🤝</div>
                        <h3 className="font-semibold text-gray-900">Volunteer Experience</h3>
                        <Badge variant="outline" className="text-xs">Community Involvement</Badge>
                      </div>
                      <div className="space-y-3">
                        {lp.volunteer_experience.map((vol: any, index: number) => (
                          <div key={index} className="border border-gray-100 rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{vol.title || vol.role}</p>
                                {(vol.subtitle || vol.organization) && <p className="text-sm text-blue-700 font-medium">{vol.subtitle || vol.organization}</p>}
                                {vol.cause && (
                                  <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                    {vol.cause}
                                  </span>
                                )}
                              </div>
                              {(vol.duration || vol.start_date || vol.end_date) && (
                                <div className="text-xs text-gray-500 text-right bg-white px-2 py-1 rounded">
                                  {vol.duration_short || vol.duration || `${vol.start_date || ''} - ${vol.end_date || 'Present'}`}
                                </div>
                              )}
                            </div>
                            {(vol.info || vol.description) && (
                              <div className="mt-3 p-3 bg-white bg-opacity-50 rounded border-l-4 border-green-400">
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                                  {vol.info || vol.description}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience - Handle null values from BrightData */}
                  {(lp.experience && Array.isArray(lp.experience) && lp.experience.length > 0) ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">💼</div>
                        <h3 className="font-semibold text-gray-900">Professional Experience</h3>
                      </div>
                      <div className="space-y-4">
                        {lp.experience.slice(0, 3).map((exp: any, index: number) => (
                          <div key={index} className="border border-gray-100 rounded-lg p-3 bg-gray-50 relative">
                            {/* Timeline indicator */}
                            {index < lp.experience.length - 1 && (
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
                        {lp.experience.length > 3 && (
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs">
                              +{lp.experience.length - 3} more positions
                            </Badge>
                          </div>
                        )}
                        {/* Show note for synthesized experience data */}
                        {lp.experience.length === 1 && 
                         lp.experience[0]?.title === 'Professional' && 
                         lp.experience[0]?.duration === 'Current' && (
                          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-700 flex items-center gap-1">
                              ℹ️ <span>Experience synthesized from current company data due to LinkedIn privacy settings</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">💼</div>
                        <h3 className="font-semibold text-gray-900">Professional Experience</h3>
                      </div>
                      <div className="text-center py-4">
                        <div className="text-gray-500 text-sm">
                          <div className="mb-2">📍 Professional experience not available on LinkedIn profile</div>
                          <div className="text-xs text-gray-400">
                            This contact may have their experience section set to private or not filled out
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contact Links */}
                  {(((lp.bio_links && Array.isArray(lp.bio_links) && lp.bio_links.length > 0) ||
                    (lp.contact_info?.websites && Array.isArray(lp.contact_info?.websites) && lp.contact_info.websites.length > 0))) && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="h-4 w-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">Contact Links</h3>
                      </div>
                      <div className="space-y-2">
                        {/* Handle bio_links format */}
                        {lp.bio_links && Array.isArray(lp.bio_links) &&
                          lp.bio_links.map((link: any, index: number) => (
                            <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                              <div className="text-blue-600">🔗</div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{link.title || 'Website'}</p>
                                <a 
                                  href={link.link || link} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-sm text-blue-600 hover:text-blue-800 break-all"
                                >
                                  {link.link || link}
                                </a>
                              </div>
                            </div>
                          ))
                        }
                        {/* Handle contact_info.websites format */}
                        {lp.contact_info?.websites && Array.isArray(lp.contact_info?.websites) &&
                          lp.contact_info.websites.map((website: string, index: number) => (
                            <div key={`website-${index}`} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                              <div className="text-blue-600">🌐</div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Company Website</p>
                                <a 
                                  href={website.startsWith('http') ? website : `https://${website}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-sm text-blue-600 hover:text-blue-800 break-all"
                                >
                                  {website}
                                </a>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {/* People Also Viewed - Networking Opportunities */}
                  {lp.people_also_viewed && Array.isArray(lp.people_also_viewed) && lp.people_also_viewed.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">👥</div>
                        <h3 className="font-semibold text-gray-900">People Also Viewed</h3>
                        <Badge variant="outline" className="text-xs">Networking</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {lp.people_also_viewed.slice(0, 6).map((person: any, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-600">{person.name?.charAt(0)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{person.name}</p>
                              <p className="text-xs text-gray-600 truncate">{person.about}</p>
                              {person.location && (
                                <p className="text-xs text-gray-500">{person.location}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {lp.people_also_viewed.length > 6 && (
                        <div className="text-center mt-3">
                          <Badge variant="outline" className="text-xs">
                            +{lp.people_also_viewed.length - 6} more connections
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Data Sections (Only if Available) */}
                  
                  {/* Recommendations */}
                  {lp.recommendations && Array.isArray(lp.recommendations) && lp.recommendations.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">⭐</div>
                        <h3 className="font-semibold text-gray-900">Recommendations</h3>
                      </div>
                      <div className="space-y-3">
                        {lp.recommendations.slice(0, 2).map((rec: string, index: number) => (
                          <div key={index} className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border-l-4 border-orange-400">
                            <p className="text-sm text-gray-800 italic leading-relaxed">"{rec}"</p>
                          </div>
                        ))}
                        {lp.recommendations.length > 2 && (
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs">
                              +{lp.recommendations.length - 2} more recommendations
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Posts - CRITICAL for personalization */}
                  {lp.posts && Array.isArray(lp.posts) && lp.posts.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 text-gray-600">📱</div>
                        <h3 className="font-semibold text-gray-900">Recent Posts</h3>
                        <Badge variant="outline" className="text-xs">Personalization</Badge>
                      </div>
                      <div className="space-y-3">
                        {lp.posts.slice(0, 2).map((post: any, index: number) => (
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

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Contact Notes</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Keep track of important information, conversation history, and insights about this contact.
                </p>
              </div>
              
              <div className="p-4">
                {notesLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="text-gray-500">Loading notes...</div>
                  </div>
                ) : (
                  <RichTextEditor
                    value={notes}
                    onChange={setNotes}
                    onSave={saveNotes}
                    placeholder="Start typing your notes about this contact..."
                    autoSave={true}
                    minHeight="300px"
                    className="w-full"
                  />
                )}
              </div>
              
              {!notesLoading && (
                <div className="px-4 pb-4 text-xs text-gray-500">
                  💡 Tip: Notes are automatically saved as you type. Use the rich text editor to format your content.
                </div>
              )}
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
              {campaignsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading campaigns…</div>
              ) : campaignHistory.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Send className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">No campaign history</p>
                  <p className="text-sm text-gray-500">This contact hasn't been included in any campaigns yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignHistory.map((c: any) => (
                    <div key={c.id} className="p-4 bg-white rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{c.name}</h4>
                          <div className="text-xs text-gray-600 mt-1">
                            Joined {new Date(c.joined_at).toLocaleDateString()} • Step {c.current_step || 0}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{c.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs text-gray-700">
                        <div>Sent: <span className="font-medium">{c.emails_sent || 0}</span></div>
                        <div>Opened: <span className="font-medium">{c.emails_opened || 0}</span></div>
                        <div>Clicked: <span className="font-medium">{c.emails_clicked || 0}</span></div>
                        <div>Replied: <span className="font-medium">{c.emails_replied || 0}</span></div>
                      </div>
                      {(c.last_sent_at || c.last_open_at || c.last_reply_at || c.last_click_at) && (
                        <div className="text-xs text-gray-500 mt-2">
                          {c.last_sent_at && <span className="mr-3">Last sent: {new Date(c.last_sent_at).toLocaleString()}</span>}
                          {c.last_open_at && <span className="mr-3">Last open: {new Date(c.last_open_at).toLocaleString()}</span>}
                          {c.last_click_at && <span className="mr-3">Last click: {new Date(c.last_click_at).toLocaleString()}</span>}
                          {c.last_reply_at && <span>Last reply: {new Date(c.last_reply_at).toLocaleString()}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination Controls */}
              {campaignPagination && (campaignPagination.hasNextPage || campaignPagination.hasPrevPage) && !campaignsLoading && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    Page {campaignPagination.page}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!campaignPagination.hasPrevPage}
                      onClick={() => setCampaignPage(campaignPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!campaignPagination.hasNextPage}
                      onClick={() => setCampaignPage(campaignPage + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-xs text-gray-500">
            Contact ID: {hydratedContact.id}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button
                onClick={() => {
                  onEdit(hydratedContact)
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
