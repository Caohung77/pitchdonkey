'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Sparkles, 
  Loader2, 
  Users, 
  DollarSign, 
  Clock, 
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { AITemplate } from '@/lib/ai-templates'
import { Contact } from '@/lib/contacts'

interface PersonalizationDialogProps {
  selectedContacts: Contact[]
  onPersonalizationComplete: (results: any) => void
}

export default function PersonalizationDialog({ 
  selectedContacts, 
  onPersonalizationComplete 
}: PersonalizationDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<'template' | 'variables' | 'preview' | 'processing' | 'results'>('template')
  const [templates, setTemplates] = useState<AITemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<AITemplate | null>(null)
  const [customContent, setCustomContent] = useState('')
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic'>('openai')
  const [estimate, setEstimate] = useState<any>(null)
  const [results, setResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
    }
  }, [isOpen])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/ai/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const getEstimate = async () => {
    const content = selectedTemplate?.content || customContent
    if (!content) return

    try {
      const response = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_length: content.length,
          contact_count: selectedContacts.length,
          provider: aiProvider,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setEstimate(data.data)
      }
    } catch (error) {
      console.error('Error getting estimate:', error)
    }
  }

  useEffect(() => {
    if (currentStep === 'preview') {
      getEstimate()
    }
  }, [currentStep, selectedTemplate, customContent, aiProvider])

  const handleTemplateSelect = (template: AITemplate) => {
    setSelectedTemplate(template)
    setCustomContent('')
    
    // Initialize variables with contact data
    const initialVariables: Record<string, string> = {}
    template.variables.forEach(variable => {
      if (selectedContacts.length > 0) {
        const contact = selectedContacts[0]
        switch (variable) {
          case 'first_name':
            initialVariables[variable] = contact.first_name
            break
          case 'last_name':
            initialVariables[variable] = contact.last_name
            break
          case 'company_name':
            initialVariables[variable] = contact.company_name || ''
            break
          case 'job_title':
            initialVariables[variable] = contact.job_title || ''
            break
          case 'industry':
            initialVariables[variable] = contact.industry || ''
            break
          default:
            initialVariables[variable] = ''
        }
      }
    })
    setVariables(initialVariables)
  }

  const handleCustomContent = (content: string) => {
    setCustomContent(content)
    setSelectedTemplate(null)
    
    // Extract variables from custom content
    const variableRegex = /\{\{([^}]+)\}\}/g
    const extractedVariables: string[] = []
    let match
    
    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].trim()
      if (!extractedVariables.includes(variable)) {
        extractedVariables.push(variable)
      }
    }
    
    const initialVariables: Record<string, string> = {}
    extractedVariables.forEach(variable => {
      initialVariables[variable] = variables[variable] || ''
    })
    setVariables(initialVariables)
  }

  const handlePersonalize = async () => {
    setCurrentStep('processing')
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/ai/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_ids: selectedContacts.map(c => c.id),
          template_id: selectedTemplate?.id,
          custom_prompt: customContent || undefined,
          variables,
          ai_provider: aiProvider,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Personalization failed')
      }

      const data = await response.json()
      setResults(data.data)
      setCurrentStep('results')
      onPersonalizationComplete(data.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Personalization failed')
      setCurrentStep('preview')
    } finally {
      setIsLoading(false)
    }
  }

  const resetDialog = () => {
    setCurrentStep('template')
    setSelectedTemplate(null)
    setCustomContent('')
    setVariables({})
    setResults(null)
    setError('')
    setEstimate(null)
  }

  const getVariableList = () => {
    if (selectedTemplate) return selectedTemplate.variables
    
    const variableRegex = /\{\{([^}]+)\}\}/g
    const extractedVariables: string[] = []
    let match
    
    while ((match = variableRegex.exec(customContent)) !== null) {
      const variable = match[1].trim()
      if (!extractedVariables.includes(variable)) {
        extractedVariables.push(variable)
      }
    }
    
    return extractedVariables
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetDialog()
    }}>
      <DialogTrigger asChild>
        <Button disabled={selectedContacts.length === 0}>
          <Sparkles className="h-4 w-4 mr-2" />
          AI Personalize ({selectedContacts.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Personalization</DialogTitle>
          <DialogDescription>
            Personalize content for {selectedContacts.length} selected contacts using AI
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {currentStep === 'template' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Choose Template or Custom Content</h3>
            
            <div className="space-y-3">
              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-gray-600">{template.description}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge variant="outline">{template.category}</Badge>
                            <span className="text-xs text-gray-500">
                              {template.variables.length} variables
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="border-t pt-4">
                <Label htmlFor="custom-content">Or write custom content:</Label>
                <textarea
                  id="custom-content"
                  className="w-full mt-2 p-3 border border-gray-300 rounded-md"
                  rows={6}
                  placeholder="Write your custom email template here. Use {{variable_name}} for personalization..."
                  value={customContent}
                  onChange={(e) => handleCustomContent(e.target.value)}
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={() => setCurrentStep('variables')}
                disabled={!selectedTemplate && !customContent}
                className="flex-1"
              >
                Next: Configure Variables
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'variables' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Configure Variables</h3>
            
            <div className="space-y-3">
              {getVariableList().map((variable) => (
                <div key={variable} className="space-y-2">
                  <Label htmlFor={variable}>
                    {variable.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Label>
                  <Input
                    id={variable}
                    value={variables[variable] || ''}
                    onChange={(e) => setVariables(prev => ({ ...prev, [variable]: e.target.value }))}
                    placeholder={`Enter ${variable}`}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>AI Provider</Label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as 'openai' | 'anthropic')}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="openai">OpenAI GPT-4</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setCurrentStep('template')}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep('preview')} className="flex-1">
                Preview & Estimate
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'preview' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Preview & Cost Estimate</h3>
            
            {estimate && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{selectedContacts.length}</div>
                    <div className="text-xs text-gray-600">Contacts</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Target className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{estimate.estimatedTokens.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">Est. Tokens</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold">${estimate.estimatedCost}</div>
                    <div className="text-xs text-gray-600">Est. Cost</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold">~{Math.ceil(selectedContacts.length / 5)}</div>
                    <div className="text-xs text-gray-600">Minutes</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Content Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                  {selectedTemplate?.content || customContent}
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setCurrentStep('variables')}>
                Back
              </Button>
              <Button onClick={handlePersonalize} className="flex-1">
                <Sparkles className="h-4 w-4 mr-2" />
                Start Personalization
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'processing' && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-medium mb-2">Personalizing Content...</h3>
            <p className="text-gray-600">
              AI is personalizing content for {selectedContacts.length} contacts. This may take a few minutes.
            </p>
          </div>
        )}

        {currentStep === 'results' && results && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Personalization Complete!</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{results.summary.total_processed}</div>
                  <div className="text-xs text-gray-600">Processed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{results.summary.total_tokens}</div>
                  <div className="text-xs text-gray-600">Tokens Used</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(results.summary.average_confidence * 100)}%
                  </div>
                  <div className="text-xs text-gray-600">Avg Confidence</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(results.summary.average_processing_time / 1000)}s
                  </div>
                  <div className="text-xs text-gray-600">Avg Time</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sample Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {results.results.slice(0, 3).map((result: any, index: number) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="font-medium text-sm">{result.contact_name}</div>
                      <div className="text-xs text-gray-600 mb-2">
                        Confidence: {Math.round(result.confidence * 100)}% | 
                        Tokens: {result.tokensUsed}
                      </div>
                      <div className="bg-gray-50 p-2 rounded text-xs">
                        {result.personalizedContent.substring(0, 200)}...
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button onClick={() => setIsOpen(false)} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}