'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Trash2, Upload, Link as LinkIcon, FileText, ExternalLink, Loader2, Plus, Globe, File, Type, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ApiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { AIPersona } from '@/lib/ai-personas'

interface KnowledgeItem {
  id: string
  type: 'text' | 'link' | 'pdf' | 'doc'
  title: string
  description?: string
  content?: string
  url?: string
  embedding_status: 'pending' | 'processing' | 'ready' | 'failed'
  created_at: string
}

export default function PersonaDetailPage() {
  const router = useRouter()
  const params = useParams()
  const personaId = params.personaId as string

  const [persona, setPersona] = useState<AIPersona | null>(null)
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Knowledge form state
  const [showAddKnowledge, setShowAddKnowledge] = useState(false)
  const [knowledgeForm, setKnowledgeForm] = useState({
    type: 'text' as 'text' | 'link' | 'pdf' | 'doc',
    title: '',
    description: '',
    content: '',
    url: ''
  })
  const [extracting, setExtracting] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPersona()
    loadKnowledge()
  }, [personaId])

  async function loadPersona() {
    try {
      setLoading(true)
      const response = await ApiClient.get(`/api/ai-personas/${personaId}`)
      if (response.success) {
        setPersona(response.data)
      }
    } catch (error: any) {
      toast.error('Failed to load persona')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function loadKnowledge() {
    try {
      const response = await ApiClient.get(`/api/ai-personas/${personaId}/knowledge`)
      if (response.success) {
        setKnowledgeItems(response.data)
      }
    } catch (error: any) {
      console.error('Failed to load knowledge:', error)
    }
  }

  async function handleAddKnowledge() {
    try {
      if (!knowledgeForm.title.trim()) {
        toast.error('Please enter a title')
        return
      }

      if (knowledgeForm.type === 'text' && !knowledgeForm.content.trim()) {
        toast.error('Please enter content')
        return
      }

      if (knowledgeForm.type === 'link' && !knowledgeForm.url.trim()) {
        toast.error('Please enter a URL')
        return
      }

      // Handle URL extraction
      if (knowledgeForm.type === 'link') {
        await handleUrlExtraction()
        return
      }

      // Handle PDF extraction
      if (knowledgeForm.type === 'pdf') {
        if (!pdfFile) {
          toast.error('Please select a PDF file')
          return
        }
        await handlePdfExtraction()
        return
      }

      // Handle text knowledge (no extraction needed)
      const response = await ApiClient.post(`/api/ai-personas/${personaId}/knowledge`, knowledgeForm)

      if (response.success) {
        toast.success('Knowledge item added successfully')
        resetKnowledgeForm()
        loadKnowledge()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add knowledge item')
    }
  }

  async function handleUrlExtraction() {
    try {
      setExtracting(true)
      toast.info('Extracting content from URL...')

      const response = await ApiClient.post(`/api/ai-personas/${personaId}/knowledge/extract`, {
        type: 'url',
        url: knowledgeForm.url,
        title: knowledgeForm.title,
        description: knowledgeForm.description
      })

      if (response.success) {
        const wordCount = response.data?.extraction?.wordCount
        toast.success(`Content extracted successfully! (${wordCount} words)`)
        resetKnowledgeForm()
        loadKnowledge()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to extract content from URL')
    } finally {
      setExtracting(false)
    }
  }

  async function handlePdfExtraction() {
    try {
      if (!pdfFile) return

      setUploadingPdf(true)
      toast.info('Uploading PDF...')

      // First, upload PDF to Supabase storage
      const formData = new FormData()
      formData.append('file', pdfFile)

      const uploadResponse = await fetch(`/api/ai-personas/${personaId}/knowledge/upload-pdf`, {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload PDF')
      }

      const uploadData = await uploadResponse.json()
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload PDF')
      }

      const pdfUrl = uploadData.data.publicUrl

      // Now extract content from the uploaded PDF
      setUploadingPdf(false)
      setExtracting(true)
      toast.info('Extracting content from PDF...')

      const extractResponse = await ApiClient.post(`/api/ai-personas/${personaId}/knowledge/extract`, {
        type: 'pdf',
        url: pdfUrl,
        title: knowledgeForm.title || pdfFile.name.replace('.pdf', ''),
        description: knowledgeForm.description
      })

      if (extractResponse.success) {
        const wordCount = extractResponse.data?.extraction?.wordCount
        toast.success(`PDF content extracted successfully! (${wordCount} words)`)
        resetKnowledgeForm()
        loadKnowledge()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process PDF')
    } finally {
      setUploadingPdf(false)
      setExtracting(false)
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please select a PDF file')
        return
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size exceeds 10MB limit')
        return
      }
      setPdfFile(file)
      if (!knowledgeForm.title) {
        setKnowledgeForm(prev => ({
          ...prev,
          title: file.name.replace('.pdf', '')
        }))
      }
    }
  }

  function resetKnowledgeForm() {
    setKnowledgeForm({
      type: 'text',
      title: '',
      description: '',
      content: '',
      url: ''
    })
    setPdfFile(null)
    setShowAddKnowledge(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleDeleteKnowledge(knowledgeId: string) {
    if (!confirm('Are you sure you want to delete this knowledge item?')) {
      return
    }

    try {
      await ApiClient.delete(`/api/ai-personas/${personaId}/knowledge/${knowledgeId}`)
      toast.success('Knowledge item deleted')
      loadKnowledge()
    } catch (error: any) {
      toast.error('Failed to delete knowledge item')
    }
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  async function handleDeletePersona() {
    if (!persona) {
      console.error('❌ No persona available to delete')
      return
    }

    console.log('🗑️ Starting persona deletion:', {
      personaId,
      personaName: persona.name,
      apiUrl: `/api/ai-personas/${personaId}`
    })

    try {
      setIsDeleting(true)
      console.log('🔄 Calling ApiClient.delete...')

      const response = await ApiClient.delete(`/api/ai-personas/${personaId}`)

      console.log('✅ Delete response received:', response)

      if (response.success) {
        console.log('✅ Persona deleted successfully, showing toast and redirecting')
        toast.success('AI Persona deleted successfully')
        // Redirect to personas list after short delay
        setTimeout(() => {
          console.log('🔄 Redirecting to personas list')
          router.push('/dashboard/ai-personas')
        }, 1000)
      } else {
        console.error('❌ Response indicated failure:', response)
        toast.error(response.error || 'Failed to delete AI persona')
        setIsDeleting(false)
      }
    } catch (error: any) {
      console.error('❌ Error deleting persona:', error)
      toast.error(error.message || 'Failed to delete AI persona')
      setIsDeleting(false)
    }
  }


  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!persona) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Card className="p-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Persona not found</h3>
            <Button className="mt-4" onClick={() => router.push('/dashboard/ai-personas')}>
              Back to Personas
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/ai-personas')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              {persona.avatar_url ? (
                <AvatarImage src={persona.avatar_url} alt={persona.name} />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {getInitials(persona.sender_name || persona.name)}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{persona.sender_name || persona.name}</h1>
              <p className="text-muted-foreground mt-1">
                {persona.sender_role || 'AI Persona'}
              </p>
            </div>
            <Badge className="ml-auto">
              {persona.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personality">Personality</TabsTrigger>
          <TabsTrigger value="knowledge">
            Knowledge Base
            {knowledgeItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {knowledgeItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{persona.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Language</Label>
                  <p className="font-medium">{persona.language?.toUpperCase() || 'EN'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Company</Label>
                  <p className="font-medium">{persona.company_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge>{persona.status}</Badge>
                </div>
              </div>

              {persona.product_one_liner && (
                <div>
                  <Label className="text-muted-foreground">Product</Label>
                  <p className="font-medium">{persona.product_one_liner}</p>
                </div>
              )}

              {persona.product_description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{persona.product_description}</p>
                </div>
              )}

              {persona.unique_selling_points && persona.unique_selling_points.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Unique Selling Points</Label>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {persona.unique_selling_points.map((usp, index) => (
                      <li key={index} className="text-sm">{usp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {persona.persona_type === 'custom' && (
            <Card>
              <CardHeader>
                <CardTitle>Custom Persona Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Custom Persona Name</Label>
                  <p className="font-medium">{persona.custom_persona_name}</p>
                </div>
                {persona.custom_persona_description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm">{persona.custom_persona_description}</p>
                  </div>
                )}
                {persona.custom_role_definition && (
                  <div>
                    <Label className="text-muted-foreground">Role Definition</Label>
                    <p className="text-sm">{persona.custom_role_definition}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Personality Tab */}
        <TabsContent value="personality">
          <Card>
            <CardHeader>
              <CardTitle>Personality Traits</CardTitle>
              <CardDescription>
                Configure how this persona communicates and behaves
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-muted-foreground">Communication Style</Label>
                  <Badge variant="secondary" className="mt-2">
                    {persona.personality_traits.communication_style}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Response Length</Label>
                  <Badge variant="secondary" className="mt-2">
                    {persona.personality_traits.response_length}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Empathy Level</Label>
                  <Badge variant="secondary" className="mt-2">
                    {persona.personality_traits.empathy_level}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Formality</Label>
                  <Badge variant="secondary" className="mt-2">
                    {persona.personality_traits.formality}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Expertise Depth</Label>
                  <Badge variant="secondary" className="mt-2">
                    {persona.personality_traits.expertise_depth}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Proactivity</Label>
                  <Badge variant="secondary" className="mt-2">
                    {persona.personality_traits.proactivity}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>
                    Add context and information to enhance AI responses
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddKnowledge(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Knowledge
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddKnowledge && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Add Knowledge Item</CardTitle>
                    <CardDescription>
                      Add content to enhance your AI persona's knowledge base
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={knowledgeForm.type === 'text' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setKnowledgeForm({ ...knowledgeForm, type: 'text' })
                            setPdfFile(null)
                          }}
                          disabled={extracting || uploadingPdf}
                        >
                          <Type className="h-4 w-4 mr-2" />
                          Text
                        </Button>
                        <Button
                          variant={knowledgeForm.type === 'link' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setKnowledgeForm({ ...knowledgeForm, type: 'link' })
                            setPdfFile(null)
                          }}
                          disabled={extracting || uploadingPdf}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          URL
                        </Button>
                        <Button
                          variant={knowledgeForm.type === 'pdf' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setKnowledgeForm({ ...knowledgeForm, type: 'pdf' })}
                          disabled={extracting || uploadingPdf}
                        >
                          <File className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Product Documentation"
                        value={knowledgeForm.title}
                        onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        placeholder="Brief description"
                        value={knowledgeForm.description}
                        onChange={(e) => setKnowledgeForm({ ...knowledgeForm, description: e.target.value })}
                      />
                    </div>

                    {knowledgeForm.type === 'text' && (
                      <div className="space-y-2">
                        <Label htmlFor="content">Content *</Label>
                        <Textarea
                          id="content"
                          placeholder="Enter the content here..."
                          value={knowledgeForm.content}
                          onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                          rows={8}
                        />
                      </div>
                    )}

                    {knowledgeForm.type === 'link' && (
                      <div className="space-y-2">
                        <Label htmlFor="url">Website URL *</Label>
                        <div className="space-y-1">
                          <Input
                            id="url"
                            type="url"
                            placeholder="https://example.com/documentation"
                            value={knowledgeForm.url}
                            onChange={(e) => setKnowledgeForm({ ...knowledgeForm, url: e.target.value })}
                            disabled={extracting}
                          />
                          <p className="text-xs text-muted-foreground">
                            Content will be automatically extracted from this URL using Jina AI
                          </p>
                        </div>
                      </div>
                    )}

                    {knowledgeForm.type === 'pdf' && (
                      <div className="space-y-2">
                        <Label htmlFor="pdf-file">PDF File *</Label>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              ref={fileInputRef}
                              id="pdf-file"
                              type="file"
                              accept=".pdf"
                              onChange={handleFileSelect}
                              disabled={extracting || uploadingPdf}
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={extracting || uploadingPdf}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Select
                            </Button>
                          </div>
                          {pdfFile && (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                              <File className="h-4 w-4 text-primary" />
                              <span className="text-sm flex-1">{pdfFile.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPdfFile(null)
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = ''
                                  }
                                }}
                                disabled={extracting || uploadingPdf}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Max 10MB. Content will be extracted automatically using Jina AI
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddKnowledge}
                        disabled={extracting || uploadingPdf}
                      >
                        {extracting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {uploadingPdf && <Upload className="h-4 w-4 mr-2 animate-pulse" />}
                        {extracting ? 'Extracting...' : uploadingPdf ? 'Uploading...' : 'Add Knowledge'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetKnowledgeForm}
                        disabled={extracting || uploadingPdf}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {knowledgeItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No knowledge items yet</p>
                  <p className="text-sm mt-2">
                    Add documents, links, and context to help your AI persona provide better responses
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {knowledgeItems.map((item) => (
                    <Card key={item.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {item.type === 'text' && <FileText className="h-5 w-5 mt-0.5" />}
                            {item.type === 'link' && <LinkIcon className="h-5 w-5 mt-0.5" />}
                            <div>
                              <CardTitle className="text-base">{item.title}</CardTitle>
                              {item.description && (
                                <CardDescription className="mt-1">{item.description}</CardDescription>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              item.embedding_status === 'ready' ? 'default' :
                              item.embedding_status === 'failed' ? 'destructive' :
                              'secondary'
                            }>
                              {item.embedding_status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKnowledge(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {item.content && (
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {item.content}
                          </p>
                        </CardContent>
                      )}
                      {item.url && (
                        <CardContent>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            {item.url}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Manage persona settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Chat Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      Allow users to chat with this persona
                    </p>
                  </div>
                  <Badge variant={persona.chat_enabled ? 'default' : 'secondary'}>
                    {persona.chat_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Total Chats</p>
                    <p className="text-sm text-muted-foreground">
                      Number of chat sessions
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {persona.total_chats || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Emails Handled</p>
                    <p className="text-sm text-muted-foreground">
                      Number of emails processed
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {persona.total_emails_handled || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delete Persona */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-900">Delete Persona</CardTitle>
              <CardDescription>
                Permanently delete this persona and all associated data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Delete AI Persona</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will remove all knowledge base items, chat history, and email assignments. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete AI Persona?"
        description={`Are you absolutely sure you want to permanently delete "${persona?.name}"? This will remove all knowledge base items, chat history, and email assignments. This action cannot be undone.`}
        confirmText="Delete Permanently"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeletePersona}
      />
    </div>
  )
}
