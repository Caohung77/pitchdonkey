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

const DEFAULT_WEIGHTS = {
  icpFit: 0.4,
  engagement: 0.25,
  recency: 0.2,
  deliverability: 0.1,
  enrichment: 0.05,
}

const DEFAULT_SEGMENT_CONFIG = {
  filters: {
    industries: [] as string[],
    companySizes: [] as string[],
    countries: [] as string[],
    roles: [] as string[],
    keywords: [] as string[],
    includeTags: [] as string[],
    excludeTags: [] as string[],
    customFields: [] as Array<{ key: string; values: string[] }>,
  },
  dataSignals: {
    minEngagementScore: 0,
    minOpens: 0,
    minClicks: 0,
    minReplies: 0,
    maxBounceRate: 0.25,
    recencyDays: 180,
    deliverabilityScore: 0.7,
  },
  advancedRules: {
    excludeOptedOut: true,
    excludeStatuses: ['bounced', 'unsubscribed'] as string[],
    cooldownDays: 7,
    excludeWithoutEmail: true,
    excludeMissingCompany: false,
  },
  schedule: {
    mode: 'manual' as 'manual' | 'daily' | 'weekly' | 'webhook',
    time: '09:00',
    timezone: 'UTC',
    dayOfWeek: 1,
  },
  threshold: 0.55,
  limit: 100,
}

const EMPTY_KNOWLEDGE_FORM = {
  type: 'text' as 'text' | 'link' | 'pdf' | 'doc' | 'html',
  title: '',
  description: '',
  content: '',
  url: '',
}

interface AgentFormState {
  name: string
  status: 'draft' | 'active' | 'inactive'
  purpose: string
  tone: string
  sender_name: string
  sender_role: string
  company_name: string
  product_one_liner: string
  product_description: string
  unique_selling_points: string[]
  target_persona: string
  conversation_goal: string
  preferred_cta: string
  follow_up_strategy: string
  custom_prompt: string
  prompt_override: string
  segment_config: typeof DEFAULT_SEGMENT_CONFIG
  quality_weights: typeof DEFAULT_WEIGHTS
  settings: Record<string, any>
}

interface KnowledgeEntry {
  id: string
  recordId?: string
  type: 'pdf' | 'doc' | 'text' | 'link' | 'html'
  title: string
  description?: string
  content?: string
  url?: string
  embedding_status?: string
  isLocal?: boolean
}

interface KnowledgeFormState {
  type: 'pdf' | 'doc' | 'text' | 'link' | 'html'
  title: string
  description?: string
  content?: string
  url?: string
}

interface TestFormState {
  mode: 'reply' | 'outbound'
  sampleContact: {
    first_name: string
    last_name: string
    company: string
    role: string
    industry: string
    pain_point: string
  }
  incomingMessage: string
  subjectHint: string
}

const parseListInput = (value: string) =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const listToMultiline = (values: string[] | undefined) =>
  (values && values.length > 0 ? values.join('\n') : '')

