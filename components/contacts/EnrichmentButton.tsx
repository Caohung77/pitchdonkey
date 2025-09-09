'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, CheckCircle, AlertCircle, RefreshCw, Linkedin } from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface EnrichmentButtonProps {
  contactId: string
  hasWebsite: boolean
  hasLinkedIn?: boolean
  linkedInUrl?: string
  currentStatus?: 'pending' | 'completed' | 'failed' | null
  linkedInStatus?: 'pending' | 'completed' | 'failed' | null
  onEnrichmentComplete?: () => void
  size?: 'sm' | 'default'
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
}

export function EnrichmentButton({
  contactId,
  hasWebsite,
  hasLinkedIn = false,
  linkedInUrl,
  currentStatus,
  linkedInStatus,
  onEnrichmentComplete,
  size = 'default',
  variant = 'outline',
  className = ''
}: EnrichmentButtonProps) {
  const [isEnriching, setIsEnriching] = useState(false)
  const [isLinkedInEnriching, setIsLinkedInEnriching] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)

  const handleWebsiteEnrichment = async () => {
    if (!hasWebsite) {
      setError('No website URL found for this contact')
      return
    }

    setIsEnriching(true)
    setError(null)

    try {
      console.log(`🚀 Starting website enrichment for contact ${contactId}`)

      const response = await ApiClient.post(`/api/contacts/${contactId}/enrich`, {})

      if (response.success) {
        console.log('✅ Website enrichment completed successfully:', response)
        setStatus('completed')
        setError(null)
        
        if (onEnrichmentComplete) {
          onEnrichmentComplete()
        }
        
      } else {
        console.error('❌ Website enrichment failed:', response.error)
        setStatus('failed')
        setError(response.error || 'Failed to enrich from website')
      }

    } catch (error: any) {
      console.error('❌ Website enrichment error:', error)
      setStatus('failed')
      setError(error.message || 'Failed to enrich from website')
    } finally {
      setIsEnriching(false)
    }
  }

  const handleLinkedInEnrichment = async () => {
    console.log('🔍 LinkedIn enrichment button clicked', { 
      contactId, 
      hasLinkedIn, 
      linkedInUrl, 
      linkedInStatus 
    })
    
    if (!hasLinkedIn) {
      console.warn('❌ No LinkedIn URL found for this contact')
      setError('No LinkedIn URL found for this contact')
      return
    }

    console.log(`🚀 Starting LinkedIn enrichment for contact ${contactId}`)
    setIsLinkedInEnriching(true)
    setError(null)

    try {
      console.log(`📡 Making API request to: /api/contacts/${contactId}/extract-linkedin`)

      const response = await ApiClient.post(`/api/contacts/${contactId}/extract-linkedin`, {})

      if (response.success) {
        console.log('✅ LinkedIn enrichment completed successfully:', response)
        setError(null)
        
        if (onEnrichmentComplete) {
          onEnrichmentComplete()
        }
        
      } else {
        console.error('❌ LinkedIn enrichment failed:', response.error)
        setError(response.error || 'Failed to extract from LinkedIn')
      }

    } catch (error: any) {
      console.error('❌ LinkedIn enrichment error:', error)
      setError(error.message || 'Failed to extract from LinkedIn')
    } finally {
      setIsLinkedInEnriching(false)
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

  // Don't show button if no website AND no LinkedIn
  if (!hasWebsite && !hasLinkedIn) {
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="text-xs">
          No enrichment sources
        </Badge>
      </div>
    )
  }

  // Show separate buttons/badges for each enrichment type
  return (
    <div className="flex flex-col gap-2">
      {/* Website Enrichment */}
      {hasWebsite && (
        <div className="flex items-center gap-2">
          {status === 'completed' ? (
            <>
              <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Website Enriched
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
            </>
          ) : status === 'failed' ? (
            <>
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Website Failed
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleWebsiteEnrichment}
                disabled={isEnriching}
                className="text-xs px-2 py-1 h-6"
                title="Retry website enrichment"
              >
                <RefreshCw className={`h-3 w-3 ${isEnriching ? 'animate-spin' : ''}`} />
              </Button>
            </>
          ) : (
            <Button
              variant={variant}
              size={size}
              onClick={handleWebsiteEnrichment}
              disabled={isEnriching || status === 'pending'}
              className={className}
            >
              {isEnriching || status === 'pending' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Website...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich from Website
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* LinkedIn Enrichment */}
      {hasLinkedIn && (
        <div className="flex items-center gap-2">
          {linkedInStatus === 'completed' ? (
            <>
              <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                LinkedIn Enriched
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLinkedInEnrichment}
                disabled={isLinkedInEnriching}
                className="text-xs px-2 py-1 h-6"
                title="Re-extract LinkedIn data"
              >
                <RefreshCw className={`h-3 w-3 ${isLinkedInEnriching ? 'animate-spin' : ''}`} />
              </Button>
            </>
          ) : linkedInStatus === 'failed' ? (
            <>
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                LinkedIn Failed
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLinkedInEnrichment}
                disabled={isLinkedInEnriching}
                className="text-xs px-2 py-1 h-6"
                title="Retry LinkedIn extraction"
              >
                <RefreshCw className={`h-3 w-3 ${isLinkedInEnriching ? 'animate-spin' : ''}`} />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size={size}
              onClick={handleLinkedInEnrichment}
              disabled={isLinkedInEnriching || linkedInStatus === 'pending'}
              className={`${className} border-blue-200 text-blue-700 hover:bg-blue-50`}
            >
              {isLinkedInEnriching || linkedInStatus === 'pending' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting LinkedIn...
                </>
              ) : (
                <>
                  <Linkedin className="h-4 w-4 mr-2" />
                  Extract from LinkedIn
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 mt-1">
          {error}
        </div>
      )}
    </div>
  )
}