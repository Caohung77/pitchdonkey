'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ApiClient } from '@/lib/api-client'
import { HTMLEmailEditor } from '@/components/campaigns/HTMLEmailEditor'
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
  Save
} from 'lucide-react'

interface SimpleCampaignData {
  name: string
  description: string
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
    email_subject: '',
    html_content: '',
    contact_list_ids: [],
    send_immediately: true,
    timezone: ''
  })
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
      const result = await ApiClient.post('/api/campaigns/simple', {
        ...campaignData,
        status: 'draft'
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
      
      const payload = {
        ...campaignData,
        status: campaignData.send_immediately ? 'sending' : 'scheduled'
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
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      campaignData.contact_list_ids.includes(list.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setCampaignData(prev => ({
                        ...prev,
                        contact_list_ids: prev.contact_list_ids.includes(list.id)
                          ? prev.contact_list_ids.filter(id => id !== list.id)
                          : [...prev.contact_list_ids, list.id]
                      }))
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
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
                      <Badge variant="secondary">
                        {list.contactCount} contacts
                      </Badge>
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
            <HTMLEmailEditor
              subject={campaignData.email_subject}
              htmlContent={campaignData.html_content}
              onSubjectChange={(subject) => setCampaignData(prev => ({ ...prev, email_subject: subject }))}
              onContentChange={(content) => setCampaignData(prev => ({ ...prev, html_content: content }))}
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
                      onChange={() => setCampaignData(prev => ({ ...prev, send_immediately: false }))}
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
                        <input
                          type="datetime-local"
                          className={`w-full px-3 py-2 border rounded-md ${errors.scheduled_date ? 'border-red-500' : 'border-gray-300'}`}
                          min={new Date().toISOString().slice(0, 16)}
                          value={campaignData.scheduled_date || ''}
                          onChange={(e) => setCampaignData(prev => ({ 
                            ...prev, 
                            scheduled_date: e.target.value 
                          }))}
                        />
                        {errors.scheduled_date && <p className="text-red-500 text-sm mt-1">{errors.scheduled_date}</p>}
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

                    {campaignData.scheduled_date && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-start">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 mr-2" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-900">Scheduled for:</p>
                            <p className="text-blue-700">
                              {new Date(campaignData.scheduled_date).toLocaleString()} ({campaignData.timezone})
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
    <div className="max-w-4xl mx-auto">
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
            <Button onClick={handleLaunch} disabled={loading} className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              {campaignData.send_immediately ? 'Send Now' : 'Schedule Campaign'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}