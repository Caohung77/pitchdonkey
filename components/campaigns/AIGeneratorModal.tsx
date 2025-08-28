'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Sparkles,
  User,
  X,
  Loader2
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
    }>
  }>
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  company_name: string
  email: string
}

export function AIGeneratorModal({ isOpen, onClose, onGenerated, contactLists = [] }: AIGeneratorModalProps) {
  const [purpose, setPurpose] = useState('')
  const [language, setLanguage] = useState<'English' | 'German'>('English')
  const [signature, setSignature] = useState('')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Get all contacts from contact lists
  const availableContacts: Contact[] = contactLists.flatMap(list => list.contacts || [])

  // Set default contact if available
  useEffect(() => {
    if (availableContacts.length > 0 && !selectedContactId) {
      setSelectedContactId(availableContacts[0].id)
    }
  }, [availableContacts, selectedContactId])

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
      const response = await ApiClient.post('/api/ai/generate-outreach', {
        purpose,
        language,
        signature
      })

      if (response.success && response.data) {
        // Pass generated content back to parent
        onGenerated(response.data.subject, response.data.htmlContent)
        
        // Reset form
        setPurpose('')
        setSignature('')
        
        // Close modal
        onClose()
        
        alert('Email generated successfully! Subject and content have been populated.')
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
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
              <CardTitle className="text-blue-900">AI Outreach Email Generator</CardTitle>
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
            Generate professional outreach emails that follow best practices for high response rates
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
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
                  Preview with Contact
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
          
          <div className="flex space-x-3 pt-4">
            <Button 
              onClick={handleGenerateEmail}
              disabled={!purpose.trim() || !signature.trim() || isGenerating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Email...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Outreach Email
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