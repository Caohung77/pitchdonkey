'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Globe, CheckCircle, AlertTriangle, Clock, XCircle, Loader2 } from 'lucide-react'

interface Contact {
  id: string
  email: string
  company?: string
  website?: string
  enrichment_status?: string
  enrichment_updated_at?: string
}

interface BulkEnrichmentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedContacts: Contact[]
  onEnrichmentStarted: (jobId: string) => void
}

interface EnrichmentEligibility {
  eligible: Contact[]
  already_enriched: Contact[]
  no_website: Contact[]
  processing: Contact[]
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

  // Analyze eligibility when modal opens
  useEffect(() => {
    if (isOpen && selectedContacts.length > 0) {
      analyzeEligibility()
    }
  }, [isOpen, selectedContacts])

  const analyzeEligibility = () => {
    const eligible: Contact[] = []
    const already_enriched: Contact[] = []
    const no_website: Contact[] = []
    const processing: Contact[] = []

    selectedContacts.forEach(contact => {
      if (!contact.website) {
        no_website.push(contact)
      } else if (contact.enrichment_status === 'pending') {
        processing.push(contact)
      } else if (contact.enrichment_status === 'completed' && isRecentlyEnriched(contact.enrichment_updated_at)) {
        already_enriched.push(contact)
      } else {
        eligible.push(contact)
      }
    })

    setEligibility({ eligible, already_enriched, no_website, processing })
  }

  const isRecentlyEnriched = (lastEnriched: string | undefined): boolean => {
    if (!lastEnriched) return false
    const lastEnrichedDate = new Date(lastEnriched)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return lastEnrichedDate > oneDayAgo
  }

  const handleStartEnrichment = async () => {
    if (!eligibility || eligibility.eligible.length === 0) return

    setIsStarting(true)
    
    try {
      const contactIds = forceRefresh 
        ? [...eligibility.eligible.map(c => c.id), ...eligibility.already_enriched.map(c => c.id)]
        : eligibility.eligible.map(c => c.id)

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

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start bulk enrichment')
      }

      console.log('✅ Bulk enrichment job started:', data.job_id)
      
      onEnrichmentStarted(data.job_id)
      onClose()

    } catch (error) {
      console.error('Failed to start bulk enrichment:', error)
      alert(`Failed to start bulk enrichment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsStarting(false)
    }
  }

  const getStatusBadge = (contact: Contact) => {
    if (!contact.website) {
      return <Badge variant="secondary" className="text-xs">No Website</Badge>
    }
    
    switch (contact.enrichment_status) {
      case 'completed':
        return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Enriched</Badge>
      case 'pending':
        return <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">Processing</Badge>
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Ready</Badge>
    }
  }

  const estimatedMinutes = eligibility ? Math.ceil((forceRefresh 
    ? eligibility.eligible.length + eligibility.already_enriched.length 
    : eligibility.eligible.length) * 0.5) : 0

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
            Analyze website content for {selectedContacts.length} selected contacts using Perplexity AI
          </DialogDescription>
        </DialogHeader>

        {/* Status Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">{eligibility.eligible.length}</div>
            <div className="text-sm text-green-700">Ready to Enrich</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Globe className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">{eligibility.already_enriched.length}</div>
            <div className="text-sm text-blue-700">Recently Enriched</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-yellow-600">{eligibility.no_website.length}</div>
            <div className="text-sm text-yellow-700">No Website</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-orange-600">{eligibility.processing.length}</div>
            <div className="text-sm text-orange-700">Processing</div>
          </div>
        </div>

        {/* Contact Preview Table */}
        <div className="border rounded-lg mb-6 max-h-60 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Website</TableHead>
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
                    {contact.website ? (
                      <a 
                        href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {contact.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">No website</span>
                    )}
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
              onCheckedChange={setForceRefresh}
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
                  ? eligibility.eligible.length + eligibility.already_enriched.length
                  : eligibility.eligible.length
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
            disabled={eligibility.eligible.length === 0 || isStarting}
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