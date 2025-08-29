'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface EnrichmentButtonProps {
  contactId: string
  hasWebsite: boolean
  currentStatus?: 'pending' | 'completed' | 'failed' | null
  onEnrichmentComplete?: () => void
  size?: 'sm' | 'default'
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
}

export function EnrichmentButton({
  contactId,
  hasWebsite,
  currentStatus,
  onEnrichmentComplete,
  size = 'default',
  variant = 'outline',
  className = ''
}: EnrichmentButtonProps) {
  const [isEnriching, setIsEnriching] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)

  const handleEnrichment = async () => {
    if (!hasWebsite) {
      setError('No website URL found for this contact')
      return
    }

    setIsEnriching(true)
    setError(null)

    try {
      console.log(`🚀 Starting enrichment for contact ${contactId}`)

      const response = await ApiClient.post(`/api/contacts/${contactId}/enrich`, {})

      if (response.success) {
        console.log('✅ Enrichment completed successfully:', response)
        setStatus('completed')
        setError(null)
        
        // Call the completion callback
        if (onEnrichmentComplete) {
          onEnrichmentComplete()
        }
        
        // Show success message briefly
        setTimeout(() => setError(null), 3000)
        
      } else {
        console.error('❌ Enrichment failed:', response.error)
        setStatus('failed')
        setError(response.error || 'Failed to enrich contact')
      }

    } catch (error: any) {
      console.error('❌ Enrichment error:', error)
      setStatus('failed')
      setError(error.message || 'Failed to enrich contact')
    } finally {
      setIsEnriching(false)
    }
  }

  const handleClearEnrichment = async () => {
    setIsEnriching(true)
    setError(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}/enrich`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setStatus(null)
        setError(null)
        
        if (onEnrichmentComplete) {
          onEnrichmentComplete()
        }
      } else {
        setError('Failed to clear enrichment data')
      }

    } catch (error: any) {
      console.error('❌ Clear enrichment error:', error)
      setError('Failed to clear enrichment data')
    } finally {
      setIsEnriching(false)
    }
  }

  // Don't show button if no website
  if (!hasWebsite) {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="text-xs">
          No website
        </Badge>
      </div>
    )
  }

  // Show status badges for completed/failed states
  if (status === 'completed') {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Enriched
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearEnrichment}
          disabled={isEnriching}
          className="text-xs px-2 py-1 h-6"
          title="Re-analyze website"
        >
          <RefreshCw className={`h-3 w-3 ${isEnriching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEnrichment}
          disabled={isEnriching}
          className="text-xs px-2 py-1 h-6"
          title="Retry enrichment"
        >
          <RefreshCw className={`h-3 w-3 ${isEnriching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    )
  }

  // Show main enrichment button
  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        size={size}
        onClick={handleEnrichment}
        disabled={isEnriching || status === 'pending'}
        className={className}
      >
        {isEnriching || status === 'pending' ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isEnriching ? 'Analyzing...' : 'Processing...'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Enrich Information
          </>
        )}
      </Button>

      {error && (
        <div className="text-xs text-red-600 mt-1">
          {error}
        </div>
      )}
    </div>
  )
}