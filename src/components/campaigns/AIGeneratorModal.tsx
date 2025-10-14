'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles,
  User,
  X,
  Loader2,
  Brain,
  Target,
  BarChart3,
  Info,
  Settings,
  Zap,
  Building2,
  Globe
} from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface AIGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerated: (subject: string, htmlContent: string) => void
  contactLists?: Array<{
    id: string
    name: string
    contacts?: Array<{
      id: string
      first_name: string
      last_name: string
      company_name: string
      email: string
      enrichment_data?: any
      enrichment_status?: string
    }>
  }>
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  company_name: string
  email: string
  enrichment_data?: any
  enrichment_status?: string
}

export function AIGeneratorModal({ isOpen, onClose, onGenerated, contactLists = [] }: AIGeneratorModalProps) {
  const [purpose, setPurpose] = useState('')
  const [language, setLanguage] = useState<'English' | 'German'>('English')
  const [signature, setSignature] = useState('')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Enhanced settings
  const [tone, setTone] = useState<'professional' | 'casual' | 'warm' | 'direct'>('professional')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [useEnrichment, setUseEnrichment] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Enrichment preview state
  const [enrichmentPreview, setEnrichmentPreview] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  
  // Get all contacts from contact lists
  const availableContacts: Contact[] = contactLists.flatMap(list => list.contacts || [])

  // Set default contact if available
  useEffect(() => {
    if (availableContacts.length > 0 && !selectedContactId) {
      setSelectedContactId(availableContacts[0].id)
    }
  }, [availableContacts, selectedContactId])

  // Load enrichment preview when contact changes
  useEffect(() => {
    if (selectedContactId && useEnrichment) {
      loadEnrichmentPreview()
    }
  }, [selectedContactId, useEnrichment])

  const loadEnrichmentPreview = async () => {
    if (!selectedContactId) return
    
    setLoadingPreview(true)
    try {
      // Get the selected contact
      const selectedContact = availableContacts.find(c => c.id === selectedContactId)
      if (!selectedContact) return

      // Create preview from available data
      const preview = {
        contact: selectedContact,
        hasEnrichment: selectedContact.enrichment_status === 'completed' && selectedContact.enrichment_data,
        enrichmentData: selectedContact.enrichment_data,
        estimatedScore: calculateEstimatedScore(selectedContact)
      }
      
      setEnrichmentPreview(preview)
    } catch (error) {
      console.error('Error loading enrichment preview:', error)
    } finally {
      setLoadingPreview(false)
    }
  }

  const calculateEstimatedScore = (contact: Contact): number => {
    let score = 0
    if (contact.first_name) score += 15
    if (contact.company_name) score += 15
    if (contact.enrichment_data?.industry) score += 15
    if (contact.enrichment_data?.products_services?.length) score += 20
    if (contact.enrichment_data?.target_audience?.length) score += 20
    if (contact.enrichment_data?.unique_points?.length) score += 15
    return Math.min(score, 100)
  }

  const handleClose = () => {
    if (!isGenerating) {
      onClose()
    }
  }

  const handleGenerateEmail = async () => {
    if (!purpose.trim() || !signature.trim()) {
      alert('Please fill in both purpose and signature fields')
      return
    }

    setIsGenerating(true)
    try {
      // Build enhanced request data
      const requestData: any = {
        purpose,
        language,
        signature,
        tone,
        length,
        use_enrichment: useEnrichment
      }
      
      if (selectedContactId && useEnrichment) {
        requestData.contact_id = selectedContactId
      }

      console.log('🚀 Generating with enhanced settings:', {
        tone,
        length,
        useEnrichment,
        hasContact: !!selectedContactId
      })

      const response = await ApiClient.post('/api/ai/generate-outreach', requestData)

      if (response.success && response.data) {
        // Pass generated content back to parent
        onGenerated(response.data.subject, response.data.htmlContent)
        
        // Show success with personalization details
        if (response.data.personalization) {
          const { level, score, insights_used } = response.data.personalization
          const insightsText = insights_used?.length ? ` (Used: ${insights_used.join(', ')})` : ''
          alert(`Email generated successfully! 
          
Personalization: ${level.toUpperCase()} (${score}% score)${insightsText}
          
Subject and content have been populated.`)
        } else {
          alert('Email generated successfully! Subject and content have been populated.')
        }
        
        // Reset form
        setPurpose('')
        setSignature('')
        
        // Close modal
        onClose()
      } else {
        throw new Error('Failed to generate email content')
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      alert(`Failed to generate email: ${error.message || 'Please try again.'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Brain className="h-5 w-5 mr-2 text-blue-600" />
              <CardTitle className="text-blue-900">Enhanced AI Email Generator</CardTitle>
              <Badge variant="secondary" className="ml-2">
                <Zap className="h-3 w-3 mr-1" />
                AI Powered
              </Badge>
            </div>
            <Button
              variant="ghost" 
              size="sm"
              onClick={handleClose}
              disabled={isGenerating}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-blue-700">
            Create personalized outreach emails using AI intelligence and contact enrichment data
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Configuration */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Purpose of Outreach *
                </label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none text-sm"
                  placeholder="Describe what you're selling or the goal of this outreach (e.g., 'invite marketing managers to test our new lead generation SaaS tool')"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Language</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'English' | 'German')}
                    disabled={isGenerating}
                  >
                    <option value="English">English</option>
                    <option value="German">German</option>
                  </select>
                </div>
                
                {availableContacts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      <User className="h-4 w-4 inline mr-1" />
                      Target Contact
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      disabled={isGenerating}
                    >
                      {availableContacts.map(contact => (
                        <option key={contact.id} value={contact.id}>
                          {contact.first_name} {contact.last_name} {contact.company_name ? `(${contact.company_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Advanced Settings */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-blue-600 hover:text-blue-700"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                </Button>

                {showAdvanced && (
                  <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Tone</label>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          value={tone}
                          onChange={(e) => setTone(e.target.value as any)}
                          disabled={isGenerating}
                        >
                          <option value="professional">Professional</option>
                          <option value="warm">Warm & Friendly</option>
                          <option value="direct">Direct & Concise</option>
                          <option value="casual">Casual</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Length</label>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          value={length}
                          onChange={(e) => setLength(e.target.value as any)}
                          disabled={isGenerating}
                        >
                          <option value="short">Short (75-120 words)</option>
                          <option value="medium">Medium (100-150 words)</option>
                          <option value="long">Long (150-200 words)</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Personalization</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={useEnrichment}
                            onChange={(e) => setUseEnrichment(e.target.checked)}
                            disabled={isGenerating}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">Use Enrichment Data</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Your Email Signature *</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-16 resize-none text-sm"
                  placeholder="John Doe&#10;CEO, Company Name&#10;john@company.com&#10;+1-555-0123"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
            </div>

            {/* Enrichment Preview Panel */}
            <div className="lg:col-span-1">
              <Card className="h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <Target className="h-4 w-4 mr-2" />
                    Personalization Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingPreview ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : enrichmentPreview ? (
                    <>
                      {/* Personalization Score */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <BarChart3 className="h-4 w-4 mr-1 text-blue-600" />
                          <span className="text-sm font-medium">Personalization Score</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                          {enrichmentPreview.estimatedScore}%
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div>
                        <div className="flex items-center mb-2">
                          <User className="h-3 w-3 mr-1" />
                          <span className="text-xs font-medium">Contact</span>
                        </div>
                        <div className="text-sm">
                          <div>{enrichmentPreview.contact.first_name} {enrichmentPreview.contact.last_name}</div>
                          {enrichmentPreview.contact.company_name && (
                            <div className="flex items-center text-gray-600">
                              <Building2 className="h-3 w-3 mr-1" />
                              {enrichmentPreview.contact.company_name}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Enrichment Status */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Enrichment Data</span>
                          <Badge 
                            variant={enrichmentPreview.hasEnrichment ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {enrichmentPreview.hasEnrichment ? "Available" : "Limited"}
                          </Badge>
                        </div>
                        
                        {enrichmentPreview.hasEnrichment && enrichmentPreview.enrichmentData && (
                          <div className="mt-2 space-y-1">
                            {enrichmentPreview.enrichmentData.industry && (
                              <div className="flex items-center text-xs text-green-600">
                                <Globe className="h-3 w-3 mr-1" />
                                Industry: {enrichmentPreview.enrichmentData.industry}
                              </div>
                            )}
                            {enrichmentPreview.enrichmentData.products_services?.length > 0 && (
                              <div className="text-xs text-green-600">
                                • Products: {enrichmentPreview.enrichmentData.products_services.slice(0, 2).join(', ')}
                                {enrichmentPreview.enrichmentData.products_services.length > 2 && '...'}
                              </div>
                            )}
                            {enrichmentPreview.enrichmentData.unique_points?.length > 0 && (
                              <div className="text-xs text-green-600">
                                • Key Points: {enrichmentPreview.enrichmentData.unique_points.slice(0, 1).join(', ')}
                                {enrichmentPreview.enrichmentData.unique_points.length > 1 && '...'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tips */}
                      <div className="bg-blue-50 p-2 rounded text-xs">
                        <div className="flex items-start">
                          <Info className="h-3 w-3 mr-1 mt-0.5 text-blue-600" />
                          <span>
                            {enrichmentPreview.hasEnrichment 
                              ? "AI will use company insights to create highly personalized content"
                              : "Enable enrichment or add company data for better personalization"
                            }
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-sm text-gray-500 py-4">
                      Select a contact to see personalization preview
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4 border-t">
            <Button 
              onClick={handleGenerateEmail}
              disabled={!purpose.trim() || !signature.trim() || isGenerating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Enhanced Email...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Personalized Email
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}