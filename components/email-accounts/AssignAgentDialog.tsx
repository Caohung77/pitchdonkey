'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiClient } from '@/lib/api-client'
import { Bot, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface OutreachAgent {
  id: string
  name: string
  status: 'draft' | 'active' | 'inactive'
  language: 'en' | 'de'
  tone?: string
  purpose?: string
  last_used_at?: string
}

interface AssignedAgent {
  id: string
  name: string
  status: string
  language: string
  tone?: string
  purpose?: string
}

interface EmailAccount {
  id: string
  email: string
  assigned_agent_id?: string | null
  assigned_agent?: AssignedAgent
}

interface AssignAgentDialogProps {
  emailAccount: EmailAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAgentAssigned: () => void
}

export default function AssignAgentDialog({
  emailAccount,
  open,
  onOpenChange,
  onAgentAssigned,
}: AssignAgentDialogProps) {
  const [agents, setAgents] = useState<OutreachAgent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Fetch available agents
  useEffect(() => {
    if (open) {
      fetchAgents()
      // Set initial value
      setSelectedAgentId(emailAccount?.assigned_agent_id || null)
    }
  }, [open, emailAccount])

  const fetchAgents = async () => {
    try {
      setIsLoading(true)
      setError('')
      // Use new AI Personas API instead of legacy outreach-agents
      const response = await ApiClient.get('/api/ai-personas')
      setAgents(response.data || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      setError('Failed to load AI personas')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!emailAccount) return

    try {
      setIsSaving(true)
      setError('')

      await ApiClient.put(`/api/email-accounts/${emailAccount.id}/assign-agent`, {
        agent_id: selectedAgentId,
      })

      onAgentAssigned()
      onOpenChange(false)
    } catch (error) {
      console.error('Error assigning agent:', error)
      setError('Failed to assign agent to mailbox')
    } finally {
      setIsSaving(false)
    }
  }

  const getAgentBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'draft':
        return 'secondary'
      case 'inactive':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getAgentStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-3 w-3" />
      case 'draft':
        return <AlertCircle className="h-3 w-3" />
      case 'inactive':
        return <AlertCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const currentlyAssignedAgent = agents.find(a => a.id === emailAccount?.assigned_agent_id)
  const hasChanges = selectedAgentId !== (emailAccount?.assigned_agent_id || null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Assign AI Persona
          </DialogTitle>
          <DialogDescription>
            Configure which AI persona handles autonomous replies for{' '}
            <span className="font-medium text-foreground">{emailAccount?.email}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center text-sm text-red-800">
                <AlertCircle className="h-4 w-4 mr-2" />
                {error}
              </div>
            </div>
          )}

          {/* Current Assignment Info */}
          {currentlyAssignedAgent && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 mt-0.5 text-blue-600" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-blue-900">Currently Assigned:</p>
                  <p className="text-blue-700">{currentlyAssignedAgent.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getAgentBadgeVariant(currentlyAssignedAgent.status)} className="text-xs">
                      {currentlyAssignedAgent.status}
                    </Badge>
                    {currentlyAssignedAgent.language && (
                      <Badge variant="outline" className="text-xs">
                        {currentlyAssignedAgent.language.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Selection */}
          <div className="space-y-2">
            <Label htmlFor="agent-select">Select AI Persona</Label>
            <Select
              value={selectedAgentId || 'manual'}
              onValueChange={(value) => setSelectedAgentId(value === 'manual' ? null : value)}
              disabled={isLoading || isSaving}
            >
              <SelectTrigger id="agent-select">
                <SelectValue placeholder="Choose an agent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  <div className="flex items-center gap-2">
                    <span>Manual Mode (No Agent)</span>
                  </div>
                </SelectItem>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm">Loading agents...</span>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No AI personas found.{' '}
                    <a href="/dashboard/ai-personas/create" className="text-primary hover:underline">
                      Create one
                    </a>
                  </div>
                ) : (
                  agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <span>{agent.name}</span>
                        <Badge variant={getAgentBadgeVariant(agent.status)} className="text-xs">
                          {agent.status}
                        </Badge>
                        {agent.language && (
                          <Badge variant="outline" className="text-xs">
                            {agent.language.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedAgentId
                ? 'This agent will automatically draft and schedule replies to incoming emails.'
                : 'Replies will require manual handling. No AI agent will be used.'}
            </p>
          </div>

          {/* Selected Agent Info */}
          {selectedAgentId && agents.find((a) => a.id === selectedAgentId) && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">
                    {agents.find((a) => a.id === selectedAgentId)?.name}
                  </p>
                  {agents.find((a) => a.id === selectedAgentId)?.purpose && (
                    <p className="text-muted-foreground text-xs mt-1">
                      {agents.find((a) => a.id === selectedAgentId)?.purpose}
                    </p>
                  )}
                  {agents.find((a) => a.id === selectedAgentId)?.tone && (
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">Tone:</span>{' '}
                      <span className="capitalize">
                        {agents.find((a) => a.id === selectedAgentId)?.tone}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning for non-active agents */}
          {selectedAgentId &&
            agents.find((a) => a.id === selectedAgentId)?.status !== 'active' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2 text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">Agent Not Active</p>
                    <p className="text-xs mt-1">
                      This agent is currently in{' '}
                      <span className="font-medium">
                        {agents.find((a) => a.id === selectedAgentId)?.status}
                      </span>{' '}
                      status. You may want to activate it before assigning it to this mailbox.
                    </p>
                  </div>
                </div>
              </div>
            )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedAgentId ? 'Assign Agent' : 'Remove Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
