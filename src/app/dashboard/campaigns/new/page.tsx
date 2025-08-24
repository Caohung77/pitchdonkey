'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Users, 
  Mail, 
  Settings, 
  Play,
  AlertCircle,
  Info,
  Plus,
  Filter,
  List
} from 'lucide-react'
import { SequenceBuilder } from '@/components/campaigns/SequenceBuilder'
import { CreateSegmentModal } from '@/components/contacts/CreateSegmentModal'
import { ApiClient } from '@/lib/api-client'

interface CampaignData {
  name: string
  description: string
  contactSegments: string[]
  emailSequence: EmailStep[]
  aiSettings: {
    enabled: boolean
    templateId?: string
    customPrompt?: string
  }
  scheduleSettings: {
    timeZoneDetection: boolean
    businessHoursOnly: boolean
    avoidWeekends: boolean
    dailyLimit: number
  }
  launchSettings: {
    launchType: 'now' | 'scheduled'
    scheduledDate?: string
    scheduledTime?: string
    timezone?: string
  }
}

interface EmailStep {
  id: string
  stepNumber: number
  subject: string
  content: string
  delayDays: number
  conditions: StepCondition[]
}

interface StepCondition {
  type: 'reply_received' | 'email_opened' | 'link_clicked' | 'time_elapsed'
  action: 'stop_sequence' | 'skip_step' | 'branch_to_step'
  value?: any
}

interface ContactSegment {
  id: string
  name: string
  contactCount: number
  description: string
}

const WIZARD_STEPS = [
  { id: 'basic', title: 'Campaign Details', description: 'Name and description' },
  { id: 'contacts', title: 'Select Contacts', description: 'Choose your audience' },
  { id: 'sequence', title: 'Email Sequence', description: 'Build your email flow' },
  { id: 'settings', title: 'Settings', description: 'AI and scheduling options' },
  { id: 'review', title: 'Review & Launch', description: 'Final review' }
]

