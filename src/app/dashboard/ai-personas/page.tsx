'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MessageSquare, Mail, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { AIPersona } from '@/lib/ai-personas'
import { PersonaFlipCard } from '@/components/ai-personas/persona-flip-card'

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
                <PersonaFlipCard key={persona.id} persona={persona} onUpdate={loadPersonas} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
