'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  X,
  Eye,
  Smartphone,
  Monitor
} from 'lucide-react'

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  subject: string
  htmlContent: string
  viewMode: 'desktop' | 'mobile'
  onViewModeChange: (mode: 'desktop' | 'mobile') => void
}

export function EmailPreviewModal({ 
  isOpen, 
  onClose, 
  subject, 
  htmlContent, 
  viewMode, 
  onViewModeChange 
}: EmailPreviewModalProps) {

  if (!isOpen) {
    return null
  }

  const getPreviewContent = () => {
    if (!htmlContent) return ''
    
    // Create a safe preview by properly replacing template variables
    let previewContent = htmlContent
    
    // Use sample data for preview
    const previewData = {
      first_name: 'John',
      last_name: 'Smith', 
      email: 'john.smith@example.com',
      company: 'Acme Corp',
      company_name: 'Acme Corp',
      sender_name: 'Your Name',
      website: 'https://example.com'
    }
    
    // Replace template variables with preview data
    // Handle both HTML-encoded and regular curly braces safely
    const replacements = [
      // HTML entity encoded variables (from templates)
      { pattern: /&#123;&#123;\s*first_name\s*&#125;&#125;/g, value: previewData.first_name },
      { pattern: /&#123;&#123;\s*last_name\s*&#125;&#125;/g, value: previewData.last_name },
      { pattern: /&#123;&#123;\s*email\s*&#125;&#125;/g, value: previewData.email },
      { pattern: /&#123;&#123;\s*company\s*&#125;&#125;/g, value: previewData.company },
      { pattern: /&#123;&#123;\s*company_name\s*&#125;&#125;/g, value: previewData.company_name },
      { pattern: /&#123;&#123;\s*sender_name\s*&#125;&#125;/g, value: previewData.sender_name },
      { pattern: /&#123;&#123;\s*website\s*&#125;&#125;/g, value: previewData.website },
      
      // Regular curly braces (user input)
      { pattern: /\{\{\s*first_name\s*\}\}/g, value: previewData.first_name },
      { pattern: /\{\{\s*last_name\s*\}\}/g, value: previewData.last_name },
      { pattern: /\{\{\s*email\s*\}\}/g, value: previewData.email },
      { pattern: /\{\{\s*company\s*\}\}/g, value: previewData.company },
      { pattern: /\{\{\s*company_name\s*\}\}/g, value: previewData.company_name },
      { pattern: /\{\{\s*sender_name\s*\}\}/g, value: previewData.sender_name },
      { pattern: /\{\{\s*website\s*\}\}/g, value: previewData.website }
    ]
    
    // Apply all replacements safely
    replacements.forEach(({ pattern, value }) => {
      previewContent = previewContent.replace(pattern, value)
    })
    
    return sanitizeEmailHtml(previewContent)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Eye className="h-5 w-5 mr-2 text-blue-600" />
                <CardTitle>Email Preview</CardTitle>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('desktop')}
                  className="rounded-r-none"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('mobile')}
                  className="rounded-l-none"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Button
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {subject && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <span className="font-medium">Subject:</span>
              </div>
              <div className="font-medium text-gray-900 break-words">{subject}</div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-6">
          <div className={`mx-auto ${viewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'} w-full`}>
            <div className="border border-gray-200 rounded-md min-h-[400px] bg-white overflow-x-auto">
              {getPreviewContent() ? (
                <div 
                  className="p-4 email-content"
                  dangerouslySetInnerHTML={{ 
                    __html: getPreviewContent()
                  }} 
                />
              ) : (
                <div className="p-8 text-center text-gray-500 italic">
                  No content yet. Add some email content to see the preview.
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Preview with sample data: John Smith from Acme Corp
            </div>
            <Button 
              variant="outline"
              onClick={onClose}
            >
              Close Preview
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
import { sanitizeEmailHtml } from '@/lib/email-sanitize'
