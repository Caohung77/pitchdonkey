'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiClient } from '@/lib/api-client'
import type { OutreachAgent, SegmentPreviewResult } from '@/lib/outreach-agents'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Copy,
  FileText,
  GaugeCircle,
  LayoutList,
  Loader2,
  MoreHorizontal,
  PenLine,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'

function OutreachAgentsContent() {
  const [agents, setAgents] = useState<OutreachAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create')
  const [wizardInitialStep, setWizardInitialStep] = useState(0)
  const [activeAgent, setActiveAgent] = useState<OutreachAgent | null>(null)
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null)
  const [duplicatingAgentId, setDuplicatingAgentId] = useState<string | null>(null)

  const { addToast } = useToast()

  const fetchAgents = async () => {
    try {
      setIsLoading(true)
      setError('')
      const response = await ApiClient.get('/api/outreach-agents')
      setAgents(response.data || [])
    } catch (err) {
      console.error('Failed to load outreach agents:', err)
      setError('Unable to load outreach agents. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  const handleCreateAgent = () => {
    setWizardMode('create')
    setActiveAgent(null)
    setWizardInitialStep(0)
    setWizardOpen(true)
  }

  const handleEditAgent = (agent: OutreachAgent, step = 0) => {
    setWizardMode('edit')
    setActiveAgent(agent)
    setWizardInitialStep(step)
    setWizardOpen(true)
  }

  const handleDuplicateAgent = async (agent: OutreachAgent) => {
    try {
      setDuplicatingAgentId(agent.id)
      const response = await ApiClient.post(`/api/outreach-agents/${agent.id}/duplicate`, {})
      const cloned = response.data as OutreachAgent
      setAgents(prev => [cloned, ...prev])
      addToast({ type: 'success', message: `Duplicated ${agent.name}` })
    } catch (err) {
      console.error('Failed to duplicate agent:', err)
      addToast({ type: 'error', message: 'Could not duplicate agent. Please try again.' })
    } finally {
      setDuplicatingAgentId(null)
    }
  }

  const handleDeleteAgent = async (agent: OutreachAgent) => {
    if (!confirm(`Are you sure you want to delete ${agent.name}?`)) {
      return
    }

    try {
      setDeletingAgentId(agent.id)
      await ApiClient.delete(`/api/outreach-agents/${agent.id}`)
      setAgents(prev => prev.filter(existing => existing.id !== agent.id))
      addToast({ type: 'success', message: `${agent.name} deleted` })
    } catch (err) {
      console.error('Failed to delete agent:', err)
      addToast({ type: 'error', message: 'Failed to delete agent. Please try again.' })
    } finally {
      setDeletingAgentId(null)
    }
  }

  const handleWizardClosed = () => {
    setWizardOpen(false)
    setActiveAgent(null)
  }

  const handleAgentSaved = (agent: OutreachAgent, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      setAgents(prev => [agent, ...prev])
      addToast({ type: 'success', message: `${agent.name} created` })
    } else {
      setAgents(prev => prev.map(existing => existing.id === agent.id ? agent : existing))
      addToast({ type: 'success', message: `${agent.name} updated` })
    }
    setWizardOpen(false)
    setActiveAgent(null)
  }

  const renderStatusBadge = (agent: OutreachAgent) => {
    const toneMap: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      active: 'bg-emerald-100 text-emerald-700',
      inactive: 'bg-amber-100 text-amber-700',
    }
    return (
      <Badge className={`${toneMap[agent.status] || 'bg-slate-100 text-slate-700'} capitalize`}>{agent.status}</Badge>
    )
  }

  const renderKnowledgeSummary = (agent: OutreachAgent) => {
    const summary = agent.knowledge_summary
    if (!summary) {
      return <span className="text-sm text-gray-500">No docs yet</span>
    }

    return (
      <span className="text-sm text-gray-700">
        {summary.total || 0} items
        {summary.pending ? ` · ${summary.pending} pending` : ''}
      </span>
    )
  }

  const renderSegmentSummary = (agent: OutreachAgent) => {
    const filters = agent.segment_config?.filters || {}
    const pieces: string[] = []
    if (filters.countries && filters.countries.length) {
      pieces.push(`${filters.countries.length} countries`)
    }
    if (filters.roles && filters.roles.length) {
      pieces.push(`${filters.roles.length} roles`)
    }
    if (filters.keywords && filters.keywords.length) {
      pieces.push(`${filters.keywords.length} keywords`)
    }
    if (pieces.length === 0) {
      return <span className="text-sm text-gray-500">All contacts</span>
    }
    return <span className="text-sm text-gray-700">{pieces.join(' · ')}</span>
  }

  const isEmptyState = !isLoading && agents.length === 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Outreach Agents</h1>
          <p className="text-sm text-gray-600">Create and customize AI sales assistants, attach knowledge, and assign them to campaigns.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAgents} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />Refreshing
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />Refresh
              </>
            )}
          </Button>
          <Button onClick={handleCreateAgent}>
            <Plus className="mr-2 h-4 w-4" /> New Agent
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>Each agent carries its own tone, knowledge base, and targeting rules.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading agents...
            </div>
          ) : isEmptyState ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Sparkles className="h-10 w-10 text-blue-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">No agents yet</h2>
                <p className="text-sm text-gray-600">Build your first outreach agent to start drafting replies and filling campaigns automatically.</p>
              </div>
              <Button onClick={handleCreateAgent}>
                <Plus className="mr-2 h-4 w-4" /> Create outreach agent
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Purpose & Tone</TableHead>
                    <TableHead>Knowledge Base</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map(agent => (
                    <TableRow key={agent.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{agent.name}</span>
                          <span className="text-sm text-gray-500">{agent.purpose || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-gray-700 capitalize">Tone: {agent.tone || 'friendly'}</span>
                          <span className="text-xs text-gray-500">Goal: {agent.conversation_goal || 'Book meeting'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{renderKnowledgeSummary(agent)}</TableCell>
                      <TableCell>{renderSegmentSummary(agent)}</TableCell>
                      <TableCell>{renderStatusBadge(agent)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                              <Settings2 className="mr-2 h-4 w-4" />Edit configuration
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditAgent(agent, 5)}>
                              <Sparkles className="mr-2 h-4 w-4" />Preview & test
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateAgent(agent)} disabled={duplicatingAgentId === agent.id}>
                              <Copy className="mr-2 h-4 w-4" />
                              {duplicatingAgentId === agent.id ? 'Duplicating…' : 'Duplicate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteAgent(agent)} disabled={deletingAgentId === agent.id} className="text-red-600 focus:text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingAgentId === agent.id ? 'Deleting…' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AgentWizard
        open={wizardOpen}
        mode={wizardMode}
        agent={activeAgent}
        initialStep={wizardInitialStep}
        onClose={handleWizardClosed}
        onSaved={handleAgentSaved}
      />
    </div>
  )
}

export default function OutreachAgentsPage() {
  return (
    <ToastProvider>
      <OutreachAgentsContent />
    </ToastProvider>
  )
}