const buildFormFromAgent = (agent?: OutreachAgent | null): AgentFormState => {
  if (!agent) {
    return {
      name: '',
      status: 'draft',
      purpose: '',
      tone: 'friendly',
      sender_name: '',
      sender_role: '',
      company_name: '',
      product_one_liner: '',
      product_description: '',
      unique_selling_points: [],
      target_persona: '',
      conversation_goal: 'Book a call',
      preferred_cta: 'Schedule a 15-min demo',
      follow_up_strategy: '3 days',
      custom_prompt: '',
      prompt_override: '',
      segment_config: JSON.parse(JSON.stringify(DEFAULT_SEGMENT_CONFIG)),
      quality_weights: { ...DEFAULT_WEIGHTS },
      settings: {},
    }
  }

  const config = agent.segment_config || DEFAULT_SEGMENT_CONFIG

  return {
    name: agent.name,
    status: agent.status,
    purpose: agent.purpose || '',
    tone: agent.tone || 'friendly',
    sender_name: agent.sender_name || '',
    sender_role: agent.sender_role || '',
    company_name: agent.company_name || '',
    product_one_liner: agent.product_one_liner || '',
    product_description: agent.product_description || '',
    unique_selling_points: agent.unique_selling_points || [],
    target_persona: agent.target_persona || '',
    conversation_goal: agent.conversation_goal || '',
    preferred_cta: agent.preferred_cta || '',
    follow_up_strategy: agent.follow_up_strategy || '3 days',
    custom_prompt: agent.custom_prompt || '',
    prompt_override: agent.prompt_override || '',
    segment_config: {
      filters: {
        ...DEFAULT_SEGMENT_CONFIG.filters,
        ...(config.filters || {}),
        industries: config.filters?.industries || [],
        companySizes: config.filters?.companySizes || [],
        countries: config.filters?.countries || [],
        roles: config.filters?.roles || [],
        keywords: config.filters?.keywords || [],
        includeTags: config.filters?.includeTags || [],
        excludeTags: config.filters?.excludeTags || [],
        customFields: config.filters?.customFields || [],
      },
      dataSignals: {
        ...DEFAULT_SEGMENT_CONFIG.dataSignals,
        ...(config.dataSignals || {}),
      },
      advancedRules: {
        ...DEFAULT_SEGMENT_CONFIG.advancedRules,
        ...(config.advancedRules || {}),
      },
      schedule: {
        ...DEFAULT_SEGMENT_CONFIG.schedule,
        ...(config.schedule || {}),
      },
      threshold: config.threshold ?? DEFAULT_SEGMENT_CONFIG.threshold,
      limit: config.limit ?? DEFAULT_SEGMENT_CONFIG.limit,
    },
    quality_weights: {
      ...DEFAULT_WEIGHTS,
      ...(agent.quality_weights || {}),
    },
    settings: (agent.settings as Record<string, any>) || {},
  }
}

const buildDefaultTestForm = (): TestFormState => ({
  mode: 'reply',
  sampleContact: {
    first_name: '',
    last_name: '',
    company: '',
    role: '',
    industry: '',
    pain_point: '',
  },
  incomingMessage: '',
  subjectHint: '',
})

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

interface AgentWizardProps {
  open: boolean
  mode: 'create' | 'edit'
  agent: OutreachAgent | null
  initialStep?: number
  onClose: () => void
  onSaved: (agent: OutreachAgent, mode: 'create' | 'edit') => void
}

