'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Sparkles, User, MessageSquare, Brain, Database, Check, Loader2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { ApiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { PersonalityTraits } from '@/lib/persona-personality'

const PERSONA_TYPES = [
  { value: 'customer_support', label: 'Customer Support', description: 'Friendly, empathetic support specialist' },
  { value: 'sales_rep', label: 'Sales Representative', description: 'Confident, engaging sales professional' },
  { value: 'sales_development', label: 'Sales Development Rep', description: 'Energetic, outgoing SDR' },
  { value: 'account_manager', label: 'Account Manager', description: 'Reliable, relationship-focused manager' },
  { value: 'consultant', label: 'Consultant', description: 'Expert advisor with strategic insights' },
  { value: 'technical_specialist', label: 'Technical Specialist', description: 'Technical expert with deep knowledge' },
  { value: 'success_manager', label: 'Customer Success Manager', description: 'Supportive, proactive success partner' },
  { value: 'marketing_specialist', label: 'Marketing Specialist', description: 'Creative, data-driven marketer' },
  { value: 'custom', label: 'Custom Persona', description: 'Create your own unique persona' }
]

const STEPS = [
  { id: 1, title: 'Basic Info', icon: User },
  { id: 2, title: 'Persona Type', icon: Sparkles },
  { id: 3, title: 'Personality', icon: Brain },
  { id: 4, title: 'Context', icon: MessageSquare },
  { id: 5, title: 'Knowledge', icon: Database }
]

