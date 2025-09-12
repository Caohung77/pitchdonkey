'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiClient } from '@/lib/api-client'
import { 
  Eye, 
  Code, 
  Type,
  Sparkles,
  User,
  Building2,
  Mail,
  Loader2,
  AlertCircle,
  ChevronDown,
  Monitor,
  Smartphone,
  Users,
  CheckCircle,
  Database,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react'
import { Save } from 'lucide-react'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import type { AITemplate } from '@/lib/ai-templates'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  company_name?: string
  company?: string
  enrichment_data?: any
}

interface ContactList {
  id: string
  name: string
  contacts?: Contact[]
}

interface UnifiedEmailContentEditorProps {
  subject: string
  htmlContent: string
  onSubjectChange: (subject: string) => void
  onContentChange: (content: string) => void
  contactLists?: ContactList[]
  onPersonalizedEmailsChange?: (emails: Map<string, { subject: string; content: string }>) => void
}

export function UnifiedEmailContentEditor({ 
  subject, 
  htmlContent, 
  onSubjectChange, 
  onContentChange,
  contactLists = [],
  onPersonalizedEmailsChange
}: UnifiedEmailContentEditorProps) {
  const [selectedContactIndex, setSelectedContactIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [personalizationInfo, setPersonalizationInfo] = useState<string[]>([])
  const [generateForAll, setGenerateForAll] = useState(false)
  const [useContactInfo, setUseContactInfo] = useState(true)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, isRunning: false })
  const [generatedEmails, setGeneratedEmails] = useState<Map<string, { subject: string; content: string }>>(new Map())
  const [emailPurpose, setEmailPurpose] = useState('')
  const [language, setLanguage] = useState<'English' | 'German'>('English')
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [templates, setTemplates] = useState<AITemplate[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  // Personalized Reason state
  const [isGeneratingReason, setIsGeneratingReason] = useState(false)
  const [reasonLength, setReasonLength] = useState<'short' | 'medium' | 'detailed'>('medium')
  const [generatedReasons, setGeneratedReasons] = useState<Map<string, string>>(new Map())
  const [reasonError, setReasonError] = useState<string | null>(null)

  // Notify parent component when generated emails change
  useEffect(() => {
    if (onPersonalizedEmailsChange && generatedEmails.size > 0) {
      onPersonalizedEmailsChange(generatedEmails)
    }
  }, [generatedEmails, onPersonalizedEmailsChange])


  // Flatten all contacts from selected lists
  const allContacts = contactLists.flatMap(list => 
    list.contacts?.map(contact => ({ ...contact, listName: list.name })) || []
  )

  // Add fallback test contacts if no real contacts
  const contacts = allContacts.length > 0 ? allContacts : [
    {
      id: 'test-1',
      first_name: 'John',
      last_name: 'Smith',
      email: 'john.smith@acme.com',
      company_name: 'Acme Corp',
      listName: 'Test Contacts'
    },
    {
      id: 'test-2', 
      first_name: 'Sarah',
      last_name: 'Johnson',
      email: 'sarah.johnson@techcorp.com',
      company_name: 'TechCorp Inc',
      listName: 'Test Contacts'
    }
  ]

  // Debug: Log contact loading info
  console.log('🔍 UnifiedEmailContentEditor Debug:', {
    contactListsCount: contactLists.length,
    allContactsCount: allContacts.length,
    finalContactsCount: contacts.length,
    sampleContact: contacts[0] ? {
      name: `${contacts[0].first_name} ${contacts[0].last_name}`,
      email: contacts[0].email,
      company: contacts[0].company_name,
      hasCompany: !!contacts[0].company_name
    } : null
  })

  const selectedContact = contacts[selectedContactIndex]

  // Store callback refs to avoid dependency issues
  const onSubjectChangeRef = useRef(onSubjectChange)
  const onContentChangeRef = useRef(onContentChange)
  
  // Update refs when callbacks change
  useEffect(() => {
    onSubjectChangeRef.current = onSubjectChange
    onContentChangeRef.current = onContentChange
  }, [onSubjectChange, onContentChange])

  // Track current values to prevent infinite loops
  const currentSubjectRef = useRef(subject)
  const currentContentRef = useRef(htmlContent)
  
  // Update refs when props change
  useEffect(() => {
    currentSubjectRef.current = subject
    currentContentRef.current = htmlContent
  }, [subject, htmlContent])

  // Update main content when switching contacts - only if content actually changed
  useEffect(() => {
    // Don't update main editor during batch generation to prevent infinite loops
    if (batchProgress.isRunning) {
      return
    }
    
    if (selectedContact && generatedEmails.has(selectedContact.id)) {
      const generatedEmail = generatedEmails.get(selectedContact.id)!
      
      // Only update if the content is actually different to prevent infinite loops
      const subjectChanged = generatedEmail.subject !== currentSubjectRef.current
      const contentChanged = generatedEmail.content !== currentContentRef.current
      
      if (subjectChanged || contentChanged) {
        console.log('🔄 Switching to contact with different generated content:', {
          contactName: `${selectedContact.first_name} ${selectedContact.last_name}`,
          subjectChanged,
          contentChanged,
          newSubject: generatedEmail.subject,
          newContentLength: generatedEmail.content.length
        })
        
        if (subjectChanged) {
          onSubjectChangeRef.current(generatedEmail.subject)
        }
        if (contentChanged) {
          onContentChangeRef.current(generatedEmail.content)
        }
      }
    }
  }, [selectedContact, generatedEmails, batchProgress.isRunning])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown) {
        setShowDropdown(false)
      }
    }
    
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDropdown])

  // Load saved templates
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
  useEffect(() => { loadTemplates() }, [])

  // Smart activation logic for personalized reason button
  const isReasonButtonEnabled = () => {
    return emailPurpose.trim() !== '' && 
           htmlContent.includes('((personalised reason))')
  }

  // Handle personalized reason generation
  const handleGenerateReason = async () => {
    if (!selectedContact) return
    
    if (generateForAll) {
      await handleBatchReasonGeneration()
    } else {
      await generateReasonForContact(selectedContact)
    }
  }

  // Generate reason for single contact
  const generateReasonForContact = async (contact: Contact & { listName?: string }) => {
    setIsGeneratingReason(true)
    setReasonError(null)
    
    try {
      console.log('🧠 Generating personalized reason for:', contact.first_name, contact.last_name)
      
      const response = await ApiClient.post('/api/ai/generate-reason', {
        purpose: emailPurpose,
        contact_id: useContactInfo ? contact.id : undefined,
        length: reasonLength,
        use_contact_info: useContactInfo,
        language: language
      })
      
      console.log('📡 API Response:', {
        success: response.success,
        hasData: !!response.data,
        hasReason: !!response.data?.reason,
        error: response.error || 'none',
        message: response.message || 'none',
        fullResponse: response
      })
      
      if (response.success && response.data?.reason) {
        const reason = response.data.reason
        
        // Store generated reason for this contact
        setGeneratedReasons(prev => {
          const newReasons = new Map(prev)
          newReasons.set(contact.id, reason)
          return newReasons
        })
        
        // Only update the content if generating for single contact (not during batch)
        if (!generateForAll) {
          updateContentWithReason(reason)
        }
        
        console.log('✅ Generated reason:', {
          contactId: contact.id,
          contactName: `${contact.first_name} ${contact.last_name}`,
          length: reasonLength,
          wordCount: response.data.word_count,
          preview: reason.substring(0, 100) + '...',
          totalReasonsStored: generatedReasons.size + 1
        })
      } else {
        const errorMessage = response.error || response.message || 'API returned unsuccessful response'
        console.error('❌ API Error Details:', {
          success: response.success,
          error: response.error,
          message: response.message,
          data: response.data
        })
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('❌ Reason generation failed:', error)
      setReasonError('Failed to generate personalized reason. Please try again.')
    } finally {
      setIsGeneratingReason(false)
    }
  }

  // Generate reasons for all contacts
  const handleBatchReasonGeneration = async () => {
    if (contacts.length === 0) return
    
    setIsGeneratingReason(true)
    setReasonError(null)
    setBatchProgress({ current: 0, total: contacts.length, isRunning: true })
    
    try {
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        setBatchProgress(prev => ({ ...prev, current: i + 1 }))
        
        try {
          await generateReasonForContact(contact)
          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`Failed to generate reason for ${contact.first_name}:`, error)
        }
      }
    } catch (error) {
      setReasonError('Batch reason generation failed. Some reasons may not have been generated.')
    } finally {
      setIsGeneratingReason(false)
      setBatchProgress({ current: 0, total: 0, isRunning: false })
    }
  }

  // Update content with generated reason (for preview purposes)
  const updateContentWithReason = (reason: string) => {
    if (!htmlContent.includes('((personalised reason))')) return
    
    const updatedContent = htmlContent.replace('((personalised reason))', reason)
    onContentChange(updatedContent)
  }

  const handleGenerateAI = async () => {
    if (!selectedContact) return

    if (generateForAll) {
      // Generate for all contacts
      await handleBatchGeneration()
    } else {
      // Generate for single contact
      await generateForContact(selectedContact)
    }
  }

  const generateForContact = async (contact: Contact & { listName?: string }) => {
    setIsGeneratingAI(true)
    setAiError(null)
    
    // Debug contact data
    console.log('🔍 generateForContact called with:', {
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      company_name: contact.company_name,
      useContactInfo,
      hasEnrichmentData: !!contact.enrichment_data
    })
    
    try {
      const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim()
      const displayName = contactName || 'there'
      const companyName = contact.company_name || contact.company || 'your company'
      
      const purposeText = emailPurpose.trim() || 'Professional outreach email'
      
      const purposeForAI = useContactInfo
        ? `${purposeText}

RECIPIENT INFORMATION:
- Name: ${displayName}
- Company: ${companyName}  
- Email: ${contact.email}

Write a personalized outreach email TO this person (they are the recipient). Use their name, company, and create an authentic, professional email that addresses them directly.`
        : `${purposeText}

IMPORTANT: No contact info is provided. You MUST use placeholders only and NOT invent real data. Use these placeholders naturally in subject and content: {{first_name}}, {{last_name}}, {{company}}, {{company_name}}, {{website}}, {{email}}, {{sender_name}}. Begin with a greeting that includes {{first_name}} and avoid appending real surnames; use {{last_name}} when a surname is referenced.`

      const requestBody = {
        purpose: purposeForAI,
        language: language,
        signature: `Best regards,\nYour Team`,
        contact_id: useContactInfo ? contact.id : undefined,
        tone: 'professional' as const,
        length: 'medium' as const,
        use_enrichment: useContactInfo
      }

      const response = await ApiClient.post('/api/ai/generate-outreach', requestBody)
      
      console.log('🔍 Full API Response:', {
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        subject: response.data?.subject || 'none',
        hasHtmlContent: !!response.data?.htmlContent
      })
      
      if (response.success && response.data) {
        const { subject, htmlContent } = response.data
        
        // Always update main content for single contact generation, but not during batch generation
        if (!generateForAll && !batchProgress.isRunning) {
          onSubjectChange(subject || 'Professional Outreach')
          onContentChange(htmlContent || '')
          console.log('✅ Updated main editor with generated content:', {
            subject: subject,
            hasContent: !!htmlContent,
            contentLength: htmlContent?.length || 0
          })
        }
        
        // Store generated email for this contact
        setGeneratedEmails(prev => {
          const newEmails = new Map(prev).set(contact.id, {
            subject: subject || 'Professional Outreach',
            content: htmlContent || ''
          })
          return newEmails
        })
        
        // Set personalization info
        const insights = response.data?.personalization?.insights_used || ['Contact Name', 'Company Name']
        setPersonalizationInfo(insights)

        return {
          subject: subject || 'Professional Outreach',
          content: htmlContent || ''
        }
      } else {
        // Fallback generation
        const fallbackRequestBody = {
          ...requestBody,
          use_enrichment: false,
          contact_id: undefined
        }
        
        const fallbackResponse = await ApiClient.post('/api/ai/generate-outreach', fallbackRequestBody)
        
        if (fallbackResponse.success && fallbackResponse.data) {
          const { subject: fallbackSubject, htmlContent: fallbackContent } = fallbackResponse.data
          const safeSubject = fallbackSubject || 'Professional Outreach'
          const safeContent = fallbackContent || ''
          
          if (!generateForAll && !batchProgress.isRunning) {
            onSubjectChange(safeSubject)
            onContentChange(safeContent)
            console.log('✅ Updated main editor with fallback content:', {
              subject: safeSubject,
              hasContent: !!safeContent,
              contentLength: safeContent.length
            })
          }
          
          setGeneratedEmails(prev => {
            const newEmails = new Map(prev).set(contact.id, {
              subject: safeSubject,
              content: safeContent
            })
            return newEmails
          })
          
          setPersonalizationInfo(['Contact Name', 'Company Name'])
          
          return {
            subject: safeSubject,
            content: safeContent
          }
        } else {
          throw new Error('Failed to generate email content')
        }
      }
    } catch (error: any) {
      console.error('Error generating AI content:', error)
      if (!generateForAll) {
        setAiError(error.message || 'Failed to generate email content')
      }
      throw error
    } finally {
      if (!generateForAll) {
        setIsGeneratingAI(false)
      }
    }
  }

  const handleBatchGeneration = async () => {
    const contactsToProcess = contacts.slice(0, 50) // Limit to 50 contacts to avoid API overload
    
    setBatchProgress({ current: 0, total: contactsToProcess.length, isRunning: true })
    setIsGeneratingAI(true)
    setAiError(null)

    let firstGeneratedEmail: { subject: string; content: string } | null = null

    try {
      for (let i = 0; i < contactsToProcess.length; i++) {
        const contact = contactsToProcess[i]
        
        try {
          const result = await generateForContact(contact)
          
          // Store the first successful result to update the main editor
          if (i === 0 && result) {
            firstGeneratedEmail = result
          }
          
          setBatchProgress(prev => ({ ...prev, current: i + 1 }))
          
          // Add delay to prevent API rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`Failed to generate email for ${contact.first_name} ${contact.last_name}:`, error)
          // Continue with next contact even if one fails
        }
      }

      console.log(`✅ Batch generation completed for ${contactsToProcess.length} contacts`)
    } catch (error: any) {
      console.error('Batch generation error:', error)
      setAiError(`Batch generation failed: ${error.message}`)
    } finally {
      // Update batch progress to indicate completion
      setBatchProgress({ current: 0, total: 0, isRunning: false })
      
      // After batch generation is complete, update the main editor with first generated email
      // This happens after isRunning is set to false, so the useEffect can run
      if (firstGeneratedEmail) {
        // Small delay to ensure state has updated
        setTimeout(() => {
          onSubjectChange(firstGeneratedEmail.subject)
          onContentChange(firstGeneratedEmail.content)
          console.log('✅ Updated main editor with first generated email after batch completion')
        }, 100)
      }
      
      setIsGeneratingAI(false)
    }
  }

  const insertTemplate = (template: string) => {
    const templates = {
      basic: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Hello &#123;&#123;first_name&#125;&#125;,</h1>
          
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
            &#123;&#123;sender_name&#125;&#125;
          </p>
        </div>
      `,
      professional: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 30px;">
          <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="border-left: 4px solid #007bff; padding-left: 20px; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; font-size: 28px; margin: 0;">Hello &#123;&#123;first_name&#125;&#125;,</h1>
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
                <strong>&#123;&#123;sender_name&#125;&#125;</strong><br>
                &#123;&#123;company_name&#125;&#125;
              </p>
            </div>
          </div>
        </div>
      `
    }
    onContentChange(templates[template as keyof typeof templates])
  }

  const insertVariable = (variable: string) => {
    const variables = {
      first_name: '{{first_name}}',
      last_name: '{{last_name}}',
      email: '{{email}}',
      company: '{{company}}',
      sender_name: '{{sender_name}}',
      company_name: '{{company_name}}',
      website: '{{website}}'
    }
    
    const newContent = htmlContent + ' ' + variables[variable as keyof typeof variables] + ' '
    onContentChange(newContent)
  }

  const renderPreviewContent = () => {
    if (!selectedContact) return htmlContent

    // Check if we have a generated email for this contact
    const generatedEmail = generatedEmails.get(selectedContact.id)
    const contentToUse = generatedEmail?.content || htmlContent

    // Replace variables with actual contact data
    let previewContent = contentToUse
    
    // English placeholders  
    previewContent = previewContent.replace(/\{\{first_name\}\}/g, selectedContact.first_name)
    previewContent = previewContent.replace(/\{\{last_name\}\}/g, selectedContact.last_name)
    previewContent = previewContent.replace(/\{\{company\}\}/g, selectedContact.company_name || selectedContact.company || '')
    previewContent = previewContent.replace(/\{\{company_name\}\}/g, selectedContact.company_name || selectedContact.company || '')
    previewContent = previewContent.replace(/\{\{email\}\}/g, selectedContact.email)
    previewContent = previewContent.replace(/\{\{sender_name\}\}/g, 'Your Team')
    previewContent = previewContent.replace(/\{\{website\}\}/g, selectedContact.website || '')
    
    // Support existing German placeholders in content (but don't add new UI for them)
    previewContent = previewContent.replace(/\{\{Nachname\}\}/g, selectedContact.last_name)
    previewContent = previewContent.replace(/\{\{Vorname\}\}/g, selectedContact.first_name)
    
    // Replace personalized reason placeholder if we have a generated reason for this contact
    const generatedReason = generatedReasons.get(selectedContact.id)
    console.log('🔍 Preview Debug:', {
      contactId: selectedContact.id,
      contactName: `${selectedContact.first_name} ${selectedContact.last_name}`,
      hasGeneratedReason: !!generatedReason,
      reasonPreview: generatedReason ? generatedReason.substring(0, 50) + '...' : 'none',
      totalStoredReasons: generatedReasons.size,
      allStoredContactIds: Array.from(generatedReasons.keys())
    })
    
    if (generatedReason) {
      previewContent = previewContent.replace(/\(\(personalised reason\)\)/g, generatedReason)
    } else {
      // Show placeholder text if no reason generated yet
      previewContent = previewContent.replace(/\(\(personalised reason\)\)/g, '<em style="color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">((personalised reason - click "Personalised Reason" button to generate))</em>')
    }

    // Sanitize to prevent global styles from leaking and breaking layout
    return sanitizeEmailHtml(previewContent)
  }

  const renderPreviewSubject = () => {
    if (!selectedContact) return subject

    // Check if we have a generated email for this contact
    const generatedEmail = generatedEmails.get(selectedContact.id)
    const subjectToUse = generatedEmail?.subject || subject

    let previewSubject = subjectToUse
    
    // English placeholders
    previewSubject = previewSubject.replace(/\{\{first_name\}\}/g, selectedContact.first_name)
    previewSubject = previewSubject.replace(/\{\{last_name\}\}/g, selectedContact.last_name)
    previewSubject = previewSubject.replace(/\{\{company\}\}/g, selectedContact.company_name || selectedContact.company || '')
    previewSubject = previewSubject.replace(/\{\{company_name\}\}/g, selectedContact.company_name || selectedContact.company || '')
    previewSubject = previewSubject.replace(/\{\{website\}\}/g, selectedContact.website || '')
    
    // Support existing German placeholders in content (but don't add new UI for them)
    previewSubject = previewSubject.replace(/\{\{Nachname\}\}/g, selectedContact.last_name)
    previewSubject = previewSubject.replace(/\{\{Vorname\}\}/g, selectedContact.first_name)

    return previewSubject
  }

  return (
    <div className="w-full max-w-full space-y-6 overflow-hidden" style={{ minWidth: 0, maxWidth: '100%' }}>
      {/* Contact Navigation Header */}
      <Card className="border-l-4 border-l-blue-500 max-w-full overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name}` : 'No Contact Selected'}
                  </h2>
                  <div className="flex items-center space-x-4 mt-2">
                    {selectedContact && (
                      <>
                        <div className="flex items-center space-x-2 text-gray-600">
                          <Mail className="h-4 w-4" />
                          <span className="text-sm">{selectedContact.email}</span>
                        </div>
                        {selectedContact.company_name && (
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Building2 className="h-4 w-4" />
                            <span className="text-sm">{selectedContact.company_name}</span>
                          </div>
                        )}
                        {generatedEmails.has(selectedContact.id) && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI Generated
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Removed AI button from header - moved to better location below */}
          </div>
          
          {/* Contact Navigation Controls */}
          <div className="flex items-center justify-between mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContactIndex(Math.max(0, selectedContactIndex - 1))}
                disabled={selectedContactIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="min-w-[200px] max-w-[250px] justify-between truncate"
                >
                  <span className="truncate">
                    Contact {selectedContactIndex + 1} of {contacts.length}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
                
                {showDropdown && (
                  <div className="absolute top-full mt-1 w-80 max-w-xs bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-hidden">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {contacts
                        .map((contact, index) => ({ contact, index }))
                        .filter(({ contact }) => 
                          searchTerm === '' || 
                          `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          contact.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(({ contact, index }) => (
                          <button
                            key={contact.id}
                            onClick={() => {
                              setSelectedContactIndex(index)
                              setShowDropdown(false)
                              setSearchTerm('')
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center space-x-3 ${
                              index === selectedContactIndex ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                            }`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {contact.first_name} {contact.last_name}
                              </div>
                              <div className="text-xs text-gray-500">{contact.email}</div>
                              {contact.company_name && (
                                <div className="text-xs text-gray-400">{contact.company_name}</div>
                              )}
                            </div>
                            {generatedEmails.has(contact.id) && (
                              <Sparkles className="h-3 w-3 text-green-600" />
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContactIndex(Math.min(contacts.length - 1, selectedContactIndex + 1))}
                disabled={selectedContactIndex === contacts.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <div className="space-y-4">

        {/* Email Purpose Input - Enhanced */}
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg space-y-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <label className="block text-sm font-medium text-blue-900">Email Purpose *</label>
            {emailPurpose.trim() && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            )}
          </div>
          <textarea
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm transition-colors ${
              emailPurpose.trim() 
                ? 'border-green-300 focus:ring-green-500 bg-green-50' 
                : 'border-blue-200 focus:ring-blue-500'
            }`}
            rows={2}
            placeholder="e.g., Introduce our new product that could help streamline their business processes"
            value={emailPurpose}
            onChange={(e) => setEmailPurpose(e.target.value)}
          />
          <p className="text-xs text-blue-700">
            <strong>Required:</strong> Describe the purpose of your outreach. AI will use this along with contact information to create personalized emails.
          </p>
        </div>

        {/* Streamlined AI Options & Personalise Button */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between gap-6">
            {/* Left side: Grouped options */}
            <div className="flex items-center gap-6">
              {/* Language Selection - Compact */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Language:</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'English' | 'German')}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[90px]"
                >
                  <option value="English">English</option>
                  <option value="German">German</option>
                </select>
              </div>

              {/* Generate for All Contacts */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="generateForAll"
                  checked={generateForAll}
                  onChange={(e) => setGenerateForAll(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="generateForAll" className="flex items-center text-sm font-medium text-gray-700">
                  <Users className="h-4 w-4 mr-1" />
                  Generate for All
                </label>
              </div>

              {/* Use Contact Information */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useContactInfo"
                  checked={useContactInfo}
                  onChange={(e) => setUseContactInfo(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="useContactInfo" className="flex items-center text-sm font-medium text-gray-700">
                  <Database className="h-4 w-4 mr-1" />
                  Use Contact Info
                </label>
              </div>

              {/* Generation Status */}
              {generatedEmails.size > 0 && (
                <div className="flex items-center text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {generatedEmails.size} emails generated
                </div>
              )}
            </div>

            {/* Right side: Personalise Buttons */}
            <div className="flex items-center space-x-3">
              {/* Personalized Reason Button with Length Dropdown */}
              <div className="flex items-center space-x-2">
                {/* Length Selector */}
                <select
                  value={reasonLength}
                  onChange={(e) => setReasonLength(e.target.value as 'short' | 'medium' | 'detailed')}
                  disabled={!isReasonButtonEnabled()}
                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reason length: Short (~2 sentences), Medium (~4 sentences), Detailed (6+ sentences)"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="detailed">Detailed</option>
                </select>
                
                {/* Personalized Reason Button */}
                <Button
                  onClick={handleGenerateReason}
                  disabled={!isReasonButtonEnabled() || isGeneratingReason || !selectedContact}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium whitespace-nowrap"
                  title={!isReasonButtonEnabled() ? "Enable by entering Email Purpose and adding ((personalised reason)) placeholder to content" : "Generate personalized connection reason"}
                >
                  {isGeneratingReason ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {generateForAll ? `Reasoning (${batchProgress.current}/${batchProgress.total})` : 'Reasoning...'}
                    </>
                  ) : (
                    <>
                      <Type className="h-4 w-4 mr-2" />
                      {generateForAll ? `Reason All (${contacts.length})` : 'Personalised Reason'}
                    </>
                  )}
                </Button>
              </div>

              {/* Main Personalise Email Button */}
              <Button
                onClick={handleGenerateAI}
                disabled={isGeneratingAI || !selectedContact || !emailPurpose.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 text-sm font-medium whitespace-nowrap"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {generateForAll ? `Personalising (${batchProgress.current}/${batchProgress.total})` : 'Personalising...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generateForAll ? `Personalise All (${contacts.length})` : 'Personalise Email(s)'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Batch Progress */}
        {batchProgress.isRunning && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Generating personalized emails...
                </span>
              </div>
              <span className="text-sm text-blue-700">
                {batchProgress.current} of {batchProgress.total}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(batchProgress.current / batchProgress.total) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* AI Error Display */}
      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
            <p className="text-red-600 text-sm">{aiError}</p>
          </div>
        </div>
      )}

      {/* Reason Error Display */}
      {reasonError && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-orange-600 mr-2" />
            <p className="text-orange-600 text-sm">{reasonError}</p>
          </div>
        </div>
      )}

      {/* Personalization Info */}
      {personalizationInfo.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex items-center flex-wrap gap-2">
            <Sparkles className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-800 font-medium">AI Personalization:</span>
            {personalizationInfo.map((info, index) => (
              <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800">
                {info}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area - Vertical Layout */}
      <div className="space-y-6">
        {/* Content Type Indicator */}
        {selectedContact && generatedEmails.has(selectedContact.id) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Editing personalized content for {selectedContact.first_name} {selectedContact.last_name}
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Changes will only affect this contact's email. Switch to a different contact or turn off "Use Contact Info" to edit the base template.
            </p>
          </div>
        )}

        {/* Email Content Editor */}
        <Card className="max-w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Type className="h-5 w-5 mr-2" />
              Email Content
              {selectedContact && generatedEmails.has(selectedContact.id) && (
                <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Personalized
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-full overflow-hidden">
              {/* Subject Line */}
              <div>
                <label className="block text-sm font-medium mb-2">Email Subject *</label>
                <input
                  type="text"
                  className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Quick question about {{company}}"
                  value={(() => {
                    // Show personalized subject for selected contact if available
                    if (selectedContact && generatedEmails.has(selectedContact.id)) {
                      const generatedEmail = generatedEmails.get(selectedContact.id)!
                      return generatedEmail.subject || subject
                    }
                    return subject
                  })()}
                  onChange={(e) => {
                    const newSubject = e.target.value
                    
                    // If we have a selected contact with generated content, update their personalized version
                    if (selectedContact && generatedEmails.has(selectedContact.id)) {
                      setGeneratedEmails(prev => {
                        const newEmails = new Map(prev)
                        const existingEmail = newEmails.get(selectedContact.id)!
                        newEmails.set(selectedContact.id, {
                          ...existingEmail,
                          subject: newSubject
                        })
                        return newEmails
                      })
                    } else {
                      // Update the base template
                      onSubjectChange(newSubject)
                    }
                  }}
                />
              </div>

              {/* Quick Templates */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Quick Templates</h4>
                  <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} className="flex items-center">
                    <Save className="h-4 w-4 mr-1" /> Save as Template
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => insertTemplate('basic')}>
                    Basic Template
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => insertTemplate('professional')}>
                    Professional
                  </Button>
                  {templates.map((tpl) => (
                    <Button key={tpl.id} variant="outline" size="sm" onClick={() => {
                      if ((tpl as any).subject) onSubjectChange((tpl as any).subject)
                      onContentChange(tpl.content)
                    }}>
                      {tpl.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Variables */}
              <div className="border-b pb-4">
                <h4 className="font-medium mb-3">Variables</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-blue-100"
                    onClick={() => insertVariable('first_name')}
                  >
                    {"{{first_name}}"}
                  </Badge>
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-blue-100"
                    onClick={() => insertVariable('last_name')}
                  >
                    {"{{last_name}}"}
                  </Badge>
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-blue-100"
                    onClick={() => insertVariable('company')}
                  >
                    {"{{company}}"}
                  </Badge>
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-blue-100"
                    onClick={() => insertVariable('sender_name')}
                  >
                    {"{{sender_name}}"}
                  </Badge>
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-blue-100"
                    onClick={() => insertVariable('website')}
                  >
                    {"{{website}}"}
                  </Badge>
                </div>
              </div>

              {/* Content Editor */}
              <div>
                <label className="block text-sm font-medium mb-2">Email Content *</label>
                <textarea
                  className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
                  rows={12}
                  placeholder="Start typing your HTML email content here, or use a template above..."
                  value={(() => {
                    // Show personalized content for selected contact if available
                    if (selectedContact && generatedEmails.has(selectedContact.id)) {
                      const generatedEmail = generatedEmails.get(selectedContact.id)!
                      return generatedEmail.content || htmlContent
                    }
                    return htmlContent
                  })()}
                  onChange={(e) => {
                    const newContent = e.target.value
                    
                    // If we have a selected contact with generated content, update their personalized version
                    if (selectedContact && generatedEmails.has(selectedContact.id)) {
                      setGeneratedEmails(prev => {
                        const newEmails = new Map(prev)
                        const existingEmail = newEmails.get(selectedContact.id)!
                        newEmails.set(selectedContact.id, {
                          ...existingEmail,
                          content: newContent
                        })
                        return newEmails
                      })
                    } else {
                      // Update the base template
                      onContentChange(newContent)
                    }
                  }}
                />
              </div>
          </CardContent>
        </Card>
        
        {/* Live Preview */}
        <Card className="max-w-full overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Live Preview
                </CardTitle>
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={viewMode === 'desktop' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('desktop')}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'mobile' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('mobile')}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Contact Info */}
              {selectedContact && (
                <div className="bg-gray-50 p-3 rounded-md mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-600" />
                      <span className="font-medium">{selectedContact.first_name} {selectedContact.last_name}</span>
                    </div>
                    {generatedEmails.has(selectedContact.id) && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Generated
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-600">{selectedContact.email}</span>
                  </div>
                  {selectedContact.company_name && (
                    <div className="flex items-center space-x-2 mt-1">
                      <Building2 className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-600">{selectedContact.company_name}</span>
                    </div>
                  )}
                  {(selectedContact as any).listName && (
                    <div className="text-xs text-gray-500 mt-2">
                      From: {(selectedContact as any).listName}
                    </div>
                  )}
                </div>
              )}

              {/* Email Preview */}
              <div className={`border rounded-md p-4 bg-white max-w-full overflow-hidden ${viewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'}`}>
                {/* Subject Preview */}
                <div className="border-b pb-2 mb-4">
                  <p className="font-medium text-sm break-words">Subject: {renderPreviewSubject()}</p>
                </div>

                {/* Content Preview */}
              <div 
                className="prose prose-sm max-w-full overflow-auto break-words email-content"
                style={{ maxHeight: '500px', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: renderPreviewContent() }}
              />
              </div>
            </CardContent>
          </Card>
      </div>
      <SaveTemplateDialog
        open={saveDialogOpen}
        onOpenChange={(o) => setSaveDialogOpen(o)}
        subject={subject}
        content={htmlContent}
        onSaved={() => loadTemplates()}
      />
    </div>
  )
}
  import { sanitizeEmailHtml } from '@/lib/email-sanitize'
