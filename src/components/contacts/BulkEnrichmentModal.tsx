'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Globe, CheckCircle, AlertTriangle, Clock, XCircle, Loader2, Linkedin } from 'lucide-react'
import { useEnrichmentToast } from '@/lib/enrichment-toast'

interface Contact {
  id: string
  email: string
  company?: string
  website?: string
  linkedin_url?: string
  enrichment_status?: string
  enrichment_updated_at?: string
  linkedin_extraction_status?: string
  linkedin_extracted_at?: string
}

interface BulkEnrichmentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedContacts: Contact[]
  onEnrichmentStarted: (jobData: string | { jobId: string; totalContacts: number; contactIds: string[] } | { job_id: string; summary: { eligible_contacts: number; total_requested: number } } | null) => void
}

interface EnrichmentEligibility {
  eligible: Contact[]            // Can be enriched (website or LinkedIn available)
  already_enriched: Contact[]    // Recently enriched
  no_sources: Contact[]          // No website AND no LinkedIn
  processing: Contact[]          // Currently being processed
  linkedin_only: Contact[]       // No website but has LinkedIn (can use LinkedIn enrichment)
}

export function BulkEnrichmentModal({
  isOpen,
  onClose,
  selectedContacts,
  onEnrichmentStarted
}: BulkEnrichmentModalProps) {
  const [eligibility, setEligibility] = useState<EnrichmentEligibility | null>(null)
  const [forceRefresh, setForceRefresh] = useState(false)
  const [batchSize, setBatchSize] = useState(3)
  const [timeout, setTimeout] = useState(30)
  const [isStarting, setIsStarting] = useState(false)

  const { showEnrichmentStarted, showEnrichmentInProgress } = useEnrichmentToast()

  // Analyze eligibility when modal opens
  useEffect(() => {
    if (isOpen && selectedContacts.length > 0) {
      analyzeEligibility()
    }
  }, [isOpen, selectedContacts])

  // Helper to check if email domain can be used for enrichment
  const canEnrichFromEmail = (email: string): boolean => {
    if (!email) return false
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return false

    // Personal email domains that should NOT be used for enrichment
    const personalDomains = new Set([
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
      'web.de', 'gmx.de', 'gmx.net', 't-online.de', 'freenet.de',
      'aol.com', 'live.com', 'me.com', 'msn.com', 'ymail.com',
      'protonmail.com', 'tutanota.com', '1und1.de', 'arcor.de'
    ])

    return !personalDomains.has(domain)
  }

  const analyzeEligibility = () => {
    const eligible: Contact[] = []
    const already_enriched: Contact[] = []
    const no_sources: Contact[] = []
    const processing: Contact[] = []
    const linkedin_only: Contact[] = []

    selectedContacts.forEach(contact => {
      const hasWebsite = !!contact.website
      const hasLinkedIn = !!contact.linkedin_url
      const canUseEmailDomain = canEnrichFromEmail(contact.email)
      const isWebsiteEnriched = contact.enrichment_status === 'completed' && isRecentlyEnriched(contact.enrichment_updated_at)
      const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed' && isRecentlyEnriched(contact.linkedin_extracted_at)
      const isProcessing = contact.enrichment_status === 'pending' || contact.linkedin_extraction_status === 'pending'

      if (isProcessing) {
        processing.push(contact)
      } else if ((isWebsiteEnriched || isLinkedInEnriched)) {
        already_enriched.push(contact)
      } else if (!hasWebsite && !hasLinkedIn && !canUseEmailDomain) {
        // Only mark as "No Sources" if truly no sources available
        no_sources.push(contact)
      } else if (!hasWebsite && !canUseEmailDomain && hasLinkedIn) {
        // Has LinkedIn but no website/email domain - LinkedIn-only enrichment
        linkedin_only.push(contact)
      } else {
        // Has website, email domain, or LinkedIn - eligible for enrichment
        eligible.push(contact)
      }
    })

    setEligibility({ eligible, already_enriched, no_sources, processing, linkedin_only })
  }

  const isRecentlyEnriched = (lastEnriched: string | undefined): boolean => {
    if (!lastEnriched) return false
    const lastEnrichedDate = new Date(lastEnriched)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return lastEnrichedDate > oneDayAgo
  }

  const handleStartEnrichment = async () => {
    const totalEligible = eligibility.eligible.length + eligibility.linkedin_only.length
    const totalRefreshable = eligibility.already_enriched.length
    
    if (!eligibility || (totalEligible === 0 && (!forceRefresh || totalRefreshable === 0))) return

    setIsStarting(true)
    
    // Calculate total contacts for progress tracking (include LinkedIn-only contacts)
    const totalContacts = forceRefresh 
      ? totalEligible + totalRefreshable
      : totalEligible

    // Show progress modal immediately with contact info
    const tempJobInfo = {
      jobId: 'temp-' + Date.now(),
      totalContacts,
      contactIds: forceRefresh 
        ? [...eligibility.eligible.map(c => c.id), ...eligibility.linkedin_only.map(c => c.id), ...eligibility.already_enriched.map(c => c.id)]
        : [...eligibility.eligible.map(c => c.id), ...eligibility.linkedin_only.map(c => c.id)]
    }
    
    console.log('🔄 BulkEnrichmentModal: Starting enrichment - showing progress modal immediately')
    console.log('📊 Total contacts to process:', totalContacts)

    // Show enrichment started toast
    showEnrichmentStarted(totalContacts)

    onEnrichmentStarted(tempJobInfo) // Pass job info object
    onClose() // Close this modal
    
    try {
      const contactIds = forceRefresh 
        ? [...eligibility.eligible.map(c => c.id), ...eligibility.linkedin_only.map(c => c.id), ...eligibility.already_enriched.map(c => c.id)]
        : [...eligibility.eligible.map(c => c.id), ...eligibility.linkedin_only.map(c => c.id)]

      console.log('Starting bulk enrichment:', {
        contact_ids: contactIds,
        options: {
          force_refresh: forceRefresh,
          batch_size: batchSize,
          timeout: timeout
        }
      })

      // Call real API to create bulk enrichment job
      const response = await fetch('/api/contacts/bulk-enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact_ids: contactIds,
          options: {
            force_refresh: forceRefresh,
            batch_size: batchSize,
            timeout: timeout
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}`
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorData.message || errorMessage
          console.error('API Error Details:', errorData)
        } catch (e) {
          console.error('Raw API Error:', errorText)
          errorMessage = errorText || errorMessage
        }
        
        throw new Error(errorMessage)
      }

      const apiResponse = await response.json()
      
      // Extract data from wrapped API response (createSuccessResponse format)
      const data = apiResponse.success && apiResponse.data ? apiResponse.data : apiResponse
      
      console.log('📊 Raw API response:', apiResponse)
      console.log('📊 Parsed job data:', data)
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start bulk enrichment')
      }

      console.log('✅ Bulk enrichment job started:', data.job_id)
      
      // Update with real job data if we got one
      if (data.job_id) {
        console.log('🔄 BulkEnrichmentModal: Updating with real job data:', data)
        
        // Always pass the job_id, calculate eligible contacts from our temp data if summary is missing
        const realJobData = {
          job_id: data.job_id,
          summary: {
            eligible_contacts: data.summary?.eligible_contacts || totalContacts,
            total_requested: data.summary?.total_requested || totalContacts
          }
        }
        
        console.log('🔄 BulkEnrichmentModal: Sending real job data:', realJobData)
        onEnrichmentStarted(realJobData)
      }

    } catch (error) {
      console.error('Failed to start bulk enrichment:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check if it's an "already running" error and show appropriate toast
      if (errorMessage.includes('already running') || errorMessage.includes('already in progress')) {
        // Extract progress text from error message (e.g., "2/6 contacts enriched")
        const progressMatch = errorMessage.match(/\(([^)]+)\)/)
        const progressText = progressMatch ? progressMatch[1] : 'processing'
        showEnrichmentInProgress(progressText)
      } else {
        // For other errors, use alert as before
        alert(`Failed to start bulk enrichment: ${errorMessage}`)
      }

      // Close progress modal on error
      onEnrichmentStarted(null)
    } finally {
      setIsStarting(false)
    }
  }

  const getStatusBadge = (contact: Contact) => {
    const hasWebsite = !!contact.website
    const hasLinkedIn = !!contact.linkedin_url
    const isWebsiteEnriched = contact.enrichment_status === 'completed'
    const isLinkedInEnriched = contact.linkedin_extraction_status === 'completed'
    const isProcessing = contact.enrichment_status === 'pending' || contact.linkedin_extraction_status === 'pending'
    
    if (isProcessing) {
      return <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">Processing</Badge>
    }
    
    if (isWebsiteEnriched && isLinkedInEnriched) {
      return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Fully Enriched</Badge>
    }
    
    if (isWebsiteEnriched) {
      return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Website Enriched</Badge>
    }
    
    if (isLinkedInEnriched) {
      return <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">LinkedIn Enriched</Badge>
    }
    
    if (contact.enrichment_status === 'failed' || contact.linkedin_extraction_status === 'failed') {
      return <Badge variant="destructive" className="text-xs">Failed</Badge>
    }
    
    if (!hasWebsite && !hasLinkedIn) {
      return <Badge variant="secondary" className="text-xs">No Sources</Badge>
    }
    
    if (!hasWebsite && hasLinkedIn) {
      return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">LinkedIn Available</Badge>
    }
    
    if (hasWebsite) {
      return <Badge variant="outline" className="text-xs">Ready</Badge>
    }
    
    return <Badge variant="secondary" className="text-xs">Unknown</Badge>
  }

  const estimatedMinutes = eligibility ? Math.ceil((forceRefresh 
    ? eligibility.eligible.length + eligibility.linkedin_only.length + eligibility.already_enriched.length 
    : eligibility.eligible.length + eligibility.linkedin_only.length) * 0.5) : 0

  if (!eligibility) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            <span>Analyzing contacts for enrichment eligibility...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Contact Enrichment</DialogTitle>
          <DialogDescription>
            Enrich {selectedContacts.length} selected contacts using website analysis or LinkedIn profile extraction
          </DialogDescription>
        </DialogHeader>

        {/* Status Overview */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <div className="text-xl font-bold text-green-600">{eligibility.eligible.length}</div>
            <div className="text-xs text-green-700">Website Ready</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Linkedin className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <div className="text-xl font-bold text-blue-600">{eligibility.linkedin_only.length}</div>
            <div className="text-xs text-blue-700">LinkedIn Only</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <Globe className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <div className="text-xl font-bold text-purple-600">{eligibility.already_enriched.length}</div>
            <div className="text-xs text-purple-700">Recently Enriched</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <div className="text-xl font-bold text-orange-600">{eligibility.processing.length}</div>
            <div className="text-xs text-orange-700">Processing</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <XCircle className="h-6 w-6 text-gray-600 mx-auto mb-1" />
            <div className="text-xl font-bold text-gray-600">{eligibility.no_sources.length}</div>
            <div className="text-xs text-gray-700">No Sources</div>
          </div>
        </div>

        {/* Contact Preview Table */}
        <div className="border rounded-lg mb-6 max-h-60 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Sources</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Enriched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{contact.company || 'Unknown Company'}</div>
                      <div className="text-sm text-gray-600">{contact.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contact.website ? (
                        <a
                          href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                        >
                          <Globe className="h-3 w-3" />
                          {contact.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : canEnrichFromEmail(contact.email) ? (
                        <span className="text-green-600 text-sm flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          Email domain ({contact.email.split('@')[1]})
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">No website</span>
                      )}
                      {contact.linkedin_url && (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                        >
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(contact)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {contact.enrichment_updated_at 
                      ? new Date(contact.enrichment_updated_at).toLocaleDateString()
                      : 'Never'
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Configuration Options */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="force-refresh" 
              checked={forceRefresh}
              onCheckedChange={(checked) => setForceRefresh(checked === true)}
            />
            <Label htmlFor="force-refresh">
              Force refresh (re-enrich recently analyzed websites)
            </Label>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Batch Size</Label>
              <Select value={batchSize.toString()} onValueChange={(v) => setBatchSize(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (Slower, safer)</SelectItem>
                  <SelectItem value="3">3 (Recommended)</SelectItem>
                  <SelectItem value="5">5 (Faster, higher load)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timeout per URL</Label>
              <Select value={timeout.toString()} onValueChange={(v) => setTimeout(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Estimation & Costs */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h4 className="font-medium text-blue-900 mb-2">Estimation</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Estimated Time:</span>
              <div className="font-medium">~{estimatedMinutes} minutes</div>
            </div>
            <div>
              <span className="text-blue-700">API Calls:</span>
              <div className="font-medium">
                {forceRefresh 
                  ? eligibility.eligible.length + eligibility.linkedin_only.length + eligibility.already_enriched.length
                  : eligibility.eligible.length + eligibility.linkedin_only.length
                } requests
              </div>
            </div>
            <div>
              <span className="text-blue-700">Processing:</span>
              <div className="font-medium">Background job</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isStarting}>
            Cancel
          </Button>
          <Button 
            onClick={handleStartEnrichment}
            disabled={
              (eligibility.eligible.length + eligibility.linkedin_only.length === 0 && (!forceRefresh || eligibility.already_enriched.length === 0)) || 
              isStarting
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              'Start Enrichment Analysis'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}