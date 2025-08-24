'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Eye, 
  Code, 
  Smartphone, 
  Monitor, 
  Type,
  Bold,
  Italic,
  Link,
  List,
  AlignLeft,
  AlignCenter,
  Image,
  Palette
} from 'lucide-react'

interface HTMLEmailEditorProps {
  subject: string
  htmlContent: string
  onSubjectChange: (subject: string) => void
  onContentChange: (content: string) => void
}

export function HTMLEmailEditor({ 
  subject, 
  htmlContent, 
  onSubjectChange, 
  onContentChange 
}: HTMLEmailEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [editorContent, setEditorContent] = useState(htmlContent)

  useEffect(() => {
    setEditorContent(htmlContent)
  }, [htmlContent])

  const handleContentChange = (content: string) => {
    setEditorContent(content)
    onContentChange(content)
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
      `,
      minimal: `
        <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <p style="color: #333; font-size: 18px; line-height: 1.7; margin-bottom: 25px;">
            Hi &#123;&#123;first_name&#125;&#125;,
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.8; margin-bottom: 20px;">
            [Your personal message here]
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
            Would you be interested in a brief conversation?
          </p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.7;">
            &#123;&#123;sender_name&#125;&#125;
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 12px; line-height: 1.5;">
              This email was sent to &#123;&#123;email&#125;&#125;
            </p>
          </div>
        </div>
      `
    }
    handleContentChange(templates[template as keyof typeof templates])
  }

  const insertVariable = (variable: string) => {
    // Use HTML entity encoded variables for safety (prevents JavaScript execution)
    const variables = {
      first_name: '&#123;&#123;first_name&#125;&#125;',
      last_name: '&#123;&#123;last_name&#125;&#125;',
      email: '&#123;&#123;email&#125;&#125;',
      company: '&#123;&#123;company&#125;&#125;',
      sender_name: '&#123;&#123;sender_name&#125;&#125;',
      company_name: '&#123;&#123;company_name&#125;&#125;'
    }
    
    const newContent = editorContent + ' ' + variables[variable as keyof typeof variables] + ' '
    handleContentChange(newContent)
  }

  const getPreviewContent = () => {
    if (!editorContent) return ''
    
    // Create a safe preview by properly replacing template variables
    let previewContent = editorContent
    
    // Replace template variables with sample data for preview
    // Handle both HTML-encoded and regular curly braces safely
    const replacements = [
      // HTML entity encoded variables (from templates)
      { pattern: /&#123;&#123;\s*first_name\s*&#125;&#125;/g, value: 'John' },
      { pattern: /&#123;&#123;\s*last_name\s*&#125;&#125;/g, value: 'Smith' },
      { pattern: /&#123;&#123;\s*email\s*&#125;&#125;/g, value: 'john.smith@example.com' },
      { pattern: /&#123;&#123;\s*company\s*&#125;&#125;/g, value: 'Acme Corp' },
      { pattern: /&#123;&#123;\s*sender_name\s*&#125;&#125;/g, value: 'Your Name' },
      { pattern: /&#123;&#123;\s*company_name\s*&#125;&#125;/g, value: 'Your Company' },
      
      // Regular curly braces (user input)
      { pattern: /\{\{\s*first_name\s*\}\}/g, value: 'John' },
      { pattern: /\{\{\s*last_name\s*\}\}/g, value: 'Smith' },
      { pattern: /\{\{\s*email\s*\}\}/g, value: 'john.smith@example.com' },
      { pattern: /\{\{\s*company\s*\}\}/g, value: 'Acme Corp' },
      { pattern: /\{\{\s*sender_name\s*\}\}/g, value: 'Your Name' },
      { pattern: /\{\{\s*company_name\s*\}\}/g, value: 'Your Company' }
    ]
    
    // Apply all replacements safely
    replacements.forEach(({ pattern, value }) => {
      previewContent = previewContent.replace(pattern, value)
    })
    
    // Sanitize any remaining template variables to prevent JavaScript execution
    // Replace any remaining {{ }} patterns with safe placeholder text
    previewContent = previewContent.replace(/\{\{\s*[^}]*\s*\}\}/g, '[VARIABLE]')
    previewContent = previewContent.replace(/&#123;&#123;\s*[^}]*\s*&#125;&#125;/g, '[VARIABLE]')
    
    return previewContent
  }

  return (
    <div className="space-y-6">
      {/* Subject Line */}
      <div>
        <label className="block text-sm font-medium mb-2">Email Subject *</label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Quick question about {{company}}"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-1">
          Use variables like {"{{first_name}}"}, {"{{company}}"} for personalization
        </p>
      </div>

      {/* Email Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Type className="h-5 w-5 mr-2" />
              Email Content
            </CardTitle>
            <div className="flex items-center space-x-2">
              {/* View Mode Toggle */}
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

              {/* Preview Toggle */}
              <Button
                variant={isPreviewMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
              >
                {isPreviewMode ? <Code className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {isPreviewMode ? 'Edit' : 'Preview'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Templates */}
          {!isPreviewMode && (
            <div className="border-b pb-4">
              <h4 className="font-medium mb-3">Quick Templates</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => insertTemplate('basic')}>
                  Basic Template
                </Button>
                <Button variant="outline" size="sm" onClick={() => insertTemplate('professional')}>
                  Professional
                </Button>
                <Button variant="outline" size="sm" onClick={() => insertTemplate('minimal')}>
                  Minimal
                </Button>
              </div>
            </div>
          )}

          {/* Variables */}
          {!isPreviewMode && (
            <div className="border-b pb-4">
              <h4 className="font-medium mb-3">Personalization Variables</h4>
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
                  onClick={() => insertVariable('email')}
                >
                  {"{{email}}"}
                </Badge>
              </div>
            </div>
          )}

          {/* Editor/Preview */}
          <div className={`${viewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'}`}>
            {isPreviewMode ? (
              <div className="border border-gray-200 rounded-md min-h-[400px] p-4 bg-white">
                <div dangerouslySetInnerHTML={{ 
                  __html: getPreviewContent() || '<p style="color: #999; font-style: italic;">No content yet. Switch to Edit mode to start writing your email.</p>' 
                }} />
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={15}
                  placeholder="Start typing your HTML email content here, or use a template above..."
                  value={editorContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  💡 Tip: Use HTML for formatting. Templates above include responsive CSS styling.
                </p>
              </div>
            )}
          </div>

          {/* Help Text */}
          {!isPreviewMode && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Type className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">HTML Email Tips</h4>
                  <ul className="text-sm text-blue-700 mt-1 space-y-1">
                    <li>• Use inline CSS styles for better email client compatibility</li>
                    <li>• Keep maximum width around 600px for optimal display</li>
                    <li>• Test your email across different clients (Gmail, Outlook, etc.)</li>
                    <li>• Use system fonts like Arial, Georgia for better support</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}