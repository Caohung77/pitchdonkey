'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiClient } from '@/lib/api-client'
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  User, 
  Building2, 
  Mail,
  Loader2,
  Sparkles,
  AlertCircle,
  Eye,
  Zap
} from 'lucide-react'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  company_name?: string
  enrichment_data?: any
}

interface ContactList {
  id: string
  name: string
  contacts: Contact[]
}

interface EmailPreview {
  subject: string
  htmlContent: string
  personalization?: {
    level: string
    score: number
    insights_used: string[]
    enrichment_available: boolean
  }
}

interface AIEmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  contactLists: ContactList[]
  campaignPurpose?: string
  senderName?: string
  signature?: string
}

export function AIEmailPreviewModal({ 
  isOpen, 
  onClose, 
  contactLists,
  campaignPurpose = 'Professional outreach',
  senderName = 'Team',
  signature = ''
}: AIEmailPreviewModalProps) {
  const [currentContactIndex, setCurrentContactIndex] = useState(0)
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewCache, setPreviewCache] = useState<Map<string, EmailPreview>>(new Map())
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, isGenerating: false })

  // Flatten all contacts from selected lists
  let allContacts = contactLists.flatMap(list => 
    list.contacts?.map(contact => ({ ...contact, listName: list.name })) || []
  )
  
  // Debug: Log contacts info
  console.log('🔍 AI Preview Debug:', {
    contactLists: contactLists.length,
    listsWithContacts: contactLists.filter(list => list.contacts && list.contacts.length > 0).length,
    totalContacts: allContacts.length,
    contactLists: contactLists
  })
  
  // Fallback: Create test contacts if no real contacts are available
  if (allContacts.length === 0 && contactLists.length > 0) {
    console.log('⚠️ No real contacts found, creating test contacts for preview')
    allContacts = contactLists.flatMap((list, index) => [
      {
        id: `test-contact-${index}-1`,
        first_name: 'John',
        last_name: 'Smith',
        email: 'john.smith@example.com',
        company_name: 'Acme Corp',
        listName: list.name
      },
      {
        id: `test-contact-${index}-2`, 
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah.johnson@techcorp.com',
        company_name: 'TechCorp Inc',
        listName: list.name
      },
      {
        id: `test-contact-${index}-3`,
        first_name: 'Michael',
        last_name: 'Brown',
        email: 'michael.brown@business.co',
        company_name: 'Business Solutions',
        listName: list.name
      }
    ]).slice(0, 5) // Max 5 test contacts
  }

  const currentContact = allContacts[currentContactIndex]


  // Generate AI email preview
  const generateEmailPreview = useCallback(async (contact: Contact & { listName?: string }, progressIndex?: number) => {
    if (!contact) return

    const cacheKey = `${contact.id}-${campaignPurpose}`
    
    // Check cache first
    if (previewCache.has(cacheKey)) {
      setEmailPreview(previewCache.get(cacheKey)!)
      if (progressIndex) {
        setGenerationProgress(prev => ({ ...prev, current: progressIndex }))
      }
      return
    }

    if (!progressIndex) {
      setLoading(true)
      setError(null)
    } else {
      setGenerationProgress(prev => ({ ...prev, current: progressIndex }))
    }

    try {
      const requestBody = {
        purpose: `${campaignPurpose}

RECIPIENT INFORMATION:
- Name: ${contact.first_name} ${contact.last_name}
- Company: ${contact.company_name || 'N/A'}  
- Email: ${contact.email}

Write a personalized outreach email TO this person (they are the recipient, not the sender). Use their name, company, and any available enrichment data about them and their business to create an authentic, professional email that addresses them directly.

The email should be FROM the campaign sender TO this recipient.`,
        language: 'English' as const,
        signature: signature || `Best regards,\n${senderName || 'Your Team'}`,
        contact_id: contact.id,
        tone: 'professional' as const,
        length: 'medium' as const,
        use_enrichment: true
      }

      console.log('🤖 Generating email preview for:', contact.first_name, contact.last_name, 'with contact_id:', contact.id)

      const response = await ApiClient.post('/api/ai/generate-outreach', requestBody)
      
      console.log('🤖 AI Response:', response)
      
      if (response.success || response.subject) {
            const preview: EmailPreview = {
              subject: response.subject || 'Personalized Outreach',
              htmlContent: sanitizeEmailHtml(response.htmlContent || response.html_content || ''),
              personalization: response.personalization
            }
        
        setEmailPreview(preview)
        
        // Cache the result
        setPreviewCache(prev => new Map(prev).set(cacheKey, preview))
        
        console.log('✅ Email preview generated successfully with personalization:', response.personalization?.level || 'none')
      } else {
        // Fallback: Generate simple email without enrichment data
        console.log('⚠️ Primary AI generation failed, trying fallback without enrichment')
        
        const fallbackRequestBody = {
          ...requestBody,
          use_enrichment: false,
          contact_id: undefined,
          purpose: `${campaignPurpose}

RECIPIENT INFORMATION:
- Name: ${contact.first_name} ${contact.last_name}
- Company: ${contact.company_name || 'N/A'}
- Email: ${contact.email}

Write a professional outreach email TO this person (they are the recipient). Address them personally using their name and company. Create a general but professional email that speaks directly to them as the recipient, not about them.

The email should be FROM the campaign sender TO this recipient.`
        }
        
        try {
          const fallbackResponse = await ApiClient.post('/api/ai/generate-outreach', fallbackRequestBody)
          
          if (fallbackResponse.success || fallbackResponse.subject) {
            const preview: EmailPreview = {
              subject: fallbackResponse.subject || 'Professional Outreach',
              htmlContent: sanitizeEmailHtml(fallbackResponse.htmlContent || fallbackResponse.html_content || ''),
              personalization: {
                level: 'basic',
                score: 30,
                insights_used: ['Contact Name', 'Company Name'],
                enrichment_available: false
              }
            }
            
            setEmailPreview(preview)
            setPreviewCache(prev => new Map(prev).set(cacheKey, preview))
            console.log('✅ Fallback email generated successfully')
          } else {
            throw new Error('Both primary and fallback AI generation failed')
          }
        } catch (fallbackError) {
          throw new Error(response.error || 'Failed to generate email preview')
        }
      }
    } catch (error: any) {
      console.error('❌ Error generating email preview:', error)
      setError(error.message || 'Failed to generate email preview')
    } finally {
      if (!progressIndex) {
        setLoading(false)
      }
    }
  }, [campaignPurpose, senderName, signature, previewCache])

  // Generate preview when contact changes
  useEffect(() => {
    if (currentContact && isOpen) {
      generateEmailPreview(currentContact)
    }
  }, [currentContact, isOpen, generateEmailPreview])

  // Reset when modal opens and start pre-generation
  useEffect(() => {
    if (isOpen && allContacts.length > 0) {
      setCurrentContactIndex(0)
      setError(null)
      
      // Start pre-generation
      const startPreGeneration = async () => {
        setGenerationProgress({ current: 0, total: allContacts.length, isGenerating: true })
        console.log(`🚀 Starting batch generation for ${allContacts.length} contacts`)
        
        for (let i = 0; i < allContacts.length; i++) {
          const contact = allContacts[i]
          const cacheKey = `${contact.id}-${campaignPurpose}`
          
          // Skip if already cached
          if (previewCache.has(cacheKey)) {
            setGenerationProgress(prev => ({ ...prev, current: i + 1 }))
            continue
          }
          
          try {
            await generateEmailPreview(contact, i + 1)
          } catch (error) {
            console.error(`Failed to generate email for ${contact.first_name} ${contact.last_name}:`, error)
          }
          
          // Small delay to prevent API overload
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        setGenerationProgress(prev => ({ ...prev, isGenerating: false }))
        console.log('✅ Batch generation completed')
      }
      
      startPreGeneration()
    }
  }, [isOpen]) // Remove dependencies that cause infinite loop

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'ArrowLeft') {
        handlePrevious()
      } else if (event.key === 'ArrowRight') {
        handleNext()
      } else if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentContactIndex, allContacts.length])

  const handlePrevious = () => {
    setCurrentContactIndex(prev => 
      prev > 0 ? prev - 1 : allContacts.length - 1
    )
  }

  const handleNext = () => {
    setCurrentContactIndex(prev => 
      prev < allContacts.length - 1 ? prev + 1 : 0
    )
  }

  const getPersonalizationColor = (level: string) => {
    switch (level) {
      case 'premium': return 'bg-purple-100 text-purple-800'
      case 'enriched': return 'bg-blue-100 text-blue-800'
      case 'basic': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPersonalizationLabel = (level: string) => {
    switch (level) {
      case 'premium': return 'Premium Personalization'
      case 'enriched': return 'Enriched Data'
      case 'basic': return 'Basic Personalization'
      default: return 'Standard'
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                AI Email Preview
              </DialogTitle>
              <DialogDescription>
                Preview AI-generated personalized emails for your campaign contacts
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress Bar - Only show when generating */}
          {generationProgress.isGenerating && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600 animate-pulse" />
                  <span className="text-sm font-medium text-blue-900">
                    Generating personalized emails...
                  </span>
                </div>
                <span className="text-sm text-blue-700">
                  {generationProgress.current} of {generationProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(generationProgress.current / generationProgress.total) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={allContacts.length <= 1 || generationProgress.isGenerating}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <div className="text-sm text-gray-600">
                Contact {currentContactIndex + 1} of {allContacts.length}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={allContacts.length <= 1 || generationProgress.isGenerating}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            
            {emailPreview?.personalization && !generationProgress.isGenerating && (
              <Badge 
                variant="secondary" 
                className={getPersonalizationColor(emailPreview.personalization.level)}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {getPersonalizationLabel(emailPreview.personalization.level)}
                {emailPreview.personalization.score > 0 && (
                  <span className="ml-1">({Math.round(emailPreview.personalization.score)}%)</span>
                )}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex h-full">
          {/* Contact Info Sidebar */}
          <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto">
            {currentContact && (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contact Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-medium">
                        {currentContact.first_name} {currentContact.last_name}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {currentContact.email}
                      </p>
                    </div>
                    
                    {currentContact.company_name && (
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3 text-gray-400" />
                        <span>{currentContact.company_name}</span>
                      </div>
                    )}
                    
                    {(currentContact as any).listName && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500">From list:</p>
                        <p className="text-sm font-medium">{(currentContact as any).listName}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Personalization Insights */}
                {emailPreview?.personalization && emailPreview.personalization.insights_used.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Personalization
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Used insights:</p>
                        <div className="flex flex-wrap gap-1">
                          {emailPreview.personalization.insights_used.map((insight, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {insight}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Email Preview Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Generating personalized email...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4">Failed to generate email preview</p>
                  <p className="text-sm text-gray-500 mb-4">{error}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => currentContact && generateEmailPreview(currentContact)}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {emailPreview && !loading && (
              <div className="space-y-6">
                {/* Email Subject */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Subject Line</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium break-words">{emailPreview.subject}</p>
                  </CardContent>
                </Card>

                {/* Email Content */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Email Content</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none email-content overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: emailPreview.htmlContent }}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {allContacts.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Mail className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No contacts available for preview</p>
                  <p className="text-sm text-gray-500 mb-4">
                    {contactLists.length === 0 
                      ? "Go back to Step 1 and select contact lists first" 
                      : "Selected contact lists don't have contacts loaded yet"}
                  </p>
                  <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded">
                    Debug: {contactLists.length} lists, {allContacts.length} contacts
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
import { sanitizeEmailHtml } from '@/lib/email-sanitize'