export default function NewCampaignPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    description: '',
    contactSegments: [],
    emailSequence: [{
      id: '1',
      stepNumber: 1,
      subject: '',
      content: '',
      delayDays: 0,
      conditions: []
    }],
    aiSettings: {
      enabled: true
    },
    scheduleSettings: {
      timeZoneDetection: true,
      businessHoursOnly: true,
      avoidWeekends: true,
      dailyLimit: 50
    },
    launchSettings: {
      launchType: 'now',
      timezone: ''
    }
  })
  const [contactSegments, setContactSegments] = useState<ContactSegment[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCreateSegmentModal, setShowCreateSegmentModal] = useState(false)

  interface ContactList {
    id: string
    name: string
    description: string
    contactCount: number
    type: 'list'
  }

  useEffect(() => {
    fetchContactSegments()
    fetchContactLists()
    
    // Set default timezone after component mounts (client-side only)
    if (typeof window !== 'undefined') {
      setCampaignData(prev => ({
        ...prev,
        launchSettings: {
          ...prev.launchSettings,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      }))
    }
  }, [])

  const fetchContactSegments = async () => {
    try {
      const segments = await ApiClient.get('/api/contacts/segments')
      
      // Handle API response format
      let segmentsData = []
      if (segments.success && Array.isArray(segments.data)) {
        segmentsData = segments.data
      } else if (Array.isArray(segments)) {
        segmentsData = segments
      } else {
        console.error('API returned unexpected format:', segments)
        segmentsData = []
      }
      
      setContactSegments(segmentsData)
    } catch (error) {
      console.error('Error fetching contact segments:', error)
      setContactSegments([]) // Set empty array on error
    }
  }

  const fetchContactLists = async () => {
    try {
      const lists = await ApiClient.get('/api/contacts/lists')
      
      // Handle API response format
      let listsData = []
      if (lists.success && Array.isArray(lists.data)) {
        listsData = lists.data
      } else if (Array.isArray(lists)) {
        listsData = lists
      } else {
        console.error('API returned unexpected format:', lists)
        listsData = []
      }
      
      setContactLists(listsData)
    } catch (error) {
      console.error('Error fetching contact lists:', error)
      setContactLists([]) // Set empty array on error
    }
  }

  const handleSegmentCreated = (newSegment: ContactSegment) => {
    setContactSegments(prev => [...prev, newSegment])
    // Automatically select the new segment
    setCampaignData(prev => ({
      ...prev,
      contactSegments: [...prev.contactSegments, newSegment.id]
    }))
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 0: // Basic details
        if (!campaignData.name.trim()) {
          newErrors.name = 'Campaign name is required'
        }
        break
      case 1: // Contacts
        if (campaignData.contactSegments.length === 0) {
          newErrors.contacts = 'Please select at least one contact segment'
        }
        break
      case 2: // Sequence
        if (campaignData.emailSequence.length === 0) {
          newErrors.sequence = 'Please add at least one email step'
        }
        campaignData.emailSequence.forEach((step, index) => {
          if (!step.subject.trim()) {
            newErrors[`step_${index}_subject`] = 'Subject is required'
          }
          if (!step.content.trim()) {
            newErrors[`step_${index}_content`] = 'Email content is required'
          }
        })
        break
      case 3: // Settings
        if (campaignData.launchSettings.launchType === 'scheduled') {
          if (!campaignData.launchSettings.scheduledDate) {
            newErrors.scheduledDate = 'Launch date is required for scheduled campaigns'
          }
          if (!campaignData.launchSettings.scheduledTime) {
            newErrors.scheduledTime = 'Launch time is required for scheduled campaigns'
          }
          if (!campaignData.launchSettings.timezone) {
            newErrors.timezone = 'Timezone is required for scheduled campaigns'
          }
          
          // Validate that scheduled time is in the future
          if (campaignData.launchSettings.scheduledDate && campaignData.launchSettings.scheduledTime) {
            const scheduledDateTime = new Date(campaignData.launchSettings.scheduledDate + 'T' + campaignData.launchSettings.scheduledTime)
            const now = new Date()
            if (scheduledDateTime <= now) {
              newErrors.scheduledDateTime = 'Scheduled time must be in the future'
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

  const handleSaveDraft = async () => {
    try {
      setLoading(true)
      const result = await ApiClient.post('/api/campaigns', {
        ...campaignData,
        status: 'draft'
      })
      
      // Handle response format
      if (result.success || result.id) {
        router.push('/dashboard/campaigns')
      } else {
        console.error('Failed to save draft:', result)
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
      const result = await ApiClient.post('/api/campaigns', {
        ...campaignData,
        status: 'running'
      })
      
      // Handle response format
      if (result.success || result.id) {
        router.push('/dashboard/campaigns')
      } else {
        console.error('Failed to launch campaign:', result)
        alert('Failed to launch campaign. Please try again.')
      }
    } catch (error) {
      console.error('Error launching campaign:', error)
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
                placeholder="e.g., Q1 Sales Outreach"
                value={campaignData.name}
                onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Brief description of your campaign goals..."
                value={campaignData.description}
                onChange={(e) => setCampaignData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                <div>
                  <h4 className="font-medium text-blue-900">Campaign Best Practices</h4>
                  <ul className="text-sm text-blue-700 mt-1 space-y-1">
                    <li>• Use clear, descriptive names for easy identification</li>
                    <li>• Keep descriptions focused on your main objective</li>
                    <li>• Consider your target audience when naming campaigns</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Select Contact Segments</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowCreateSegmentModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Segment
                </Button>
              </div>
              
              {errors.contacts && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-red-600 text-sm">{errors.contacts}</p>
                </div>
              )}
              
              <div className="space-y-6">
                {/* Segments Section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    Contact Segments (Dynamic Filters)
                  </h4>
                  <div className="grid gap-3">
                    {(Array.isArray(contactSegments) ? contactSegments : []).map((segment) => (
                      <div
                        key={segment.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          campaignData.contactSegments.includes(segment.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setCampaignData(prev => ({
                            ...prev,
                            contactSegments: prev.contactSegments.includes(segment.id)
                              ? prev.contactSegments.filter(id => id !== segment.id)
                              : [...prev.contactSegments, segment.id]
                          }))
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              campaignData.contactSegments.includes(segment.id)
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {campaignData.contactSegments.includes(segment.id) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div>
                              <h5 className="font-medium">{segment.name}</h5>
                              <p className="text-sm text-gray-600">{segment.description}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {segment.contactCount} contacts
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lists Section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <List className="h-4 w-4 mr-2" />
                    Contact Lists (Static Collections)
                  </h4>
                  <div className="grid gap-3">
                    {(Array.isArray(contactLists) ? contactLists : []).map((list) => (
                      <div
                        key={list.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          campaignData.contactSegments.includes(list.id)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setCampaignData(prev => ({
                            ...prev,
                            contactSegments: prev.contactSegments.includes(list.id)
                              ? prev.contactSegments.filter(id => id !== list.id)
                              : [...prev.contactSegments, list.id]
                          }))
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              campaignData.contactSegments.includes(list.id)
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-300'
                            }`}>
                              {campaignData.contactSegments.includes(list.id) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div>
                              <h5 className="font-medium">{list.name}</h5>
                              <p className="text-sm text-gray-600">{list.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="border-green-500 text-green-700">
                            {list.contactCount} contacts
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(!Array.isArray(contactSegments) || contactSegments.length === 0) && 
               (!Array.isArray(contactLists) || contactLists.length === 0) && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts to select</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create contact segments or lists to target specific audiences
                  </p>
                  <div className="mt-4 space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateSegmentModal(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Segment
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.open('/dashboard/contacts?tab=lists', '_blank')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create List
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                <div>
                  <h4 className="font-medium text-yellow-900">Contact Selection Tips</h4>
                  <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                    <li>• Start with smaller, well-targeted segments for better results</li>
                    <li>• Ensure contacts have valid email addresses</li>
                    <li>• Consider time zones for optimal delivery timing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Build Email Sequence</h3>
              {errors.sequence && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-red-600 text-sm">{errors.sequence}</p>
                </div>
              )}
            </div>

            <SequenceBuilder
              sequence={campaignData.emailSequence}
              onChange={(sequence) => setCampaignData(prev => ({ ...prev, emailSequence: sequence }))}
              errors={errors}
            />
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Campaign Settings</h3>
            </div>

            {/* AI Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  AI Personalization
                </CardTitle>
                <CardDescription>
                  Automatically personalize emails for each contact
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ai-enabled"
                    checked={campaignData.aiSettings.enabled}
                    onChange={(e) => setCampaignData(prev => ({
                      ...prev,
                      aiSettings: { ...prev.aiSettings, enabled: e.target.checked }
                    }))}
                    className="rounded"
                  />
                  <label htmlFor="ai-enabled" className="text-sm font-medium">
                    Enable AI personalization
                  </label>
                </div>

                {campaignData.aiSettings.enabled && (
                  <div className="space-y-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Custom Prompt (Optional)</label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                        placeholder="Add custom instructions for AI personalization..."
                        value={campaignData.aiSettings.customPrompt || ''}
                        onChange={(e) => setCampaignData(prev => ({
                          ...prev,
                          aiSettings: { ...prev.aiSettings, customPrompt: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Scheduling Options
                </CardTitle>
                <CardDescription>
                  Control when and how emails are sent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="timezone-detection"
                      checked={campaignData.scheduleSettings.timeZoneDetection}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        scheduleSettings: { ...prev.scheduleSettings, timeZoneDetection: e.target.checked }
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="timezone-detection" className="text-sm">
                      Auto-detect time zones
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="business-hours"
                      checked={campaignData.scheduleSettings.businessHoursOnly}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        scheduleSettings: { ...prev.scheduleSettings, businessHoursOnly: e.target.checked }
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="business-hours" className="text-sm">
                      Business hours only
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="avoid-weekends"
                      checked={campaignData.scheduleSettings.avoidWeekends}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        scheduleSettings: { ...prev.scheduleSettings, avoidWeekends: e.target.checked }
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="avoid-weekends" className="text-sm">
                      Avoid weekends
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Daily Email Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md"
                    value={campaignData.scheduleSettings.dailyLimit}
                    onChange={(e) => setCampaignData(prev => ({
                      ...prev,
                      scheduleSettings: { ...prev.scheduleSettings, dailyLimit: parseInt(e.target.value) || 50 }
                    }))}
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Maximum emails to send per day across all accounts
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Launch Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="h-5 w-5 mr-2" />
                  Launch Settings
                </CardTitle>
                <CardDescription>
                  Choose when to start your campaign
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(errors.scheduledDate || errors.scheduledTime || errors.timezone || errors.scheduledDateTime) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    {errors.scheduledDate && <p className="text-red-600 text-sm">{errors.scheduledDate}</p>}
                    {errors.scheduledTime && <p className="text-red-600 text-sm">{errors.scheduledTime}</p>}
                    {errors.timezone && <p className="text-red-600 text-sm">{errors.timezone}</p>}
                    {errors.scheduledDateTime && <p className="text-red-600 text-sm">{errors.scheduledDateTime}</p>}
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="launch-now"
                      name="launchType"
                      value="now"
                      checked={campaignData.launchSettings.launchType === 'now'}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        launchSettings: { ...prev.launchSettings, launchType: 'now' }
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="launch-now" className="text-sm font-medium">
                      Send Now
                    </label>
                    <span className="text-xs text-gray-500">Start immediately after creation</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="launch-scheduled"
                      name="launchType"
                      value="scheduled"
                      checked={campaignData.launchSettings.launchType === 'scheduled'}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        launchSettings: { ...prev.launchSettings, launchType: 'scheduled' }
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="launch-scheduled" className="text-sm font-medium">
                      Schedule for Later
                    </label>
                    <span className="text-xs text-gray-500">Choose specific date and time</span>
                  </div>
                </div>

                {campaignData.launchSettings.launchType === 'scheduled' && (
                  <div className="pl-6 space-y-4 border-l-2 border-blue-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Launch Date</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          min={new Date().toISOString().split('T')[0]}
                          value={campaignData.launchSettings.scheduledDate || ''}
                          onChange={(e) => setCampaignData(prev => ({
                            ...prev,
                            launchSettings: { ...prev.launchSettings, scheduledDate: e.target.value }
                          }))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Launch Time</label>
                        <input
                          type="time"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={campaignData.launchSettings.scheduledTime || ''}
                          onChange={(e) => setCampaignData(prev => ({
                            ...prev,
                            launchSettings: { ...prev.launchSettings, scheduledTime: e.target.value }
                          }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Timezone</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={campaignData.launchSettings.timezone || ''}
                        onChange={(e) => setCampaignData(prev => ({
                          ...prev,
                          launchSettings: { ...prev.launchSettings, timezone: e.target.value }
                        }))}
                      >
                        <option value="">Select timezone...</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                        <option value="Asia/Shanghai">Shanghai (CST)</option>
                        <option value="Australia/Sydney">Sydney (AEST)</option>
                        {typeof window !== 'undefined' && (
                          <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                            {Intl.DateTimeFormat().resolvedOptions().timeZone} (Auto-detected)
                          </option>
                        )}
                      </select>
                    </div>

                    {campaignData.launchSettings.scheduledDate && campaignData.launchSettings.scheduledTime && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-start">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 mr-2" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-900">Scheduled Launch</p>
                            <p className="text-blue-700">
                              Campaign will start on {new Date(campaignData.launchSettings.scheduledDate + 'T' + campaignData.launchSettings.scheduledTime).toLocaleDateString()} 
                              at {campaignData.launchSettings.scheduledTime} ({campaignData.launchSettings.timezone || 'Local time'})
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Review Campaign</h3>
              <p className="text-gray-600">
                Review your campaign settings before launching
              </p>
            </div>

            <div className="grid gap-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Name</dt>
                      <dd className="text-sm">{campaignData.name}</dd>
                    </div>
                    {campaignData.description && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Description</dt>
                        <dd className="text-sm">{campaignData.description}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Contacts */}
              <Card>
                <CardHeader>
                  <CardTitle>Target Audience</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {campaignData.contactSegments.map(itemId => {
                      // Check if it's a segment
                      const segment = (Array.isArray(contactSegments) ? contactSegments : []).find(s => s.id === itemId)
                      if (segment) {
                        return (
                          <div key={itemId} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Filter className="h-4 w-4 mr-2 text-blue-500" />
                              <span className="text-sm">{segment.name}</span>
                            </div>
                            <Badge variant="secondary">{segment.contactCount} contacts</Badge>
                          </div>
                        )
                      }
                      
                      // Check if it's a list
                      const list = (Array.isArray(contactLists) ? contactLists : []).find(l => l.id === itemId)
                      if (list) {
                        return (
                          <div key={itemId} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <List className="h-4 w-4 mr-2 text-green-500" />
                              <span className="text-sm">{list.name}</span>
                            </div>
                            <Badge variant="outline" className="border-green-500 text-green-700">
                              {list.contactCount} contacts
                            </Badge>
                          </div>
                        )
                      }
                      
                      return null
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Email Sequence */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Sequence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {campaignData.emailSequence.map((step, index) => (
                      <div key={step.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Step {step.stepNumber}</span>
                          {step.delayDays > 0 && (
                            <Badge variant="outline">{step.delayDays} days delay</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{step.subject}</p>
                        <p className="text-sm text-gray-600 truncate">{step.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Launch Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Launch Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Launch Type</dt>
                      <dd className="text-sm flex items-center">
                        <Play className="h-4 w-4 mr-2 text-blue-500" />
                        {campaignData.launchSettings.launchType === 'now' ? 'Send Now' : 'Scheduled'}
                      </dd>
                    </div>
                    
                    {campaignData.launchSettings.launchType === 'scheduled' && (
                      <>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Scheduled Date & Time</dt>
                          <dd className="text-sm">
                            {campaignData.launchSettings.scheduledDate && campaignData.launchSettings.scheduledTime ? (
                              <>
                                {new Date(campaignData.launchSettings.scheduledDate + 'T' + campaignData.launchSettings.scheduledTime).toLocaleDateString()} 
                                at {campaignData.launchSettings.scheduledTime}
                              </>
                            ) : (
                              'Not set'
                            )}
                          </dd>
                        </div>
                        
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Timezone</dt>
                          <dd className="text-sm">{campaignData.launchSettings.timezone || 'Not set'}</dd>
                        </div>
                      </>
                    )}
                    
                    <div>
                      <dt className="text-sm font-medium text-gray-500">AI Personalization</dt>
                      <dd className="text-sm">{campaignData.aiSettings.enabled ? 'Enabled' : 'Disabled'}</dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Daily Email Limit</dt>
                      <dd className="text-sm">{campaignData.scheduleSettings.dailyLimit} emails per day</dd>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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
            <h1 className="text-2xl font-bold">Create New Campaign</h1>
            <p className="text-gray-600">Set up your email outreach campaign</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
          Save Draft
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                index < currentStep 
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : index === currentStep
                  ? 'border-blue-600 text-blue-600'
                  : 'border-gray-300 text-gray-400'
              }`}>
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <div className="ml-3">
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
                <div className={`flex-1 h-px mx-4 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardContent className="p-6">
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

        <div className="flex items-center space-x-2">
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleLaunch} disabled={loading}>
              <Play className="h-4 w-4 mr-2" />
              {campaignData.launchSettings.launchType === 'now' ? 'Launch Now' : 'Schedule Campaign'}
            </Button>
          )}
        </div>
      </div>

      {/* Create Segment Modal */}
      <CreateSegmentModal
        isOpen={showCreateSegmentModal}
        onClose={() => setShowCreateSegmentModal(false)}
        onSegmentCreated={handleSegmentCreated}
      />
    </div>
  )
}