'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles, MessageSquare, Mail, Users, Bot, TrendingUp, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { AIPersona } from '@/lib/ai-personas'

export default function AIPersonasPage() {
  const router = useRouter()
  const [personas, setPersonas] = useState<AIPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all')

  useEffect(() => {
    loadPersonas()
  }, [filter])

  async function loadPersonas() {
    try {
      setLoading(true)
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const response = await ApiClient.get(`/api/ai-personas${params}`)

      if (response.success) {
        setPersonas(response.data)
      }
    } catch (error: any) {
      toast.error('Failed to load AI personas')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const personaTypeLabels: Record<string, string> = {
    customer_support: 'Customer Support',
    sales_rep: 'Sales Representative',
    sales_development: 'Sales Development',
    account_manager: 'Account Manager',
    consultant: 'Consultant',
    technical_specialist: 'Technical Specialist',
    success_manager: 'Success Manager',
    marketing_specialist: 'Marketing Specialist',
    custom: 'Custom Persona'
  }

  const personaTypeIcons: Record<string, any> = {
    customer_support: MessageSquare,
    sales_rep: TrendingUp,
    sales_development: Users,
    account_manager: Users,
    consultant: Sparkles,
    technical_specialist: Bot,
    success_manager: MessageSquare,
    marketing_specialist: Mail,
    custom: Sparkles
  }

  function getPersonaTypeIcon(type: string) {
    const Icon = personaTypeIcons[type] || Bot
    return <Icon className="h-5 w-5" />
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            AI Personas
          </h1>
          <p className="text-muted-foreground mt-2">
            Create and manage AI-powered employee personas with unique personalities
          </p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => router.push('/dashboard/ai-personas/create')}>
          <Plus className="h-4 w-4" />
          Create Persona
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Personas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{personas.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {personas.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Chats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {personas.reduce((sum, p) => sum + (p.total_chats || 0), 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Emails Handled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {personas.reduce((sum, p) => sum + (p.total_emails_handled || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All Personas</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-20 w-20 rounded-full bg-muted" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : personas.length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center text-center gap-4">
                <Bot className="h-16 w-16 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No personas found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first AI persona to get started
                  </p>
                </div>
                <Button className="gap-2" onClick={() => router.push('/dashboard/ai-personas/create')}>
                  <Plus className="h-4 w-4" />
                  Create Your First Persona
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personas.map((persona) => (
                <PersonaCard key={persona.id} persona={persona} onUpdate={loadPersonas} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PersonaCard({ persona, onUpdate }: { persona: AIPersona; onUpdate: () => void }) {
  const router = useRouter()
  const personaTypeLabels: Record<string, string> = {
    customer_support: 'Customer Support',
    sales_rep: 'Sales Rep',
    sales_development: 'SDR',
    account_manager: 'Account Manager',
    consultant: 'Consultant',
    technical_specialist: 'Technical',
    success_manager: 'Success Manager',
    marketing_specialist: 'Marketing',
    custom: 'Custom'
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    inactive: 'bg-red-100 text-red-800 border-red-200'
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={() => router.push(`/dashboard/ai-personas/${persona.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            {persona.avatar_url ? (
              <AvatarImage src={persona.avatar_url} alt={persona.name} />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {getInitials(persona.sender_name || persona.name)}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg truncate">
                  {persona.sender_name || persona.name}
                </CardTitle>
                <CardDescription className="text-sm">
                  {persona.sender_role || personaTypeLabels[persona.persona_type]}
                </CardDescription>
              </div>
              <Badge className={statusColors[persona.status]} variant="outline">
                {persona.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Persona Type */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="h-4 w-4" />
          <span>{personaTypeLabels[persona.persona_type]}</span>
        </div>

        {/* Personality Traits */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Personality</p>
          <div className="flex flex-wrap gap-1">
            {persona.personality_traits.communication_style && (
              <Badge variant="secondary" className="text-xs">
                {persona.personality_traits.communication_style}
              </Badge>
            )}
            {persona.personality_traits.empathy_level && (
              <Badge variant="secondary" className="text-xs">
                {persona.personality_traits.empathy_level} empathy
              </Badge>
            )}
            {persona.personality_traits.expertise_depth && (
              <Badge variant="secondary" className="text-xs">
                {persona.personality_traits.expertise_depth}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <MessageSquare className="h-3 w-3" />
              <span>Chats</span>
            </div>
            <p className="text-lg font-semibold">{persona.total_chats || 0}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Mail className="h-3 w-3" />
              <span>Emails</span>
            </div>
            <p className="text-lg font-semibold">{persona.total_emails_handled || 0}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {persona.chat_enabled && (
            <Button variant="outline" size="sm" className="flex-1 gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1 gap-2">
            <Mail className="h-4 w-4" />
            Test Email
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
