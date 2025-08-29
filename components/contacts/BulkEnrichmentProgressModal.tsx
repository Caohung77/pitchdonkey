'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Loader2, Globe, Clock, AlertCircle } from 'lucide-react'

interface BulkEnrichmentProgressModalProps {
  jobId: string
  isOpen: boolean
  onClose: () => void
  onComplete: () => void    // Refresh contacts list
}

interface JobStatus {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: {
    total: number
    completed: number
    failed: number
    current_batch: number
    percentage: number
    estimated_remaining?: string
  }
  results: Array<{
    contact_id: string
    email: string
    company?: string
    website_url?: string
    scrape_status: 'completed' | 'failed' | 'pending' | 'running'
    enrichment_data?: any
    error?: {
      type: string
      message: string
      retryable: boolean
    }
    scraped_at?: string
  }>
  created_at: string
  started_at?: string
  completed_at?: string
  summary?: {
    successful_scrapes: number
    failed_scrapes: number
    data_points_extracted: number
  }
}

export function BulkEnrichmentProgressModal({ 
  jobId, 
  isOpen, 
  onClose, 
  onComplete 
}: BulkEnrichmentProgressModalProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Poll job status every 2 seconds
  useEffect(() => {
    if (!isOpen || !jobId || !isPolling) return

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/contacts/bulk-enrich/${jobId}/status`)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        setJobStatus(data)
        setError(null)
        
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          setIsPolling(false)
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch job status')
      }
    }

    // Initial fetch
    pollStatus()
    
    // Set up polling
    const interval = setInterval(pollStatus, 2000)
    
    return () => clearInterval(interval)
  }, [jobId, isOpen, isPolling])

  const handleCancelJob = async () => {
    if (!jobId || !jobStatus || jobStatus.status !== 'running') return

    try {
      const response = await fetch(`/api/contacts/bulk-enrich/${jobId}/cancel`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to cancel job')
      }

      const data = await response.json()
      
      if (data.success) {
        // Refresh status immediately
        setJobStatus(prev => prev ? { ...prev, status: 'cancelled' } : null)
        setIsPolling(false)
      }
    } catch (error) {
      console.error('Failed to cancel job:', error)
      alert('Failed to cancel job. Please try again.')
    }
  }

  const getStatusIcon = () => {
    if (!jobStatus) return <Loader2 className="h-5 w-5 animate-spin" />
    
    switch (jobStatus.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-orange-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusTitle = () => {
    if (!jobStatus) return 'Loading...'
    
    switch (jobStatus.status) {
      case 'pending':
        return 'Preparing Bulk Enrichment'
      case 'running':
        return `Processing Batch ${jobStatus.progress.current_batch}...`
      case 'completed':
        return 'Bulk Enrichment Completed Successfully'
      case 'failed':
        return 'Bulk Enrichment Failed'
      case 'cancelled':
        return 'Bulk Enrichment Cancelled'
      default:
        return 'Bulk Enrichment Status'
    }
  }

  const getResultBadge = (result: JobStatus['results'][0]) => {
    switch (result.scrape_status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">✓ Completed</Badge>
      case 'failed':
        return <Badge variant="destructive">✗ Failed</Badge>
      case 'running':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span>Error Loading Job</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-red-600">{error}</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  if (!jobStatus) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            <span>Loading job status...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {getStatusIcon()}
            <span>{getStatusTitle()}</span>
          </DialogTitle>
          <DialogDescription>
            Job ID: {jobId}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Overview */}
        <div className="space-y-4 mb-6">
          <Progress value={jobStatus.progress.percentage} className="w-full" />
          
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{jobStatus.progress.completed}</div>
              <div className="text-sm text-green-700">Completed</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{jobStatus.progress.failed}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {jobStatus.progress.total - jobStatus.progress.completed - jobStatus.progress.failed}
              </div>
              <div className="text-sm text-gray-700">Remaining</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{jobStatus.progress.percentage}%</div>
              <div className="text-sm text-purple-700">Progress</div>
            </div>
          </div>
          
          {jobStatus.progress.estimated_remaining && jobStatus.status === 'running' && (
            <div className="text-center text-sm text-gray-600">
              Estimated time remaining: {jobStatus.progress.estimated_remaining}
            </div>
          )}

          {jobStatus.status === 'running' && (
            <div className="text-center text-sm text-blue-600">
              Processing batch {jobStatus.progress.current_batch}...
            </div>
          )}
        </div>

        {/* Individual Contact Results */}
        {jobStatus.results && jobStatus.results.length > 0 && (
          <div className="border rounded-lg max-h-60 overflow-y-auto mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobStatus.results.map((result, index) => (
                  <TableRow key={result.contact_id || index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{result.company || 'Unknown Company'}</div>
                        <div className="text-sm text-gray-600">{result.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.website_url ? (
                        <a 
                          href={result.website_url.startsWith('http') ? result.website_url : `https://${result.website_url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          <Globe className="h-3 w-3 inline mr-1" />
                          {result.website_url.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">No website</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getResultBadge(result)}
                    </TableCell>
                    <TableCell>
                      {result.enrichment_data ? (
                        <div className="text-sm">
                          <div className="text-green-600 font-medium">✓ Data extracted</div>
                          <div className="text-gray-600">
                            {result.enrichment_data.industry || result.enrichment_data.company_name || 'Data available'}
                          </div>
                        </div>
                      ) : result.error ? (
                        <div className="text-sm text-red-600" title={result.error.message}>
                          {result.error.message.length > 30 
                            ? result.error.message.substring(0, 30) + '...' 
                            : result.error.message
                          }
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Pending...</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Job Summary (shown when completed) */}
        {jobStatus.status === 'completed' && jobStatus.summary && (
          <div className="bg-green-50 p-4 rounded-lg mb-4">
            <h4 className="font-medium text-green-900 mb-2">🎉 Enrichment Complete!</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-green-700">Successful:</span>
                <div className="font-medium">{jobStatus.summary.successful_scrapes}</div>
              </div>
              <div>
                <span className="text-green-700">Failed:</span>
                <div className="font-medium">{jobStatus.summary.failed_scrapes}</div>
              </div>
              <div>
                <span className="text-green-700">Data Points:</span>
                <div className="font-medium">{jobStatus.summary.data_points_extracted}</div>
              </div>
            </div>
          </div>
        )}

        {/* Error Summary (shown when failed) */}
        {jobStatus.status === 'failed' && (
          <div className="bg-red-50 p-4 rounded-lg mb-4">
            <h4 className="font-medium text-red-900 mb-2">❌ Enrichment Failed</h4>
            <p className="text-sm text-red-700">
              The bulk enrichment job encountered errors. Check individual contact results above for details.
            </p>
          </div>
        )}

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div>
              {jobStatus.status === 'running' && (
                <Button
                  variant="outline"
                  onClick={handleCancelJob}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Cancel Job
                </Button>
              )}
            </div>
            <div className="space-x-2">
              {jobStatus.status === 'completed' && (
                <Button
                  onClick={() => {
                    onComplete()
                    onClose()
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  View Updated Contacts
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                {jobStatus.status === 'running' ? 'Hide Progress' : 'Close'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}