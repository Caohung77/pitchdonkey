'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Plus,
  Sparkles,
  Edit,
  Trash2,
  Eye,
  Copy,
  AlertCircle,
  Loader2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { AITemplate } from '@/lib/ai-templates'

export default function AITemplatesPage() {
  // AI Templates page with full functionality: Preview, Edit, Delete
  return (
    <ToastProvider>
      <AITemplatesContent />
    </ToastProvider>
  )
}

function AITemplatesContent() {
  const [templates, setTemplates] = useState<AITemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  
  // Modal states
  const [previewTemplate, setPreviewTemplate] = useState<AITemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<AITemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<AITemplate | null>(null)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  
  // Toast hook
  const { addToast } = useToast()

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter)
      }

      const response = await fetch(`/api/ai/templates?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.data || [])
      } else {
        throw new Error('Failed to fetch templates')
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      setError('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [categoryFilter])

  const handleDelete = (template: AITemplate) => {
    setDeletingTemplate(template)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingTemplate) return

    try {
      const response = await fetch(`/api/ai/templates/${deletingTemplate.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTemplates(templates.filter(t => t.id !== deletingTemplate.id))
        addToast({
          type: 'success',
          message: 'Template deleted successfully'
        })
      } else {
        throw new Error('Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      addToast({
        type: 'error',
        message: 'Failed to delete template. Please try again.'
      })
    } finally {
      setDeletingTemplate(null)
    }
  }

  const handlePreview = (template: AITemplate) => {
    setPreviewTemplate(template)
    setIsPreviewModalOpen(true)
  }

  const handleEdit = (template: AITemplate) => {
    setEditingTemplate(template)
    setIsEditModalOpen(true)
  }



  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cold_outreach':
        return 'bg-blue-100 text-blue-800'
      case 'follow_up':
        return 'bg-green-100 text-green-800'
      case 'introduction':
        return 'bg-purple-100 text-purple-800'
      case 'meeting_request':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Templates</h1>
            <p className="text-gray-600">Manage your AI personalization templates</p>
          </div>
          <CreateTemplateDialog onTemplateCreated={fetchTemplates} />
        </div>
      </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Categories</option>
                <option value="cold_outreach">Cold Outreach</option>
                <option value="follow_up">Follow Up</option>
                <option value="introduction">Introduction</option>
                <option value="meeting_request">Meeting Request</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Templates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || categoryFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating your first AI template'
                  }
                </p>
                <CreateTemplateDialog onTemplateCreated={fetchTemplates} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getCategoryColor(template.category)}>
                      {template.category.replace('_', ' ')}
                    </Badge>
                    {template.is_default && (
                      <Badge variant="outline">Default</Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      Used {template.usage_count} times
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Campaign Settings Display */}
                    <div className="bg-gray-50 p-3 rounded text-sm space-y-2">
                      {template.sender_name && (
                        <div className="flex items-center text-xs">
                          <span className="font-medium text-gray-600 w-20">Sender:</span>
                          <span className="text-gray-800">{template.sender_name}</span>
                        </div>
                      )}
                      {template.email_purpose && (
                        <div className="flex items-start text-xs">
                          <span className="font-medium text-gray-600 w-20 flex-shrink-0">Purpose:</span>
                          <span className="text-gray-800 line-clamp-2">{template.email_purpose}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-600 mr-2">Language:</span>
                          <Badge variant="outline" className="text-xs">{template.language || 'English'}</Badge>
                        </div>
                        {template.generation_options && (
                          <div className="flex items-center space-x-1">
                            {template.generation_options.generate_for_all && (
                              <Badge variant="outline" className="text-xs bg-blue-50">Generate All</Badge>
                            )}
                            {template.generation_options.use_contact_info && (
                              <Badge variant="outline" className="text-xs bg-green-50">Use Contact Info</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 pt-1 border-t">
                        <span className="font-medium">Subject:</span> {template.subject || template.subject_template || 'No subject'}
                      </div>
                    </div>

                    {/* Variables */}
                    {template.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map((variable, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                        {template.variables.length > 3 && (
                          <Badge variant="outline" className="text-xs bg-gray-100">
                            +{template.variables.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handlePreview(template)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      {!template.is_default && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDelete(template)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete Template"
        description={deletingTemplate ? `Are you sure you want to delete "${deletingTemplate.name}"? This action cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Preview Modal */}
      {previewTemplate && (
        <PreviewTemplateModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          template={previewTemplate}
          getCategoryColor={getCategoryColor}
        />
      )}

      {/* Edit Modal */}
      {editingTemplate && (
        <EditTemplateModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          template={editingTemplate}
          onTemplateUpdated={fetchTemplates}
        />
      )}
    </div>
  )
}

function CreateTemplateDialog({ onTemplateCreated }: { onTemplateCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'custom' as const,
    content: '',
    subject: '',
    sender_name: '',
    email_purpose: '',
    language: 'English' as const,
    generate_for_all: false,
    use_contact_info: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/ai/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          generation_options: {
            generate_for_all: formData.generate_for_all,
            use_contact_info: formData.use_contact_info,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create template')
      }

      setIsOpen(false)
      resetForm()
      onTemplateCreated()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create template')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'custom',
      content: '',
      subject: '',
      sender_name: '',
      email_purpose: '',
      language: 'English',
      generate_for_all: false,
      use_contact_info: true,
    })
    setError('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetForm()
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create AI Template</DialogTitle>
          <DialogDescription>
            Create a new template for AI personalization
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Custom Template"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="cold_outreach">Cold Outreach</option>
                <option value="follow_up">Follow Up</option>
                <option value="introduction">Introduction</option>
                <option value="meeting_request">Meeting Request</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this template"
            />
          </div>

          {/* Campaign Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sender_name">Sender Name</Label>
              <Input
                id="sender_name"
                value={formData.sender_name}
                onChange={(e) => setFormData(prev => ({ ...prev, sender_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                value={formData.language}
                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value as 'English' | 'German' }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="English">English</option>
                <option value="German">German</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_purpose">Email Purpose</Label>
            <textarea
              id="email_purpose"
              value={formData.email_purpose}
              onChange={(e) => setFormData(prev => ({ ...prev, email_purpose: e.target.value }))}
              placeholder="Describe the purpose of this email template..."
              className="w-full p-3 border border-gray-300 rounded-md"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Subject line with {{variables}}"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Email Content *</Label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your email template here. Use {{variable_name}} for personalization..."
              className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
              rows={15}
              required
            />
            <p className="text-xs text-gray-500">
              Use {`{{variable_name}}`} syntax for personalization variables
            </p>
          </div>

          {/* Generation Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Generation Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="generate_for_all"
                  checked={formData.generate_for_all}
                  onChange={(e) => setFormData(prev => ({ ...prev, generate_for_all: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="generate_for_all" className="text-sm">Generate for all contacts</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="use_contact_info"
                  checked={formData.use_contact_info}
                  onChange={(e) => setFormData(prev => ({ ...prev, use_contact_info: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="use_contact_info" className="text-sm">Use contact information</Label>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PreviewTemplateModal({
  isOpen,
  onClose,
  template,
  getCategoryColor
}: {
  isOpen: boolean
  onClose: () => void
  template: AITemplate
  getCategoryColor: (category: string) => string
}) {
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'rendered' | 'code'>('rendered')

  // Initialize variables with sample data
  useEffect(() => {
    if (template && isOpen) {
      const sampleVariables: Record<string, string> = {}
      template.variables.forEach(variable => {
        switch (variable) {
          case 'first_name':
            sampleVariables[variable] = 'John'
            break
          case 'last_name':
            sampleVariables[variable] = 'Doe'
            break
          case 'company_name':
            sampleVariables[variable] = 'Acme Corp'
            break
          case 'industry':
            sampleVariables[variable] = 'Technology'
            break
          case 'position':
            sampleVariables[variable] = 'CEO'
            break
          default:
            sampleVariables[variable] = `[${variable}]`
        }
      })
      setVariables(sampleVariables)
      generatePreview(sampleVariables)
    }
  }, [template, isOpen])

  const generatePreview = async (vars: Record<string, string>) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/ai/templates/${template.id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variables: vars }),
      })

      if (response.ok) {
        const data = await response.json()
        setPreview(data.data.preview)
      } else {
        // Fallback to simple string replacement
        let previewText = template.content
        Object.entries(vars).forEach(([key, value]) => {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
          previewText = previewText.replace(regex, value || `{{${key}}}`)
        })
        setPreview(previewText)
      }
    } catch (error) {
      console.error('Preview error:', error)
      // Fallback to simple string replacement
      let previewText = template.content
      Object.entries(vars).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
        previewText = previewText.replace(regex, value || `{{${key}}}`)
      })
      setPreview(previewText)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVariableChange = (variable: string, value: string) => {
    const newVariables = { ...variables, [variable]: value }
    setVariables(newVariables)
    generatePreview(newVariables)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Template: {template.name}</DialogTitle>
          <DialogDescription>
            Customize the variables below to see how your template will look
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campaign Settings Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm text-blue-900">Campaign Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Sender Name:</span>
                <div className="mt-1 text-blue-700">{template.sender_name || 'Not specified'}</div>
              </div>
              <div>
                <span className="font-medium text-blue-800">Language:</span>
                <div className="mt-1 text-blue-700">{template.language || 'English'}</div>
              </div>
              <div className="md:col-span-2">
                <span className="font-medium text-blue-800">Email Purpose:</span>
                <div className="mt-1 text-blue-700">{template.email_purpose || 'Not specified'}</div>
              </div>
              <div className="md:col-span-2">
                <span className="font-medium text-blue-800">Subject:</span>
                <div className="mt-1 text-blue-700 font-mono text-xs bg-white p-2 rounded border">
                  {template.subject || template.subject_template || 'No subject'}
                </div>
              </div>
              {template.generation_options && (
                <div className="md:col-span-2">
                  <span className="font-medium text-blue-800">Generation Options:</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {template.generation_options.generate_for_all && (
                      <Badge className="bg-blue-100 text-blue-800">Generate for All</Badge>
                    )}
                    {template.generation_options.use_contact_info && (
                      <Badge className="bg-green-100 text-green-800">Use Contact Info</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Variables Input */}
          {template.variables.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Template Variables:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {template.variables.map((variable) => (
                  <div key={variable} className="space-y-1">
                    <Label htmlFor={variable} className="text-xs">
                      {variable.replace('_', ' ')}
                    </Label>
                    <Input
                      id={variable}
                      value={variables[variable] || ''}
                      onChange={(e) => handleVariableChange(variable, e.target.value)}
                      placeholder={`Enter ${variable.replace('_', ' ')}`}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Preview:</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode(viewMode === 'rendered' ? 'code' : 'rendered')}
                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                >
                  {viewMode === 'rendered' ? 'Show Code' : 'Show Rendered'}
                </button>
              </div>
            </div>
            <div className="border rounded-lg bg-white min-h-[300px] overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Generating preview...
                </div>
              ) : viewMode === 'rendered' ? (
                <div className="p-4 bg-gray-100">
                  <div className="mx-auto max-w-4xl">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                        Email Preview
                      </div>
                      <div
                        className="p-6"
                        dangerouslySetInnerHTML={{ __html: preview }}
                        style={{
                          fontFamily: 'Arial, sans-serif',
                          lineHeight: '1.6',
                          color: '#333'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono overflow-auto">
                    {preview}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Template Info */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Category: <Badge className={getCategoryColor(template.category)}>{template.category.replace('_', ' ')}</Badge></span>
              <span>Used {template.usage_count} times</span>
            </div>
            {template.description && (
              <p className="text-xs text-gray-600">{template.description}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(preview)
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy {viewMode === 'rendered' ? 'HTML' : 'Code'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditTemplateModal({ 
  isOpen, 
  onClose, 
  template,
  onTemplateUpdated 
}: { 
  isOpen: boolean
  onClose: () => void
  template: AITemplate
  onTemplateUpdated: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: template.name,
    description: template.description || '',
    category: template.category,
    content: template.content,
    subject: template.subject || template.subject_template || '',
    sender_name: template.sender_name || '',
    email_purpose: template.email_purpose || '',
    language: template.language || 'English',
    generate_for_all: template.generation_options?.generate_for_all || false,
    use_contact_info: template.generation_options?.use_contact_info !== false,
  })
  const { addToast } = useToast()

  // Reset form when template changes
  useEffect(() => {
    if (template && isOpen) {
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category,
        content: template.content,
        subject: template.subject || template.subject_template || '',
        sender_name: template.sender_name || '',
        email_purpose: template.email_purpose || '',
        language: template.language || 'English',
        generate_for_all: template.generation_options?.generate_for_all || false,
        use_contact_info: template.generation_options?.use_contact_info !== false,
      })
      setError('')
    }
  }, [template, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/ai/templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          generation_options: {
            generate_for_all: formData.generate_for_all,
            use_contact_info: formData.use_contact_info,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update template')
      }

      onClose()
      onTemplateUpdated()
      addToast({
        type: 'success',
        message: 'Template updated successfully'
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update template')
      addToast({
        type: 'error',
        message: 'Failed to update template. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      content: template.content,
      subject: template.subject || template.subject_template || '',
      sender_name: template.sender_name || '',
      email_purpose: template.email_purpose || '',
      language: template.language || 'English',
      generate_for_all: template.generation_options?.generate_for_all || false,
      use_contact_info: template.generation_options?.use_contact_info !== false,
    })
    setError('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose()
        resetForm()
      }
    }}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Template: {template.name}</DialogTitle>
          <DialogDescription>
            Update your AI personalization template
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Template Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Custom Template"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="introduction">Introduction</SelectItem>
                  <SelectItem value="meeting_request">Meeting Request</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this template"
            />
          </div>

          {/* Campaign Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-sender_name">Sender Name</Label>
              <Input
                id="edit-sender_name"
                value={formData.sender_name}
                onChange={(e) => setFormData(prev => ({ ...prev, sender_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-language">Language</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData(prev => ({ ...prev, language: value as 'English' | 'German' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="German">German</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email_purpose">Email Purpose</Label>
            <Textarea
              id="edit-email_purpose"
              value={formData.email_purpose}
              onChange={(e) => setFormData(prev => ({ ...prev, email_purpose: e.target.value }))}
              placeholder="Describe the purpose of this email template..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-subject">Email Subject</Label>
            <Input
              id="edit-subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Subject line with {{variables}}"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-content">Email Content *</Label>
            <Textarea
              id="edit-content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your email template here. Use {{variable_name}} for personalization..."
              className="min-h-[400px] font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500">
              Use {`{{variable_name}}`} syntax for personalization variables
            </p>
          </div>

          {/* Generation Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Generation Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-generate_for_all"
                  checked={formData.generate_for_all}
                  onChange={(e) => setFormData(prev => ({ ...prev, generate_for_all: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="edit-generate_for_all" className="text-sm">Generate for all contacts</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-use_contact_info"
                  checked={formData.use_contact_info}
                  onChange={(e) => setFormData(prev => ({ ...prev, use_contact_info: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="edit-use_contact_info" className="text-sm">Use contact information</Label>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                onClose()
                resetForm()
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Template
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}