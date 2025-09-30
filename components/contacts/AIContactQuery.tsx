'use client'

import { useState, useEffect } from 'react'
import { Search, Sparkles, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ApiClient } from '@/lib/api-client'
import type { Database } from '@/lib/database.types'

type Contact = Database['public']['Tables']['contacts']['Row']
type OutreachAgent = {
  id: string
  name: string
  target_persona?: string | null
  product_one_liner?: string | null
}

interface AIContactQueryProps {
  onResultsReady: (contacts: Contact[]) => void
  onClear: () => void
}

interface QueryResult {
  contacts: Contact[]
  reasoning: string
  functionsUsed: Array<{
    name: string
    parameters: Record<string, any>
    resultCount: number
  }>
  metadata: {
    tokensUsed: number
    executionTimeMs: number
    totalMatches: number
  }
}

const QUERY_SUGGESTIONS = [
  'Show me contacts that best match my product',
  'List all contacts I haven\'t contacted yet',
  'Find engaged contacts ready for follow-up',
  'Show me contacts from Germany with high engagement',
  'Which contacts are decision makers?'
]

export function AIContactQuery({ onResultsReady, onClear }: AIContactQueryProps) {
  const [agents, setAgents] = useState<OutreachAgent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load outreach agents on mount
  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoadingAgents(true)
      const response = await ApiClient.get('/api/outreach-agents')

      // Filter to only active agents
      const activeAgents = response.data?.filter((a: any) => a.status === 'active') || []
      setAgents(activeAgents)

      // Auto-select first agent if available
      if (activeAgents.length > 0) {
        setSelectedAgent(activeAgents[0].id)
      }
    } catch (err) {
      console.error('Failed to load agents:', err)
      setError('Failed to load outreach agents')
    } finally {
      setLoadingAgents(false)
    }
  }

  const handleQuery = async () => {
    if (!selectedAgent) {
      setError('Please select an outreach agent first')
      return
    }

    if (!query.trim()) {
      setError('Please enter a query')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await ApiClient.post('/api/contacts/ai-query', {
        agentId: selectedAgent,
        query: query.trim(),
        maxResults: 100
      })

      if (response.success && response.data) {
        console.log('AI Query Response:', response.data)
        console.log('Functions Used:', response.data.functionsUsed)
        console.log('Reasoning:', response.data.reasoning)

        setResult(response.data)
        onResultsReady(response.data.contacts)
      } else {
        throw new Error(response.error || 'Failed to process query')
      }
    } catch (err) {
      console.error('AI query error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process query. Please try again.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setResult(null)
    setQuery('')
    setError(null)
    onClear()
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleQuery()
    }
  }

  const selectedAgentData = agents.find(a => a.id === selectedAgent)

  return (
    <div className="space-y-4">
      {/* Agent Selector & Query Input */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Agent Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Outreach Agent
            </label>
            <Select
              value={selectedAgent || undefined}
              onValueChange={setSelectedAgent}
              disabled={loadingAgents}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      {agent.product_one_liner && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {agent.product_one_liner}
                        </div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Query Input */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Ask about your contacts
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="e.g., Show me engaged contacts in Germany..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading || !selectedAgent}
                  className="pr-10"
                />
                <Sparkles className="absolute right-3 top-3 h-4 w-4 text-purple-500" />
              </div>
              <Button
                onClick={handleQuery}
                disabled={loading || !selectedAgent || !query.trim()}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Querying...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Query
                  </>
                )}
              </Button>
              {result && (
                <Button onClick={handleClear} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Query Suggestions */}
          {!result && selectedAgentData && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Quick suggestions:</div>
              <div className="flex flex-wrap gap-2">
                {QUERY_SUGGESTIONS.map((suggestion, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {result.metadata.totalMatches} contact{result.metadata.totalMatches === 1 ? '' : 's'} found
                </h3>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                  {result.reasoning}
                </p>
              </div>
              <Badge variant="outline" className="ml-4 flex-shrink-0">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Query
              </Badge>
            </div>

            {/* Functions Used */}
            {result.functionsUsed.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">Query Methods:</div>
                <div className="flex flex-wrap gap-2">
                  {result.functionsUsed.map((func, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {formatFunctionName(func.name)} ({func.resultCount})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="flex gap-4 text-xs text-gray-500 pt-2 border-t">
              <span>⚡ {result.metadata.executionTimeMs}ms</span>
              <span>🎯 {result.metadata.tokensUsed} tokens</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatFunctionName(name: string): string {
  const nameMap: Record<string, string> = {
    query_contacts_basic: 'Profile Filtering',
    query_contacts_by_engagement: 'Engagement',
    query_never_contacted: 'Never Contacted',
    query_contacts_by_agent_fit: 'ICP Fit',
    query_contacts_by_status: 'Status',
    query_contacts_by_recency: 'Recency',
    query_contacts_by_enrichment: 'Enrichment'
  }

  return nameMap[name] || name
}