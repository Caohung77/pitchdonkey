'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ApiClient } from '@/lib/api-client'
import { UnifiedEmailContentEditor } from '@/components/campaigns/UnifiedEmailContentEditor'
import { ViewContactListModal } from '@/components/contacts/ViewContactListModal'
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Users, 
  Mail, 
  Clock,
  Send,
  Calendar,
  Info,
  AlertCircle,
  Play,
  Save,
  Eye
} from 'lucide-react'

interface SimpleCampaignData {
  name: string
  description: string
  sender_name: string
  email_subject: string
  html_content: string
  contact_list_ids: string[]
  send_immediately: boolean
  scheduled_date?: string
  timezone: string
}

interface ContactList {
  id: string
  name: string
  description: string
  contactCount: number
  type: 'list'
}

const WIZARD_STEPS = [
  { id: 'basic', title: 'Campaign Details', description: 'Name and target audience' },
  { id: 'content', title: 'Email Content', description: 'Subject and HTML content' },
  { id: 'schedule', title: 'Schedule & Send', description: 'When to send your email' }
]

export default function SimpleCampaignPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [campaignData, setCampaignData] = useState<SimpleCampaignData>({
    name: '',
    description: '',
    sender_name: '',
    email_subject: '',
    html_content: '',
    contact_list_ids: [],
    send_immediately: true,
    timezone: ''
  })
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [contactListsWithContacts, setContactListsWithContacts] = useState<Array<ContactList & { contacts?: Array<{ id: string; first_name: string; last_name: string; company_name: string; email: string }> }>>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [personalizedEmails, setPersonalizedEmails] = useState<Map<string, { subject: string; content: string }>>(new Map())
  const [viewContactsModal, setViewContactsModal] = useState<{ isOpen: boolean; selectedList: ContactList | null }>({
    isOpen: false,
    selectedList: null
  })

  useEffect(() => {
    fetchContactLists()
    
    // Set default timezone
    if (typeof window !== 'undefined') {
      setCampaignData(prev => ({
        ...prev,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }))
    }
  }, [])

  // Fetch contacts when selected lists change
  useEffect(() => {
    if (contactLists.length > 0) {
      fetchSelectedContactLists()
    }
  }, [campaignData.contact_list_ids, contactLists])

  const fetchContactLists = async () => {
    try {
      const lists = await ApiClient.get('/api/contacts/lists')
      
      let listsData = []
      if (lists.success && Array.isArray(lists.data)) {
        listsData = lists.data
      } else if (Array.isArray(lists)) {
        listsData = lists
      }
      
      setContactLists(listsData)
    } catch (error) {
      console.error('Error fetching contact lists:', error)
      setContactLists([])
    }
  }

  // Fetch contacts for selected lists
  const fetchSelectedContactLists = async () => {
    if (campaignData.contact_list_ids.length === 0) {
      console.log('🔍 No contact lists selected, clearing contacts')
      setContactListsWithContacts([])
      return
    }

    try {
      const selectedLists = contactLists.filter(list => 
        campaignData.contact_list_ids.includes(list.id)
      )
      
      console.log('🔍 Fetching contacts for selected lists:', selectedLists.map(l => l.name))

      // Fetch contacts for each selected list
      const listsWithContacts = await Promise.all(
        selectedLists.map(async (list) => {
          try {
            console.log(`📞 Fetching list details: ${list.name} (${list.id})`)
            
            // First get list details with contact IDs
            const listResponse = await ApiClient.get(`/api/contacts/lists/${list.id}`)
            console.log(`📞 List response for ${list.name}:`, listResponse)
            
            if (!listResponse.success || !listResponse.data) {
              console.warn(`⚠️ No list data for ${list.name}`)
              return { ...list, contacts: [] }
            }
            
            const contactIds = listResponse.data.contact_ids || []
            console.log(`📋 Contact IDs in ${list.name}:`, contactIds)
            
            if (contactIds.length === 0) {
              console.log(`📭 No contact IDs in ${list.name}`)
              return { ...list, contacts: [] }
            }
            
            // Then fetch actual contacts by IDs
            console.log(`👥 Fetching ${contactIds.length} contacts for ${list.name}`)
            const contactsResponse = await ApiClient.get(`/api/contacts?ids=${contactIds.join(',')}`)
            console.log(`👥 Contacts response for ${list.name}:`, contactsResponse)
            
            const contacts = contactsResponse.success ? contactsResponse.data?.contacts || [] : []
            console.log(`✅ Found ${contacts.length} contacts in ${list.name}`)
            
            // Log contact data to debug missing company names
            if (contacts.length > 0) {
              console.log(`📊 Sample contact data:`, contacts.slice(0, 3).map(c => ({
                id: c.id,
                name: `${c.first_name} ${c.last_name}`,
                email: c.email,
                company: c.company_name,
                hasEnrichment: !!c.enrichment_data
              })))
            }
            
            return {
              ...list,
              contacts: contacts.slice(0, 50) // Increased limit for better preview
            }
          } catch (error) {
            console.error(`❌ Error fetching contacts for list ${list.id}:`, error)
            return { ...list, contacts: [] }
          }
        })
      )

      console.log('📊 Final contactListsWithContacts:', listsWithContacts)
      setContactListsWithContacts(listsWithContacts)
    } catch (error) {
      console.error('❌ Error fetching selected contact lists:', error)
      setContactListsWithContacts([])
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 0: // Basic details
        if (!campaignData.name.trim()) {
          newErrors.name = 'Campaign name is required'
        }
        if (campaignData.contact_list_ids.length === 0) {
          newErrors.contact_lists = 'Please select at least one contact list'
        }
        break
      case 1: // Email content
        if (!campaignData.sender_name.trim()) {
          newErrors.sender_name = 'Sender name is required'
        }
        if (!campaignData.email_subject.trim()) {
          newErrors.email_subject = 'Email subject is required'
        }
        if (!campaignData.html_content.trim()) {
          newErrors.html_content = 'Email content is required'
        }
        break
      case 2: // Schedule
        if (!campaignData.send_immediately) {
          if (!campaignData.scheduled_date) {
            newErrors.scheduled_date = 'Scheduled date is required'
          } else {
            const scheduledDateTime = new Date(campaignData.scheduled_date)
            const now = new Date()
            if (scheduledDateTime <= now) {
              newErrors.scheduled_date = 'Scheduled time must be in the future'
            }
          }
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const getTotalContacts = () => {
    return contactLists
      .filter(list => campaignData.contact_list_ids.includes(list.id))
      .reduce((total, list) => total + list.contactCount, 0)
  }

  const handleSaveDraft = async () => {
    try {
      setLoading(true)
      
      // Convert Map to plain object for API
      const personalizedEmailsObj = {}
      personalizedEmails.forEach((value, key) => {
        personalizedEmailsObj[key] = value
      })
      
      const result = await ApiClient.post('/api/campaigns/simple', {
        ...campaignData,
        status: 'draft',
        personalized_emails: personalizedEmailsObj
      })
      
      if (result.success || result.id) {
        router.push('/dashboard/campaigns')
      } else {
        alert('Failed to save campaign draft. Please try again.')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      alert(`Failed to save draft: ${error.message || 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLaunch = async () => {
    if (!validateStep(currentStep)) return

    try {
      setLoading(true)
      
      // Convert Map to plain object for API
      const personalizedEmailsObj = {}
      personalizedEmails.forEach((value, key) => {
        personalizedEmailsObj[key] = value
      })
      
      const payload = {
        ...campaignData,
        status: campaignData.send_immediately ? 'sending' : 'scheduled',
        personalized_emails: personalizedEmailsObj
      }
      
      console.log('Launching campaign with payload:', payload)
      
      const result = await ApiClient.post('/api/campaigns/simple', payload)
      
      console.log('Campaign launch result:', result)
      
      if (result.success || result.id) {
        router.push('/dashboard/campaigns')
      } else {
        alert('Failed to launch campaign. Please try again.')
      }
    } catch (error) {
      console.error('Error launching campaign:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        campaignData
      })
      alert(`Failed to launch campaign: ${error.message || 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Campaign Name *</label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-md ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="e.g., Product Launch Email"
                value={campaignData.name}
                onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description (Optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Brief description of your campaign..."
                value={campaignData.description}
                onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-4">Select Contact Lists *</label>
              {errors.contact_lists && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-red-600 text-sm">{errors.contact_lists}</p>
                </div>
              )}
              
              <div className="space-y-3">
                {contactLists.map((list) => (
                  <div
                    key={list.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      campaignData.contact_list_ids.includes(list.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-3 flex-1 cursor-pointer"
                        onClick={() => {
                          setCampaignData(prev => ({
                            ...prev,
                            contact_list_ids: prev.contact_list_ids.includes(list.id)
                              ? prev.contact_list_ids.filter(id => id !== list.id)
                              : [...prev.contact_list_ids, list.id]
                          }))
                        }}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          campaignData.contact_list_ids.includes(list.id)
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {campaignData.contact_list_ids.includes(list.id) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium">{list.name}</h4>
                          <p className="text-sm text-gray-600">{list.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewContactsModal({
                              isOpen: true,
                              selectedList: list
                            })
                          }}
                          className="text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Badge variant="secondary">
                          {list.contactCount} contacts
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {contactLists.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No contact lists found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create contact lists first to target your audience
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => window.open('/dashboard/contacts?tab=lists', '_blank')}
                  >
                    Create Contact List
                  </Button>
                </div>
              )}

              {campaignData.contact_list_ids.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg mt-4">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-900">
                        Total Audience: {getTotalContacts().toLocaleString()} contacts
                      </p>
                      <p className="text-sm text-green-700">
                        Across {campaignData.contact_list_ids.length} selected list{campaignData.contact_list_ids.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            {/* Sender Name Field */}
            <div>
              <label htmlFor="sender_name" className="block text-sm font-medium text-gray-700 mb-2">
                Sender Name *
              </label>
              <input
                type="text"
                id="sender_name"
                name="sender_name"
                value={campaignData.sender_name}
                onChange={(e) => setCampaignData(prev => ({ ...prev, sender_name: e.target.value }))}
                placeholder="Your name or company name (e.g., John Doe, Acme Corp)"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.sender_name ? 'border-red-500' : 'border-gray-300'}`}
              />
              <p className="text-xs text-gray-500 mt-1">
                This will appear as the sender name in the recipient's inbox.
              </p>
              {errors.sender_name && <p className="text-red-500 text-sm mt-1">{errors.sender_name}</p>}
            </div>

            <UnifiedEmailContentEditor
              subject={campaignData.email_subject}
              htmlContent={campaignData.html_content}
              onSubjectChange={(subject) => setCampaignData(prev => ({ ...prev, email_subject: subject }))}
              onContentChange={(content) => setCampaignData(prev => ({ ...prev, html_content: content }))}
              contactLists={contactListsWithContacts}
              onPersonalizedEmailsChange={setPersonalizedEmails}
            />
            
            {errors.email_subject && <p className="text-red-500 text-sm">{errors.email_subject}</p>}
            {errors.html_content && <p className="text-red-500 text-sm">{errors.html_content}</p>}
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">When to Send</h3>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Sending Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="send-now"
                      name="sendType"
                      checked={campaignData.send_immediately}
                      onChange={() => setCampaignData(prev => ({ 
                        ...prev, 
                        send_immediately: true,
                        scheduled_date: undefined
                      }))}
                    />
                    <label htmlFor="send-now" className="flex items-center">
                      <Send className="h-4 w-4 mr-2 text-green-600" />
                      <div>
                        <p className="font-medium">Send Immediately</p>
                        <p className="text-sm text-gray-600">Start sending emails right after creation</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="send-later"
                      name="sendType"
                      checked={!campaignData.send_immediately}
                      onChange={() => {
                        setCampaignData(prev => ({ ...prev, send_immediately: false }))
                        if (!scheduleDate || !scheduleTime) {
                          const next = getNext5MinSlot()
                          setScheduleDate(next.date)
                          setScheduleTime(next.time)
                          setCampaignData(prev => ({ ...prev, scheduled_date: `${next.date}T${next.time}` }))
                        }
                      }}
                    />
                    <label htmlFor="send-later" className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                      <div>
                        <p className="font-medium">Schedule for Later</p>
                        <p className="text-sm text-gray-600">Choose a specific date and time</p>
                      </div>
                    </label>
                  </div>
                </div>

                {!campaignData.send_immediately && (
                  <div className="pl-7 space-y-4 border-l-2 border-blue-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Date & Time</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            className={`w-full px-3 py-2 border rounded-md ${errors.scheduled_date ? 'border-red-500' : 'border-gray-300'}`}
                            min={localDateString()}
                            value={scheduleDate}
                            onChange={(e) => {
                              setScheduleDate(e.target.value)
                              setCampaignData(prev => ({ ...prev, scheduled_date: `${e.target.value}T${scheduleTime || '00:00'}` }))
                              setTimeout(validateSchedule, 0)
                            }}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              aria-label="Hour"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              value={scheduleTime ? scheduleTime.split(':')[0] : ''}
                              onChange={(e) => {
                                const h = e.target.value.padStart(2, '0')
                                const m = scheduleTime ? scheduleTime.split(':')[1] : '00'
                                const t = `${h}:${m}`
                                setScheduleTime(t)
                                setCampaignData(prev => ({ ...prev, scheduled_date: `${scheduleDate}T${t}` }))
                                setTimeout(validateSchedule, 0)
                              }}
                            >
                              <option value="" disabled>Select hour</option>
                              {Array.from({ length: 24 }).map((_, h) => (
                                <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>
                              ))}
                            </select>
                            <select
                              aria-label="Minute"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              value={scheduleTime ? scheduleTime.split(':')[1] : ''}
                              onChange={(e) => {
                                const m = e.target.value.padStart(2, '0')
                                const h = scheduleTime ? scheduleTime.split(':')[0] : '00'
                                const t = `${h}:${m}`
                                setScheduleTime(t)
                                setCampaignData(prev => ({ ...prev, scheduled_date: `${scheduleDate}T${t}` }))
                                setTimeout(validateSchedule, 0)
                              }}
                            >
                              <option value="" disabled>Select minutes</option>
                              {Array.from({ length: 12 }).map((_, i) => {
                                const m = String(i * 5).padStart(2, '0')
                                return <option key={m} value={m}>{m}</option>
                              })}
                            </select>
                          </div>
                        </div>
                        {(errors.scheduled_date || scheduleError) && <p className="text-red-500 text-sm mt-1">{errors.scheduled_date || scheduleError}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Timezone</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={campaignData.timezone}
                          onChange={(e) => setCampaignData(prev => ({ ...prev, timezone: e.target.value }))}
                        >
                          <option value="America/New_York">Eastern Time (ET)</option>
                          <option value="America/Chicago">Central Time (CT)</option>
                          <option value="America/Denver">Mountain Time (MT)</option>
                          <option value="America/Los_Angeles">Pacific Time (PT)</option>
                          <option value="Europe/London">London (GMT)</option>
                          <option value="Europe/Paris">Paris (CET)</option>
                          {typeof window !== 'undefined' && (
                            <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                              {Intl.DateTimeFormat().resolvedOptions().timeZone} (Auto-detected)
                            </option>
                          )}
                        </select>
                      </div>
                    </div>

                    {scheduleDate && scheduleTime && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-start">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 mr-2" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-900">Scheduled for:</p>
                            <p className="text-blue-700">
                              {parseLocalDateTime(scheduleDate, scheduleTime).toLocaleString()} ({campaignData.timezone})
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Campaign Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Campaign Name:</span>
                  <span className="font-medium">{campaignData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Recipients:</span>
                  <span className="font-medium">{getTotalContacts().toLocaleString()} contacts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email Subject:</span>
                  <span className="font-medium">{campaignData.email_subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Send Type:</span>
                  <span className="font-medium">
                    {campaignData.send_immediately ? 'Immediate' : 'Scheduled'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Simple Campaign</h1>
            <p className="text-gray-600">Send a single HTML email to your contacts</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                index < currentStep 
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : index === currentStep
                  ? 'border-blue-600 text-blue-600'
                  : 'border-gray-300 text-gray-400'
              }`}>
                {index < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${
                  index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {step.title}
                </p>
                <p className={`text-xs ${
                  index <= currentStep ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {step.description}
                </p>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-6 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardContent className="p-8">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center space-x-3">
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleLaunch} disabled={loading || (!campaignData.send_immediately && !!scheduleError)} className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              {campaignData.send_immediately ? 'Send Now' : 'Schedule Campaign'}
            </Button>
          )}
        </div>
      </div>

      {/* Contact List View Modal */}
      <ViewContactListModal
        list={viewContactsModal.selectedList}
        isOpen={viewContactsModal.isOpen}
        onClose={() => setViewContactsModal({ isOpen: false, selectedList: null })}
      />
    </div>
  )
}