export default function CreatePersonaPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [smartFillLoading, setSmartFillLoading] = useState(false)
  const [smartFillUrl, setSmartFillUrl] = useState('')

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: '',
    sender_name: '',
    sender_role: '',
    sender_email: '',
    company_name: '',
    language: 'en' as 'en' | 'de',

    // Step 2: Persona Type
    persona_type: '' as any,
    custom_persona_name: '',
    custom_persona_description: '',
    custom_role_definition: '',
    custom_responsibilities: [] as string[],
    custom_communication_guidelines: '',

    // Step 3: Personality Traits
    personality_traits: {
      communication_style: 'professional',
      response_length: 'balanced',
      empathy_level: 'moderate',
      formality: 'professional',
      expertise_depth: 'intermediate',
      proactivity: 'balanced'
    } as PersonalityTraits,

    // Step 4: Company Context
    purpose: '',
    product_one_liner: '',
    product_description: '',
    unique_selling_points: [] as string[],
    target_persona: '',
    conversation_goal: '',
    preferred_cta: '',

    // Step 5: Knowledge Base
    knowledge_items: [] as Array<{
      type: 'text' | 'link' | 'pdf' | 'doc'
      title: string
      content?: string
      url?: string
      description?: string
    }>
  })

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length))
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          toast.error('Please enter a persona name')
          return false
        }
        if (!formData.sender_name.trim()) {
          toast.error('Please enter sender name')
          return false
        }
        return true
      case 2:
        if (!formData.persona_type) {
          toast.error('Please select a persona type')
          return false
        }
        if (formData.persona_type === 'custom' && !formData.custom_persona_name.trim()) {
          toast.error('Please enter a custom persona name')
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)

      const payload: any = {
        name: formData.name,
        sender_name: formData.sender_name,
        sender_role: formData.sender_role,
        sender_email: formData.sender_email,
        company_name: formData.company_name,
        language: formData.language,
        persona_type: formData.persona_type,
        personality_traits: formData.personality_traits,
        purpose: formData.purpose,
        product_one_liner: formData.product_one_liner,
        product_description: formData.product_description,
        unique_selling_points: formData.unique_selling_points.filter(usp => usp.trim()),
        target_persona: formData.target_persona,
        conversation_goal: formData.conversation_goal,
        preferred_cta: formData.preferred_cta,
        status: 'active',
        chat_enabled: true
      }

      // Add custom persona fields if applicable
      if (formData.persona_type === 'custom') {
        payload.custom_persona_name = formData.custom_persona_name
        payload.custom_persona_description = formData.custom_persona_description
        payload.custom_role_definition = formData.custom_role_definition
        payload.custom_responsibilities = formData.custom_responsibilities.filter(r => r.trim())
        payload.custom_communication_guidelines = formData.custom_communication_guidelines
      }

      const response = await ApiClient.post('/api/ai-personas', payload)

      if (response.success) {
        toast.success('AI Persona created successfully!')
        router.push('/dashboard/ai-personas')
      } else {
        throw new Error(response.error || 'Failed to create persona')
      }
    } catch (error: any) {
      console.error('Error creating persona:', error)
      toast.error(error.message || 'Failed to create AI persona')
    } finally {
      setLoading(false)
    }
  }

  const addUSP = () => {
    setFormData(prev => ({
      ...prev,
      unique_selling_points: [...prev.unique_selling_points, '']
    }))
  }

  const updateUSP = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      unique_selling_points: prev.unique_selling_points.map((usp, i) => i === index ? value : usp)
    }))
  }

  const removeUSP = (index: number) => {
    setFormData(prev => ({
      ...prev,
      unique_selling_points: prev.unique_selling_points.filter((_, i) => i !== index)
    }))
  }

  const addResponsibility = () => {
    setFormData(prev => ({
      ...prev,
      custom_responsibilities: [...prev.custom_responsibilities, '']
    }))
  }

  const updateResponsibility = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      custom_responsibilities: prev.custom_responsibilities.map((resp, i) => i === index ? value : resp)
    }))
  }

  const removeResponsibility = (index: number) => {
    setFormData(prev => ({
      ...prev,
      custom_responsibilities: prev.custom_responsibilities.filter((_, i) => i !== index)
    }))
  }

  const handleSmartFill = async () => {
    if (!smartFillUrl.trim()) {
      toast.error('Please enter a company or product URL')
      return
    }

    try {
      setSmartFillLoading(true)
      toast.info('Analyzing website...')

      const response = await ApiClient.post('/api/ai-personas/smart-fill', {
        url: smartFillUrl
      })

      if (response.success && response.data) {
        const data = response.data

        // Update form data with enriched information
        setFormData(prev => ({
          ...prev,
          company_name: data.companyName || prev.company_name,
          purpose: data.tone || prev.purpose,
          product_one_liner: data.productOneLiner || prev.product_one_liner,
          product_description: data.extendedDescription || prev.product_description,
          unique_selling_points: data.uniqueSellingPoints?.length > 0
            ? data.uniqueSellingPoints
            : prev.unique_selling_points,
          target_persona: data.targetPersona || prev.target_persona
        }))

        toast.success(`✓ Context filled from ${new URL(smartFillUrl).hostname}`)
        setSmartFillUrl('') // Clear the URL input
      } else {
        throw new Error(response.error || 'Failed to analyze website')
      }
    } catch (error: any) {
      console.error('Smart fill error:', error)
      toast.error(error.message || 'Failed to analyze website. Please check the URL and try again.')
    } finally {
      setSmartFillLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
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
        <div>
          <h1 className="text-3xl font-bold">Create AI Persona</h1>
          <p className="text-muted-foreground mt-1">
            Configure your AI-powered employee persona
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${isActive ? 'bg-primary text-primary-foreground' : ''}
                      ${isCompleted ? 'bg-green-500 text-white' : ''}
                      ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                    `}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Basic information about your AI persona'}
            {currentStep === 2 && 'Choose the type and role of your persona'}
            {currentStep === 3 && 'Define personality traits and communication style'}
            {currentStep === 4 && 'Add company context and messaging strategy'}
            {currentStep === 5 && 'Add knowledge base for better context'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Persona Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Sarah Chen"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value: 'en' | 'de') => setFormData({ ...formData, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sender_name">Sender Name *</Label>
                  <Input
                    id="sender_name"
                    placeholder="e.g., Sarah Chen"
                    value={formData.sender_name}
                    onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender_role">Sender Role</Label>
                  <Input
                    id="sender_role"
                    placeholder="e.g., Customer Support Specialist"
                    value={formData.sender_role}
                    onChange={(e) => setFormData({ ...formData, sender_role: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sender_email">Sender Email</Label>
                  <Input
                    id="sender_email"
                    type="email"
                    placeholder="sarah@company.com"
                    value={formData.sender_email}
                    onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    placeholder="e.g., Acme Corp"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Persona Type */}
          {currentStep === 2 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PERSONA_TYPES.map((type) => (
                  <Card
                    key={type.value}
                    className={`cursor-pointer transition-all ${
                      formData.persona_type === type.value
                        ? 'border-primary ring-2 ring-primary'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setFormData({ ...formData, persona_type: type.value })}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{type.label}</CardTitle>
                      <CardDescription className="text-sm">{type.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {formData.persona_type === 'custom' && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold">Custom Persona Configuration</h3>

                  <div className="space-y-2">
                    <Label htmlFor="custom_persona_name">Custom Persona Name *</Label>
                    <Input
                      id="custom_persona_name"
                      placeholder="e.g., Technical Account Manager"
                      value={formData.custom_persona_name}
                      onChange={(e) => setFormData({ ...formData, custom_persona_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_persona_description">Description</Label>
                    <Textarea
                      id="custom_persona_description"
                      placeholder="Describe this persona's role and expertise..."
                      value={formData.custom_persona_description}
                      onChange={(e) => setFormData({ ...formData, custom_persona_description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_role_definition">Role Definition</Label>
                    <Textarea
                      id="custom_role_definition"
                      placeholder="Define the role's key responsibilities and expertise areas..."
                      value={formData.custom_role_definition}
                      onChange={(e) => setFormData({ ...formData, custom_role_definition: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Key Responsibilities</Label>
                      <Button size="sm" variant="outline" onClick={addResponsibility}>
                        Add Responsibility
                      </Button>
                    </div>
                    {formData.custom_responsibilities.map((resp, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`Responsibility ${index + 1}`}
                          value={resp}
                          onChange={(e) => updateResponsibility(index, e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeResponsibility(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_communication_guidelines">Communication Guidelines</Label>
                    <Textarea
                      id="custom_communication_guidelines"
                      placeholder="How should this persona communicate? What's their style and tone?"
                      value={formData.custom_communication_guidelines}
                      onChange={(e) => setFormData({ ...formData, custom_communication_guidelines: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 3: Personality */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Communication Style</Label>
                <Select
                  value={formData.personality_traits.communication_style}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      personality_traits: { ...formData.personality_traits, communication_style: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="empathetic">Empathetic</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="consultative">Consultative</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Response Length</Label>
                <Select
                  value={formData.personality_traits.response_length}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      personality_traits: { ...formData.personality_traits, response_length: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Empathy Level</Label>
                <Select
                  value={formData.personality_traits.empathy_level}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      personality_traits: { ...formData.personality_traits, empathy_level: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="very_high">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Formality</Label>
                <Select
                  value={formData.personality_traits.formality}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      personality_traits: { ...formData.personality_traits, formality: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="very_formal">Very Formal</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="very_casual">Very Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Expertise Depth</Label>
                <Select
                  value={formData.personality_traits.expertise_depth}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      personality_traits: { ...formData.personality_traits, expertise_depth: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Proactivity</Label>
                <Select
                  value={formData.personality_traits.proactivity}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      personality_traits: { ...formData.personality_traits, proactivity: value }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reactive">Reactive</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="proactive">Proactive</SelectItem>
                    <SelectItem value="very_proactive">Very Proactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 4: Context */}
          {currentStep === 4 && (
            <>
              {/* Smart Fill Section */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Smart Fill (Optional)</CardTitle>
                  </div>
                  <CardDescription>
                    Enter your company or product website URL to automatically fill context fields using AI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="smart_fill_url" className="sr-only">Website URL</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="smart_fill_url"
                          placeholder="https://yourcompany.com"
                          value={smartFillUrl}
                          onChange={(e) => setSmartFillUrl(e.target.value)}
                          className="pl-9"
                          disabled={smartFillLoading}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSmartFill()
                            }
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSmartFill}
                      disabled={smartFillLoading || !smartFillUrl.trim()}
                      className="gap-2"
                    >
                      {smartFillLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Smart Fill
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 We'll analyze the website and extract company info, product details, and USPs to fill the form below
                  </p>
                </CardContent>
              </Card>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or fill manually
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  placeholder="What is the purpose of this persona?"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_one_liner">Product One-Liner</Label>
                <Input
                  id="product_one_liner"
                  placeholder="Brief description of your product/service"
                  value={formData.product_one_liner}
                  onChange={(e) => setFormData({ ...formData, product_one_liner: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_description">Product Description</Label>
                <Textarea
                  id="product_description"
                  placeholder="Detailed description of your product/service..."
                  value={formData.product_description}
                  onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Unique Selling Points</Label>
                  <Button size="sm" variant="outline" onClick={addUSP}>
                    Add USP
                  </Button>
                </div>
                {formData.unique_selling_points.map((usp, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`USP ${index + 1}`}
                      value={usp}
                      onChange={(e) => updateUSP(index, e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeUSP(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_persona">Target Persona</Label>
                <Input
                  id="target_persona"
                  placeholder="Who is this persona targeting?"
                  value={formData.target_persona}
                  onChange={(e) => setFormData({ ...formData, target_persona: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conversation_goal">Conversation Goal</Label>
                <Input
                  id="conversation_goal"
                  placeholder="What should conversations achieve?"
                  value={formData.conversation_goal}
                  onChange={(e) => setFormData({ ...formData, conversation_goal: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred_cta">Preferred Call-to-Action</Label>
                <Input
                  id="preferred_cta"
                  placeholder="e.g., Schedule a demo, Learn more, etc."
                  value={formData.preferred_cta}
                  onChange={(e) => setFormData({ ...formData, preferred_cta: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Step 5: Knowledge Base */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Knowledge Base (Optional)</p>
                <p className="text-sm mt-2">
                  Knowledge base upload will be available after creating the persona.
                </p>
                <p className="text-sm mt-1">
                  You'll be able to add documents, links, and context to enhance AI responses.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 || loading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < STEPS.length ? (
          <Button onClick={handleNext} disabled={loading}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Persona'}
            <Check className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
