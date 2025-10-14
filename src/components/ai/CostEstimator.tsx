'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Calculator,
  DollarSign,
  Zap,
  Users,
  Clock
} from 'lucide-react'

interface CostEstimate {
  estimatedTokens: number
  estimatedCost: number
  provider: string
  processingTime: number
}

interface CostEstimatorProps {
  contactCount?: number
  contentLength?: number
  provider?: 'openai' | 'anthropic'
  onEstimateChange?: (estimate: CostEstimate) => void
}

export default function CostEstimator({ 
  contactCount = 0, 
  contentLength = 0, 
  provider = 'openai',
  onEstimateChange 
}: CostEstimatorProps) {
  const [contacts, setContacts] = useState(contactCount)
  const [content, setContent] = useState(contentLength)
  const [selectedProvider, setSelectedProvider] = useState(provider)
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (contacts > 0 && content > 0) {
      calculateEstimate()
    }
  }, [contacts, content, selectedProvider])

  const calculateEstimate = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_length: content,
          contact_count: contacts,
          provider: selectedProvider,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newEstimate = data.data
        setEstimate(newEstimate)
        
        if (onEstimateChange) {
          onEstimateChange(newEstimate)
        }
      }
    } catch (error) {
      console.error('Error calculating estimate:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  }

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours}h ${remainingMinutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>AI Cost Estimator</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contacts">Number of Contacts</Label>
              <Input
                id="contacts"
                type="number"
                value={contacts}
                onChange={(e) => setContacts(parseInt(e.target.value) || 0)}
                placeholder="Enter contact count"
                min="1"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Content Length (characters)</Label>
              <Input
                id="content"
                type="number"
                value={content}
                onChange={(e) => setContent(parseInt(e.target.value) || 0)}
                placeholder="Enter content length"
                min="1"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="provider">AI Provider</Label>
              <select
                id="provider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as 'openai' | 'anthropic')}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="openai">OpenAI GPT-4</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={calculateEstimate} 
            disabled={loading || contacts === 0 || content === 0}
            className="w-full"
          >
            {loading ? 'Calculating...' : 'Calculate Estimate'}
          </Button>
        </CardContent>
      </Card>

      {estimate && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">{contacts.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Contacts</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold">{formatTokens(estimate.estimatedTokens)}</div>
                <div className="text-sm text-gray-600">Est. Tokens</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold">{formatCost(estimate.estimatedCost)}</div>
                <div className="text-sm text-gray-600">Est. Cost</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-2xl font-bold">{formatTime(estimate.processingTime)}</div>
                <div className="text-sm text-gray-600">Est. Time</div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Provider:</strong> {estimate.provider.toUpperCase()}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Estimates are based on average token usage and may vary depending on content complexity and personalization requirements.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}