function AgentWizard({ open, mode, agent, initialStep = 0, onClose, onSaved }: AgentWizardProps) {
  const [step, setStep] = useState(initialStep)
  const [form, setForm] = useState<AgentFormState>(buildFormFromAgent(agent))
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeEntry[]>([])
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>({ ...EMPTY_KNOWLEDGE_FORM })
  const [knowledgeError, setKnowledgeError] = useState('')
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [segmentPreview, setSegmentPreview] = useState<SegmentPreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [testForm, setTestForm] = useState<TestFormState>(buildDefaultTestForm())
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState('')
  const [testResult, setTestResult] = useState<{ subject: string; body: string; highlights: string[] } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [overrideEnabled, setOverrideEnabled] = useState(Boolean(form.prompt_override))

  const { addToast } = useToast()

  const steps = useMemo(
    () => [
      { title: 'Identity', description: 'Agent name, sender identity, and tone.' },
      { title: 'Product & Goals', description: 'What the agent is selling and how they should steer conversations.' },
      { title: 'Knowledge Base', description: 'Documents, links, and snippets the agent should reference.' },
      { title: 'Segment Definition', description: 'Who to target, signals to weight, and scoring controls.' },
      { title: 'Prompts', description: 'Fine-tune instructions or override the default prompt.' },
      { title: 'Preview & Test', description: 'Generate drafts and review scoring output.' },
    ],
    []
  )

  useEffect(() => {
    if (!open) return

    setStep(initialStep)
    const initialForm = buildFormFromAgent(agent)
    setForm(initialForm)
    setKnowledgeForm({ ...EMPTY_KNOWLEDGE_FORM })
    setKnowledgeError('')
    setSegmentPreview(null)
    setPreviewError('')
    setTestForm(buildDefaultTestForm())
    setTestError('')
    setTestResult(null)
    setOverrideEnabled(Boolean(initialForm.prompt_override))
    setKnowledgeItems([])

    if (mode === 'create') {
      setKnowledgeItems([])
    }
  }, [open, agent, initialStep, mode])

  useEffect(() => {
    if (!open || mode !== 'edit' || !agent?.id) {
      return
    }

    let cancelled = false

    const loadKnowledge = async () => {
      try {
        setKnowledgeLoading(true)
        const response = await ApiClient.get(`/api/outreach-agents/${agent.id}/knowledge`)
        if (cancelled) return
        const items = (response.data || []).map((item: any) => ({
          id: item.id,
          recordId: item.id,
          type: item.type,
          title: item.title,
          description: item.description || '',
          content: item.content || '',
          url: item.url || '',
          embedding_status: item.embedding_status,
        })) as KnowledgeEntry[]
        setKnowledgeItems(items)
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load knowledge items:', err)
          setKnowledgeError('Unable to load knowledge base for this agent.')
        }
      } finally {
        if (!cancelled) {
          setKnowledgeLoading(false)
        }
      }
    }

    loadKnowledge()

    return () => {
      cancelled = true
    }
  }, [open, mode, agent?.id])

  const updateForm = (updates: Partial<AgentFormState>) => {
    setForm((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  const updateSegmentFilters = (field: keyof typeof DEFAULT_SEGMENT_CONFIG.filters, value: string) => {
    const list = parseListInput(value)
    setForm((prev) => ({
      ...prev,
      segment_config: {
        ...prev.segment_config,
        filters: {
          ...prev.segment_config.filters,
          [field]: list,
        },
      },
    }))
  }

  const updateQualityWeight = (field: keyof typeof DEFAULT_WEIGHTS, raw: string) => {
    const numeric = Number(raw)
    setForm((prev) => ({
      ...prev,
      quality_weights: {
        ...prev.quality_weights,
        [field]: Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : prev.quality_weights[field],
      },
    }))
  }

  const handleKnowledgeAdd = async () => {
    if (!knowledgeForm.title.trim()) {
      setKnowledgeError('Knowledge title is required.')
      return
    }

    if ((knowledgeForm.type === 'link' || knowledgeForm.type === 'pdf' || knowledgeForm.type === 'doc') && !knowledgeForm.url?.trim()) {
      setKnowledgeError('A URL is required for link or document knowledge items.')
      return
    }

    setKnowledgeError('')

    if (mode === 'edit' && agent?.id) {
      try {
        setKnowledgeLoading(true)
        const payload: Record<string, any> = {
          type: knowledgeForm.type,
          title: knowledgeForm.title,
          description: knowledgeForm.description || undefined,
          content: knowledgeForm.type === 'text' || knowledgeForm.type === 'html' ? knowledgeForm.content : undefined,
          url: knowledgeForm.url || undefined,
        }
        const response = await ApiClient.post(`/api/outreach-agents/${agent.id}/knowledge`, payload)
        const created = response.data
        setKnowledgeItems((prev) => [
          {
            id: created.id,
            recordId: created.id,
            type: created.type,
            title: created.title,
            description: created.description || '',
            content: created.content || '',
            url: created.url || '',
            embedding_status: created.embedding_status,
          },
          ...prev,
        ])
        addToast({ type: 'success', message: 'Knowledge item added' })
        setKnowledgeForm({ ...EMPTY_KNOWLEDGE_FORM })
      } catch (err) {
        console.error('Failed to add knowledge item:', err)
        setKnowledgeError('Could not add knowledge item. Please try again.')
      } finally {
        setKnowledgeLoading(false)
      }
      return
    }

    const localItem: KnowledgeEntry = {
      id: crypto.randomUUID(),
      type: knowledgeForm.type,
      title: knowledgeForm.title,
      description: knowledgeForm.description,
      content: knowledgeForm.content,
      url: knowledgeForm.url,
      isLocal: true,
    }

    setKnowledgeItems((prev) => [localItem, ...prev])
    setKnowledgeForm({ ...EMPTY_KNOWLEDGE_FORM })
  }

  const handleKnowledgeRemove = async (entry: KnowledgeEntry) => {
    if (entry.isLocal || !entry.recordId || !agent?.id) {
      setKnowledgeItems((prev) => prev.filter((item) => item.id !== entry.id))
      return
    }

    try {
      setKnowledgeLoading(true)
      await ApiClient.delete(`/api/outreach-agents/${agent.id}/knowledge/${entry.recordId}`)
      setKnowledgeItems((prev) => prev.filter((item) => item.id !== entry.id))
      addToast({ type: 'success', message: 'Knowledge item removed' })
    } catch (err) {
      console.error('Failed to remove knowledge item:', err)
      setKnowledgeError('Could not delete knowledge item.')
    } finally {
      setKnowledgeLoading(false)
    }
  }

  const handlePreviewSegment = async () => {
    if (mode === 'create' || !agent?.id) {
      setPreviewError('Save the agent before running a preview.')
      return
    }

    try {
      setPreviewLoading(true)
      setPreviewError('')
      const response = await ApiClient.post(`/api/outreach-agents/${agent.id}/segment/preview`, {
        segment_config: form.segment_config,
        quality_weights: form.quality_weights,
        limit: form.segment_config.limit,
        threshold: form.segment_config.threshold,
        persist: false,
      })
      setSegmentPreview(response.data)
    } catch (err) {
      console.error('Failed to preview segment:', err)
      setPreviewError('Unable to generate preview. Adjust filters or try again.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleGenerateTestDraft = async () => {
    if (mode === 'create' || !agent?.id) {
      setTestError('Save the agent before running a draft test.')
      return
    }

    try {
      setTestLoading(true)
      setTestError('')
      const response = await ApiClient.post(`/api/outreach-agents/${agent.id}/test`, {
        mode: testForm.mode,
        sampleContact: testForm.sampleContact,
        incomingMessage: testForm.incomingMessage,
        subjectHint: testForm.subjectHint,
      })
      setTestResult(response.data?.draft)
    } catch (err) {
      console.error('Failed to generate test draft:', err)
      setTestError('Test draft failed. Please try again.')
    } finally {
      setTestLoading(false)
    }
  }

  const goNext = () => setStep((prev) => Math.min(prev + 1, steps.length - 1))
  const goBack = () => setStep((prev) => Math.max(prev - 1, 0))

  const handleSubmit = async () => {
    const payload = {
      name: form.name.trim(),
      status: form.status,
      purpose: form.purpose,
      tone: form.tone,
      sender_name: form.sender_name,
      sender_role: form.sender_role,
      company_name: form.company_name,
      product_one_liner: form.product_one_liner,
      product_description: form.product_description,
      unique_selling_points: form.unique_selling_points,
      target_persona: form.target_persona,
      conversation_goal: form.conversation_goal,
      preferred_cta: form.preferred_cta,
      follow_up_strategy: form.follow_up_strategy,
      custom_prompt: form.custom_prompt,
      prompt_override: form.prompt_override,
      segment_config: form.segment_config,
      quality_weights: form.quality_weights,
      settings: form.settings,
    }

    try {
      setIsSaving(true)
      if (mode === 'create') {
        const response = await ApiClient.post('/api/outreach-agents', payload)
        let created = response.data as OutreachAgent

        const localKnowledge = knowledgeItems.filter((item) => item.isLocal)
        if (localKnowledge.length > 0) {
          for (const entry of localKnowledge) {
            await ApiClient.post(`/api/outreach-agents/${created.id}/knowledge`, {
              type: entry.type,
              title: entry.title,
              description: entry.description,
              content: entry.content,
              url: entry.url,
            })
          }

          const refreshed = await ApiClient.get(`/api/outreach-agents/${created.id}`)
          created = refreshed.data as OutreachAgent
        }

        onSaved(created, mode)
      } else if (agent?.id) {
        const response = await ApiClient.put(`/api/outreach-agents/${agent.id}`, payload)
        onSaved(response.data as OutreachAgent, mode)
      }
    } catch (err) {
      console.error('Failed to save outreach agent:', err)
      addToast({ type: 'error', message: 'Failed to save agent. Check required fields and try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="e.g. Product Marketing Closer"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => updateForm({ status: value as AgentFormState['status'] })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={form.tone} onValueChange={(value) => updateForm({ tone: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Friendly" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="empathetic">Empathetic</SelectItem>
                  <SelectItem value="confident">Confident</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-name">Sender name</Label>
              <Input
                id="sender-name"
                value={form.sender_name}
                onChange={(event) => updateForm({ sender_name: event.target.value })}
                placeholder="e.g. Taylor from Acme"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-role">Sender role</Label>
              <Input
                id="sender-role"
                value={form.sender_role}
                onChange={(event) => updateForm({ sender_role: event.target.value })}
                placeholder="e.g. Head of GTM"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-name">Company</Label>
              <Input
                id="company-name"
                value={form.company_name}
                onChange={(event) => updateForm({ company_name: event.target.value })}
                placeholder="Name shown in signature"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="agent-purpose">Purpose</Label>
              <Textarea
                id="agent-purpose"
                value={form.purpose}
                onChange={(event) => updateForm({ purpose: event.target.value })}
                placeholder="Describe why this agent exists."
                rows={3}
              />
            </div>
          </div>
        )
      case 1:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="product-one-liner">Product one-liner</Label>
              <Input
                id="product-one-liner"
                value={form.product_one_liner}
                onChange={(event) => updateForm({ product_one_liner: event.target.value })}
                placeholder="e.g. We automate warm introduction emails with AI that sounds human."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="product-description">Extended description</Label>
              <Textarea
                id="product-description"
                value={form.product_description}
                onChange={(event) => updateForm({ product_description: event.target.value })}
                placeholder="What should the agent know about positioning, features, or success stories?"
                rows={5}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="unique-selling-points">Unique selling points (one per line)</Label>
              <Textarea
                id="unique-selling-points"
                value={listToMultiline(form.unique_selling_points)}
                onChange={(event) => updateForm({ unique_selling_points: parseListInput(event.target.value) })}
                rows={4}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="target-persona">Target persona</Label>
              <Textarea
                id="target-persona"
                value={form.target_persona}
                onChange={(event) => updateForm({ target_persona: event.target.value })}
                placeholder="Who should this agent resonate with?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversation-goal">Conversation goal</Label>
              <Input
                id="conversation-goal"
                value={form.conversation_goal}
                onChange={(event) => updateForm({ conversation_goal: event.target.value })}
                placeholder="e.g. Book discovery call"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred-cta">Preferred CTA</Label>
              <Input
                id="preferred-cta"
                value={form.preferred_cta}
                onChange={(event) => updateForm({ preferred_cta: event.target.value })}
                placeholder="e.g. Schedule a 15-min walkthrough"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="follow-up">Follow-up cadence</Label>
              <Input
                id="follow-up"
                value={form.follow_up_strategy}
                onChange={(event) => updateForm({ follow_up_strategy: event.target.value })}
                placeholder="e.g. Every 3 days, 3 touches"
              />
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">Add knowledge item</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={knowledgeForm.type} onValueChange={(value) => setKnowledgeForm((prev) => ({ ...prev, type: value as KnowledgeFormState['type'] }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text snippet</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="pdf">PDF (link)</SelectItem>
                      <SelectItem value="doc">Document (link)</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="knowledge-title">Title</Label>
                  <Input
                    id="knowledge-title"
                    value={knowledgeForm.title}
                    onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="e.g. Pricing overview"
                  />
                </div>
                {(knowledgeForm.type === 'text' || knowledgeForm.type === 'html') && (
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="knowledge-content">Content</Label>
                    <Textarea
                      id="knowledge-content"
                      value={knowledgeForm.content}
                      onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, content: event.target.value }))}
                      rows={4}
                      placeholder="Paste the snippet the agent should reference."
                    />
                  </div>
                )}
                {(knowledgeForm.type === 'link' || knowledgeForm.type === 'pdf' || knowledgeForm.type === 'doc') && (
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="knowledge-url">URL</Label>
                    <Input
                      id="knowledge-url"
                      value={knowledgeForm.url}
                      onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, url: event.target.value }))}
                      placeholder="https://"
                    />
                  </div>
                )}
                <div className="md:col-span-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500">Large files should be stored externally and linked here until native uploads are enabled.</div>
                  <Button size="sm" onClick={handleKnowledgeAdd} disabled={knowledgeLoading}>
                    {knowledgeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Add item
                  </Button>
                </div>
                {knowledgeError && (
                  <div className="md:col-span-2 text-sm text-red-600">{knowledgeError}</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <LayoutList className="h-4 w-4" />Current knowledge
              </h3>
              {knowledgeItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-gray-500">
                  No knowledge items yet. Add product briefs, FAQs, case studies, or objection handling snippets.
                </div>
              ) : (
                <div className="space-y-3">
                  {knowledgeItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between rounded-md border border-slate-200 p-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <Badge variant="outline" className="capitalize">{item.type}</Badge>
                          {item.title}
                        </div>
                        {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                            {item.url}
                          </a>
                        )}
                        {item.embedding_status && (
                          <div className="text-[11px] text-gray-500 mt-2">Embedding: {item.embedding_status}</div>
                        )}
                        {item.isLocal && (
                          <div className="text-[11px] text-amber-600 mt-2">Will be uploaded after saving the agent.</div>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleKnowledgeRemove(item)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Countries (one per line)</Label>
                <Textarea
                  value={listToMultiline(form.segment_config.filters.countries)}
                  onChange={(event) => updateSegmentFilters('countries', event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Roles / Titles</Label>
                <Textarea
                  value={listToMultiline(form.segment_config.filters.roles)}
                  onChange={(event) => updateSegmentFilters('roles', event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Keywords</Label>
                <Textarea
                  value={listToMultiline(form.segment_config.filters.keywords)}
                  onChange={(event) => updateSegmentFilters('keywords', event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Include tags</Label>
                <Textarea
                  value={listToMultiline(form.segment_config.filters.includeTags)}
                  onChange={(event) => updateSegmentFilters('includeTags', event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Exclude tags</Label>
                <Textarea
                  value={listToMultiline(form.segment_config.filters.excludeTags)}
                  onChange={(event) => updateSegmentFilters('excludeTags', event.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Min engagement score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.segment_config.dataSignals.minEngagementScore ?? ''}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    segment_config: {
                      ...prev.segment_config,
                      dataSignals: {
                        ...prev.segment_config.dataSignals,
                        minEngagementScore: Number(event.target.value || 0),
                      },
                    },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Recency window (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={form.segment_config.dataSignals.recencyDays ?? 180}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    segment_config: {
                      ...prev.segment_config,
                      dataSignals: {
                        ...prev.segment_config.dataSignals,
                        recencyDays: Number(event.target.value || 0),
                      },
                    },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Score threshold</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.segment_config.threshold ?? 0.55}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    segment_config: {
                      ...prev.segment_config,
                      threshold: Number(event.target.value || 0),
                    },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact limit</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={form.segment_config.limit ?? 100}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    segment_config: {
                      ...prev.segment_config,
                      limit: Number(event.target.value || 0),
                    },
                  }))}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <GaugeCircle className="h-4 w-4" />Quality weights
              </div>
              <div className="grid gap-4 md:grid-cols-5">
                {Object.entries(form.quality_weights).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={value}
                      onChange={(event) => updateQualityWeight(key as keyof typeof DEFAULT_WEIGHTS, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">Weights are normalized automatically and determine how much ICP fit vs. engagement drives the final score.</p>
            </div>

            <div className="flex items-start justify-between rounded-lg border border-slate-200 p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Target className="h-4 w-4" />Segment preview
                </div>
                <p className="text-xs text-gray-500 mt-1">Use the latest configuration to score contacts. Preview requires the agent to be saved.</p>
              </div>
              <Button size="sm" variant="outline" onClick={handlePreviewSegment} disabled={previewLoading || mode === 'create'}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Preview contacts
              </Button>
            </div>
            {previewError && <div className="text-sm text-red-600">{previewError}</div>}
            {segmentPreview && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>{segmentPreview.total_matched} contacts above threshold</span>
                  <span>Limit {segmentPreview.limit}</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Reasons</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segmentPreview.contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <div className="text-sm font-medium text-gray-900">{contact.full_name}</div>
                            <div className="text-xs text-gray-500">{contact.email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-700">{contact.company || '—'}</div>
                            <div className="text-xs text-gray-500">{contact.position || contact.country || ''}</div>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-gray-900">{contact.score.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-gray-600">{contact.reasons.join('; ')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )
      case 4:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <PenLine className="h-4 w-4" />Base prompt context
              </div>
              <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-gray-600">
                The agent prompt includes identity, product data, and knowledge extracts automatically. Use custom instructions to enforce tone or guardrails. Enable advanced override only if you need full control over the system prompt.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-prompt">Custom instructions</Label>
              <Textarea
                id="custom-prompt"
                value={form.custom_prompt}
                onChange={(event) => updateForm({ custom_prompt: event.target.value })}
                rows={6}
                placeholder="e.g. Always mention the latest case study in the second sentence. Avoid discounts in the first reply."
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
              <div>
                <div className="text-sm font-medium text-gray-900">Advanced override</div>
                <p className="text-xs text-gray-500">Replace the entire system prompt. Use cautiously — none of the defaults will apply.</p>
              </div>
              <Switch
                checked={overrideEnabled}
                onCheckedChange={(checked) => {
                  setOverrideEnabled(checked)
                  if (!checked) {
                    updateForm({ prompt_override: '' })
                  }
                }}
              />
            </div>

            {overrideEnabled && (
              <div className="space-y-2">
                <Label htmlFor="prompt-override">Prompt override</Label>
                <Textarea
                  id="prompt-override"
                  value={form.prompt_override}
                  onChange={(event) => updateForm({ prompt_override: event.target.value })}
                  rows={8}
                  placeholder="Paste the full system prompt to use for this agent."
                />
              </div>
            )}
          </div>
        )
      case 5:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Sparkles className="h-4 w-4" />Generate draft
              </div>
              <p className="text-xs text-gray-500 mt-1">Provide a sample reply or contact details to see how the agent responds. Available after the agent is saved.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={testForm.mode} onValueChange={(value) => setTestForm((prev) => ({ ...prev, mode: value as TestFormState['mode'] }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="reply" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reply">Inbound reply</SelectItem>
                      <SelectItem value="outbound">Outbound opener</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject-hint">Subject hint</Label>
                  <Input
                    id="subject-hint"
                    value={testForm.subjectHint}
                    onChange={(event) => setTestForm((prev) => ({ ...prev, subjectHint: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact first name</Label>
                  <Input
                    value={testForm.sampleContact.first_name}
                    onChange={(event) => setTestForm((prev) => ({
                      ...prev,
                      sampleContact: { ...prev.sampleContact, first_name: event.target.value },
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact role</Label>
                  <Input
                    value={testForm.sampleContact.role}
                    onChange={(event) => setTestForm((prev) => ({
                      ...prev,
                      sampleContact: { ...prev.sampleContact, role: event.target.value },
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={testForm.sampleContact.company}
                    onChange={(event) => setTestForm((prev) => ({
                      ...prev,
                      sampleContact: { ...prev.sampleContact, company: event.target.value },
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    value={testForm.sampleContact.industry}
                    onChange={(event) => setTestForm((prev) => ({
                      ...prev,
                      sampleContact: { ...prev.sampleContact, industry: event.target.value },
                    }))}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Pain point / context</Label>
                  <Textarea
                    value={testForm.sampleContact.pain_point}
                    onChange={(event) => setTestForm((prev) => ({
                      ...prev,
                      sampleContact: { ...prev.sampleContact, pain_point: event.target.value },
                    }))}
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Incoming message (for replies)</Label>
                  <Textarea
                    value={testForm.incomingMessage}
                    onChange={(event) => setTestForm((prev) => ({ ...prev, incomingMessage: event.target.value }))}
                    rows={4}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={handleGenerateTestDraft} disabled={testLoading || mode === 'create'}>
                  {testLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Generate draft
                </Button>
              </div>
              {testError && <div className="text-sm text-red-600 mt-2">{testError}</div>}
              {testResult && (
                <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">Subject: {testResult.subject}</div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">{testResult.body}</pre>
                  <div className="flex flex-wrap gap-2">
                    {testResult.highlights.map((highlight) => (
                      <Badge key={highlight} variant="outline">{highlight}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            {mode === 'create' ? 'Create outreach agent' : 'Edit outreach agent'}
          </DialogTitle>
          <DialogDescription>
            Step {step + 1} of {steps.length} · {steps[step].title} — {steps[step].description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            {steps.map((item, index) => (
              <div key={item.title} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${index === step ? 'bg-blue-600 text-white' : index < step ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && <div className={`h-px w-8 ${index < step ? 'bg-blue-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          {renderStep()}
        </div>

        <DialogFooter className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500">
            Progress {step + 1}/{steps.length}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goBack} disabled={step === 0 || isSaving}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={goNext} disabled={isSaving}>
                Next<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Save agent
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function OutreachAgentsPage() {
  return (
    <ToastProvider>
      <OutreachAgentsContent />
    </ToastProvider>
  )
}
