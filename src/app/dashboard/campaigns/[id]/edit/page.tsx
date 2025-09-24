'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ApiClient } from '@/lib/api-client'
import { UnifiedEmailContentEditor } from '@/components/campaigns/UnifiedEmailContentEditor'
import { SaveTemplateDialog } from '@/components/campaigns/SaveTemplateDialog'
import { ViewContactListModal } from '@/components/contacts/ViewContactListModal'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  Eye,
  CheckCircle,
  BarChart3
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
  from_email_account_id?: string
  daily_send_limit?: number
  // Enhanced template fields
  email_purpose?: string
  language?: 'English' | 'German'
  generate_for_all?: boolean
  use_contact_info?: boolean
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

export default function EditSimpleCampaignPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const campaignId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [currentStep, setCurrentStep] = useState(0)
  const [campaignData, setCampaignData] = useState<SimpleCampaignData>({
    name: '',
    description: '',
    sender_name: '',
    email_subject: '',
    html_content: '',
    contact_list_ids: [],
    send_immediately: true,
    timezone: '',
    from_email_account_id: '',
    daily_send_limit: 5,
    // Enhanced template fields
    email_purpose: '',
    language: 'English',
    generate_for_all: false,
    use_contact_info: true
  })
  const [emailAccounts, setEmailAccounts] = useState<any[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [contactListsWithContacts, setContactListsWithContacts] = useState<Array<ContactList & { contacts?: Array<{ id: string; first_name: string; last_name: string; company_name: string; email: string }> }>>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [personalizedEmails, setPersonalizedEmails] = useState<Map<string, { subject: string; content: string }>>(new Map())
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [campaignResult, setCampaignResult] = useState<any>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [initializing, setInitializing] = useState(true)
  
  // Debug personalized emails changes
  useEffect(() => {
    if (personalizedEmails.size > 0) {
      console.log('🎯 Campaign page received personalized emails:', {
        totalEmails: personalizedEmails.size,
        contactIds: Array.from(personalizedEmails.keys()),
        emailSamples: Array.from(personalizedEmails.entries()).slice(0, 2).map(([id, email]) => ({
          contactId: id,
          subjectLength: email.subject?.length || 0,
          contentLength: email.content?.length || 0,
          contentPreview: email.content?.substring(0, 150) + '...' || 'none'
        }))
      })
    } else {
      console.log('📭 Campaign page: No personalized emails received')
    }
  }, [personalizedEmails])
  const [viewContactsModal, setViewContactsModal] = useState<{ isOpen: boolean; selectedList: ContactList | null }>({
    isOpen: false,
    selectedList: null
  })
  // Scheduling UI state (separate from payload for better control)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Helpers for scheduling (function declarations to avoid TDZ issues)
  function getNext5MinSlot() {
    const now = new Date()
    const ms = 5 * 60 * 1000
    const rounded = new Date(Math.ceil(now.getTime() / ms) * ms)
    const yyyy = rounded.getFullYear()
    const mm = String(rounded.getMonth() + 1).padStart(2, '0')
    const dd = String(rounded.getDate()).padStart(2, '0')
    const hh = String(rounded.getHours()).padStart(2, '0')
    const min = String(rounded.getMinutes()).padStart(2, '0')
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` }
  }

  function parseLocalDateTime(dateStr: string, timeStr: string) {
    let y = 0, m = 0, d = 0
    if (dateStr?.includes('-')) {
      const parts = dateStr.split('-')
      y = parseInt(parts[0], 10)
      m = parseInt(parts[1], 10)
      d = parseInt(parts[2], 10)
    } else if (dateStr?.includes('.')) {
      const parts = dateStr.split('.')
      d = parseInt(parts[0], 10)
      m = parseInt(parts[1], 10)
      y = parseInt(parts[2], 10)
    }
    const [hh, mm] = (timeStr || '00:00').split(':').map(v => parseInt(v, 10))
    return new Date(y, m - 1, d, hh || 0, mm || 0)
  }

  function localDateString() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function validateSchedule() {
    setScheduleError(null)
    if (!campaignData.send_immediately) {
      if (!scheduleDate || !scheduleTime) {
        setScheduleError('Please choose both date and time.')
        return false
      }
      const selected = parseLocalDateTime(scheduleDate, scheduleTime)
      if (isNaN(selected.getTime()) || selected.getTime() <= Date.now()) {
        setScheduleError('Scheduled time must be in the future')
        return false
      }
    }
    return true
  }

  // Load templates
  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/ai/templates')
      if (res.ok) {
        const json = await res.json()
        setTemplates(json.data || [])
      }
    } catch (e) {
      console.warn('Failed to load templates', e)
    }
  }

  useEffect(() => {
    fetchContactLists()
    loadTemplates()

    // Set default timezone only if not already provided by campaign data
    if (typeof window !== 'undefined') {
      setCampaignData(prev => ({
        ...prev,
        timezone: prev.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }))
    }
    // Load email accounts
    ;(async () => {
      try {
        const resp = await ApiClient.get('/api/email-accounts')
        const accs = resp?.data || resp
        setEmailAccounts(Array.isArray(accs) ? accs : (accs?.data || []))
      } catch (e) {
        console.error('Failed to load email accounts:', e)
      }
    })()
  }, [])

  useEffect(() => {
    if (!campaignId) return

    const loadCampaign = async () => {
      try {
        setInitializing(true)
        const result = await ApiClient.get(`/api/campaigns/${campaignId}`)
        const data = result?.data || result

        if (!data || !data.id) {
          throw new Error('Campaign not found')
        }

        let descriptionText = ''
        let senderName = data.sender_name || ''
        try {
          if (data.description) {
            const parsed = typeof data.description === 'string'
              ? JSON.parse(data.description)
              : data.description
            descriptionText = parsed?.description || ''
            senderName = senderName || parsed?.sender_name || ''
          }
        } catch (error) {
          console.warn('Failed to parse campaign description JSON:', error)
          descriptionText = data.description || ''
        }

        const contactListIds = Array.isArray(data.contact_list_ids)
          ? data.contact_list_ids.filter((id: string) => typeof id === 'string')
          : []

        setCampaignData(prev => ({
          ...prev,
          name: data.name || '',
          description: descriptionText,
          sender_name: senderName || '',
          email_subject: data.email_subject || '',
          html_content: data.html_content || '',
          contact_list_ids: contactListIds,
          send_immediately: data.send_immediately !== false,
          scheduled_date: data.scheduled_date || '',
          timezone: data.timezone || prev.timezone || (typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
          from_email_account_id: data.from_email_account_id || '',
          daily_send_limit: data.daily_send_limit || prev.daily_send_limit || 5,
          email_purpose: data.email_purpose || prev.email_purpose || '',
          language: data.language || prev.language || 'English',
          generate_for_all: data.generate_for_all ?? prev.generate_for_all ?? false,
          use_contact_info: data.use_contact_info ?? prev.use_contact_info ?? true
        }))

        if (data.send_immediately === false && data.scheduled_date) {
          const scheduled = new Date(data.scheduled_date)
          if (!isNaN(scheduled.getTime())) {
            setScheduleDate(scheduled.toISOString().split('T')[0])
            setScheduleTime(scheduled.toISOString().substring(11, 16))
          }
        } else {
          setScheduleDate('')
          setScheduleTime('')
        }
      } catch (error) {
        console.error('Failed to load campaign:', error)
        alert('Failed to load campaign. Redirecting back to campaigns list.')
        router.push('/dashboard/campaigns')
      } finally {
        setInitializing(false)
      }
    }

    loadCampaign()
  }, [campaignId, router])

  // Fetch contacts when selected lists change
  useEffect(() => {
    if (contactLists.length > 0) {
      fetchSelectedContactLists()
    }
  }, [campaignData.contact_list_ids, contactLists])

  // Initialize next 5-min slot when switching to scheduled
  useEffect(() => {
    if (!campaignData.send_immediately && (!scheduleDate || !scheduleTime)) {
      const next = getNext5MinSlot()
      setScheduleDate(next.date)
      setScheduleTime(next.time)
      setCampaignData(prev => ({ ...prev, scheduled_date: `${next.date}T${next.time}` }))
    }
  }, [campaignData.send_immediately])

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
          if (!validateSchedule()) {
            newErrors.scheduled_date = scheduleError || 'Invalid schedule'
          }
        }
        if (!campaignData.from_email_account_id) {
          newErrors.from_email_account_id = 'Please select an email account'
        }
        if (![5,10,15,20,30,50].includes(Number(campaignData.daily_send_limit))) {
          newErrors.daily_send_limit = 'Choose 5, 10, 15, 20, 30, or 50 per day'
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

  // Load template data into campaign
  const loadTemplate = (template: any) => {
    // Update all campaign fields from template
    setCampaignData(prev => ({
      ...prev,
      sender_name: template.sender_name || prev.sender_name,
      email_subject: template.subject || template.subject_template || prev.email_subject,
      html_content: template.content || template.body_template || prev.html_content,
      email_purpose: template.email_purpose || prev.email_purpose,
      language: template.language || prev.language,
      generate_for_all: template.generation_options?.generate_for_all ?? prev.generate_for_all,
      use_contact_info: template.generation_options?.use_contact_info ?? prev.use_contact_info
    }))
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-500 text-sm">Loading campaign...</div>
      </div>
    )
  }

  // Built-in template insertion
  const insertBuiltInTemplate = (templateType: string) => {
    const templates = {
      basic: {
        subject: "Hello {{first_name}}",
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Hello {{first_name}},</h1>

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
              I hope this email finds you well. I wanted to reach out because...
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              [Your message content here]
            </p>

            <div style="margin: 30px 0;">
              <a href="#" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Call to Action</a>
            </div>

            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Best regards,<br>
              {{sender_name}}
            </p>
          </div>
        `
      },
      professional: {
        subject: "Partnership opportunity with {{company}}",
        content: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 30px;">
            <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="border-left: 4px solid #007bff; padding-left: 20px; margin-bottom: 30px;">
                <h1 style="color: #2c3e50; font-size: 28px; margin: 0;">Hello {{first_name}},</h1>
              </div>

              <p style="color: #34495e; font-size: 16px; line-height: 1.8; margin-bottom: 20px;">
                I hope this message finds you well. I'm reaching out regarding...
              </p>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 25px 0; border-left: 4px solid #28a745;">
                <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0;">
                  [Highlighted message or key point]
                </p>
              </div>

              <div style="text-align: center; margin: 35px 0;">
                <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 35px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: 600;">Schedule a Call</a>
              </div>

              <div style="border-top: 1px solid #e9ecef; padding-top: 25px; margin-top: 35px;">
                <p style="color: #6c757d; font-size: 14px; line-height: 1.6;">
                  Best regards,<br>
                  <strong>{{sender_name}}</strong><br>
                  {{company_name}}
                </p>
              </div>
            </div>
          </div>
        `
      }
    }

    const template = templates[templateType as keyof typeof templates]
    if (template) {
      setCampaignData(prev => ({
        ...prev,
        email_subject: template.subject,
        html_content: template.content
      }))
    }
  }

  const handleSaveDraft = async () => {
    if (!campaignId) {
      alert('Missing campaign identifier')
      return
    }
    try {
      setLoading(true)

      const personalizedEmailsObj = {}
      personalizedEmails.forEach((value, key) => {
        personalizedEmailsObj[key] = value
      })

      const descriptionPayload = JSON.stringify({
        description: campaignData.description || '',
        sender_name: campaignData.sender_name || '',
        personalized_emails: personalizedEmailsObj
      })

      const draftPayload = {
        ...campaignData,
        description: descriptionPayload,
        status: 'draft',
        personalized_emails: personalizedEmailsObj
      }

      const result = await ApiClient.put(`/api/campaigns/${campaignId}`, draftPayload)
      const updatedCampaign = result?.data || result

      if (updatedCampaign && updatedCampaign.id) {
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

  const handleSave = async () => {
    if (!campaignId) {
      alert('Missing campaign identifier')
      return
    }
    console.log('💾 handleSave called, current step:', currentStep)
    const isValid = validateStep(currentStep)
    console.log('✅ Validation result:', isValid, 'Errors:', errors)

    if (!isValid) {
      console.log('❌ Validation failed, stopping')
      return
    }

    // Convert Map to plain object for API (move outside try block for error logging)
    const personalizedEmailsObj = {}
    personalizedEmails.forEach((value, key) => {
      personalizedEmailsObj[key] = value
    })

    const descriptionPayload = JSON.stringify({
      description: campaignData.description || '',
      sender_name: campaignData.sender_name || '',
      personalized_emails: personalizedEmailsObj
    })

    const payload = {
      ...campaignData,
      description: descriptionPayload,
      status: campaignData.send_immediately ? 'sending' : 'scheduled',
      personalized_emails: personalizedEmailsObj,
      scheduled_date: campaignData.send_immediately
        ? undefined
        : parseLocalDateTime(scheduleDate, scheduleTime).toISOString()
    }

    try {
      setLoading(true)

      console.log('💾 Saving campaign with payload:', {
        ...payload,
        html_content: payload.html_content?.substring(0, 100) + '...',
        personalized_emails_count: Object.keys(personalizedEmailsObj).length,
        personalized_emails_sample: Object.entries(personalizedEmailsObj).slice(0, 2).map(([id, email]) => ({
          contactId: id,
          hasSubject: !!(email as any).subject,
          contentLength: (email as any).content?.length || 0,
          contentPreview: (email as any).content?.substring(0, 100) + '...' || 'none'
        }))
      })

      const result = await ApiClient.put(`/api/campaigns/${campaignId}`, payload)

      console.log('💾 Campaign update result:', result)

      const updatedCampaign = result?.data || result

      if (updatedCampaign && updatedCampaign.id) {
        console.log('✅ Campaign updated successfully, showing modal')
        setCampaignResult(updatedCampaign)
        setShowSuccessModal(true)

        if (campaignData.send_immediately) {
          console.log('🔄 Triggering immediate campaign processing after update...')
          try {
            fetch('/api/campaigns/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            }).catch(error => {
              console.error('⚠️ Failed to trigger campaign processing:', error)
            })
          } catch (error) {
            console.error('⚠️ Error triggering campaign processing:', error)
          }
        }
      } else {
        console.error('❌ Campaign update failed:', result)
        alert('Failed to save campaign. Please try again.')
      }
    } catch (error) {
      console.error('❌ Error saving campaign:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        campaignData,
        payload  // Now accessible since it's defined outside the try block
      })
      alert(`Failed to save campaign: ${error.message || 'Please try again.'}`)
    } finally {
      console.log('🔄 Resetting loading state')
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
            {/* Quick Templates Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900">Quick Templates</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveTemplateDialogOpen(true)}
                  className="flex items-center bg-white"
                >
                  <Save className="h-4 w-4 mr-1" /> Save as Template
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => insertBuiltInTemplate('basic')} className="bg-white">
                  Basic Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => insertBuiltInTemplate('professional')} className="bg-white">
                  Professional
                </Button>
                {templates.map((tpl) => (
                  <Button key={tpl.id} variant="outline" size="sm" onClick={() => loadTemplate(tpl)} className="bg-white">
                    {tpl.name}
                  </Button>
                ))}
              </div>
            </div>

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
              // Enhanced template fields
              emailPurpose={campaignData.email_purpose}
              onEmailPurposeChange={(purpose) => setCampaignData(prev => ({ ...prev, email_purpose: purpose }))}
              language={campaignData.language}
              onLanguageChange={(language) => setCampaignData(prev => ({ ...prev, language }))}
              generateForAll={campaignData.generate_for_all}
              onGenerateForAllChange={(generateForAll) => setCampaignData(prev => ({ ...prev, generate_for_all: generateForAll }))}
              useContactInfo={campaignData.use_contact_info}
              onUseContactInfoChange={(useContactInfo) => setCampaignData(prev => ({ ...prev, use_contact_info: useContactInfo }))}
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
                {/* Email Account Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Email Account *</label>
                  <select
                    className={`w-full px-3 py-2 border rounded-md ${errors.from_email_account_id ? 'border-red-500' : 'border-gray-300'}`}
                    value={campaignData.from_email_account_id}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, from_email_account_id: e.target.value }))}
                  >
                    <option value="">Select an email account…</option>
                    {emailAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.email} {acc.provider ? `(${acc.provider})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.from_email_account_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.from_email_account_id}</p>
                  )}
                </div>

                {/* Daily Send Limit (Batch Size) */}
                <div>
                  <label className="block text-sm font-medium mb-2">Daily Send Limit (Batch Size) *</label>
                  <div className="grid grid-cols-6 gap-2">
                    {[5,10,15,20,30,50].map(v => (
                      <button
                        key={v}
                        type="button"
                        className={`px-3 py-2 border rounded-md text-sm transition-colors ${campaignData.daily_send_limit === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400'}`}
                        onClick={() => setCampaignData(prev => ({ ...prev, daily_send_limit: v }))}
                      >
                        {v}/day
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Choose how many emails to send per day. Smaller batches (5-10) are better for deliverability and warmup.
                  </p>
                  {errors.daily_send_limit && (
                    <p className="text-red-500 text-sm mt-1">{errors.daily_send_limit}</p>
                  )}
                </div>
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
            <h1 className="text-2xl font-bold">Edit Simple Campaign</h1>
            <p className="text-gray-600">Update your campaign content, recipients, and schedule</p>
          </div>
        </div>
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
            <Button onClick={handleSave} disabled={loading || (!campaignData.send_immediately && !!scheduleError)} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
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

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-xl font-semibold">
              Campaign Updated
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {campaignData.send_immediately
                ? 'Your changes are saved and the campaign will continue sending immediately.'
                : 'Your campaign updates have been saved. The schedule has been refreshed with the latest settings.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Campaign Name:</span>
              <span className="font-medium">{campaignData.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Recipients:</span>
              <span className="font-medium">{getTotalContacts().toLocaleString()} contacts</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium">
                {campaignData.send_immediately ? 'Sending Immediately' : 'Scheduled'}
              </span>
            </div>
            {!campaignData.send_immediately && scheduleDate && scheduleTime && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Scheduled For:</span>
                <span className="font-medium">{scheduleDate} {scheduleTime}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSuccessModal(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => router.push('/dashboard/campaigns')}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              View Campaign Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={saveTemplateDialogOpen}
        onOpenChange={setSaveTemplateDialogOpen}
        subject={campaignData.email_subject}
        content={campaignData.html_content}
        campaignData={{
          sender_name: campaignData.sender_name,
          email_purpose: campaignData.email_purpose || '',
          language: campaignData.language || 'English',
          generate_for_all: campaignData.generate_for_all || false,
          use_contact_info: campaignData.use_contact_info !== false
        }}
        onSaved={() => loadTemplates()}
      />
    </div>
  )
}
