'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { BeatLoader } from 'react-spinners'

interface BulkEnrichmentProgressModalProps {
  jobId: string | { jobId: string; totalContacts: number; contactIds: string[] } | { job_id: string; summary: { eligible_contacts: number; total_requested: number } }
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
  }
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
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  
  // Use refs to manage polling state - this prevents stale closures
  const pollingActive = useRef(false)
  const currentTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasFinalizedRef = useRef(false)
  const summaryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Extract job details
    const actualJobId = typeof jobId === 'string' ? jobId : 
                       'jobId' in jobId ? jobId.jobId : jobId.job_id
    const totalContacts = typeof jobId === 'object' ? 
                         ('totalContacts' in jobId ? jobId.totalContacts : 
                          jobId.summary.eligible_contacts) : 0
    
  // Helper function to validate UUID format
  const isValidUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }

  // Stop polling function
  const stopPolling = useCallback(() => {
    console.log('🛑 Stopping all polling')
    pollingActive.current = false
    if (currentTimeoutRef.current) {
      clearTimeout(currentTimeoutRef.current)
      currentTimeoutRef.current = null
    }
  }, [])

  // Finalize and close (one-shot)
  const finalizeAndClose = useCallback((didSucceed: boolean) => {
    if (hasFinalizedRef.current) return
    hasFinalizedRef.current = true
    try {
      stopPolling()
      if (summaryTimeoutRef.current) {
        clearTimeout(summaryTimeoutRef.current)
        summaryTimeoutRef.current = null
      }
      if (didSucceed) {
        onComplete()
      }
    } finally {
      onClose()
    }
  }, [stopPolling, onComplete, onClose])

  // Single API call function
  const fetchJobStatus = async () => {
    try {
      console.log(`📡 Fetching job status: ${actualJobId}`)
      
      const response = await fetch(`/api/contacts/bulk-enrich/${actualJobId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const apiResponse = await response.json()
      console.log('📊 API response:', apiResponse)
      
      // Handle API response structure - createSuccessResponse returns { success, data, message, timestamp }
      const data = apiResponse.success && apiResponse.data ? apiResponse.data : apiResponse
      
      if (!data || !data.status) {
        throw new Error('Invalid API response format')
      }
      
      return data
    } catch (error) {
      console.error('❌ API call failed:', error)
      throw error
    }
  }

  // Recursive polling function using setTimeout
  const startPolling = useCallback(() => {
    // Don't start if already polling
    if (pollingActive.current) return
    
    pollingActive.current = true
    hasFinalizedRef.current = false
    setError(null)
    
    const poll = async () => {
      // Check if we should still be polling
      if (!pollingActive.current) {
        console.log('🛑 Polling stopped')
        return
      }

      try {
        const data = await fetchJobStatus()
        
        // Check again after async operation
        if (!pollingActive.current) {
          console.log('🛑 Polling stopped during fetch')
          return
        }
        
        console.log('📊 Job status:', data.status, `Progress: ${data.progress?.percentage || 0}%`)
        setJobStatus(data)
        
        // Handle completion or failure
        if (data.status === 'completed') {
          console.log('✅ Job completed - stopping polling and showing brief summary (manual close)')
          stopPolling()
          setShowSummary(true)
          return
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          console.log(`❌ Job ${data.status} - stopping polling and closing modal`)
          finalizeAndClose(false)
          return
        }
        
        // Schedule next poll if still active
        if (pollingActive.current) {
          currentTimeoutRef.current = setTimeout(poll, 2000)
        }
        
      } catch (error) {
        console.error('❌ Polling error:', error)
        if (pollingActive.current) {
          setError(error instanceof Error ? error.message : 'Failed to fetch job status')
          pollingActive.current = false
        }
      }
    }
    
    // Start immediate poll
    poll()
  }, [finalizeAndClose])

  // Main effect for polling lifecycle
  useEffect(() => {
    if (!isOpen || !actualJobId) {
      console.log('❌ Modal not open or no job ID')
      return
    }

    console.log('🔄 Starting bulk enrichment polling:', actualJobId)

    // Handle temporary job IDs (before actual job is created)
    if (actualJobId.startsWith('temp-')) {
      const tempStatus: JobStatus = {
        job_id: actualJobId,
        status: 'pending',
        progress: {
          total: totalContacts,
          completed: 0,
          failed: 0,
          current_batch: 1,
          percentage: 0
        }
      }
      setJobStatus(tempStatus)
      return // Don't poll temp IDs
    }

    // Validate job ID format
    if (!isValidUUID(actualJobId)) {
      console.error(`❌ Invalid job ID format: ${actualJobId}`)
      setError(`Invalid job ID format: ${actualJobId}`)
      return
    }

    // Start polling
    startPolling()

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up polling')
      stopPolling()
      if (summaryTimeoutRef.current) {
        clearTimeout(summaryTimeoutRef.current)
        summaryTimeoutRef.current = null
      }
    }
  }, [isOpen, actualJobId, totalContacts, startPolling, stopPolling])

  // Handle manual close
  const handleClose = () => {
    stopPolling()
    if (summaryTimeoutRef.current) {
      clearTimeout(summaryTimeoutRef.current)
      summaryTimeoutRef.current = null
    }
    onClose()
  }

  // Handle view contacts (complete and refresh)
  const handleViewContacts = () => {
    stopPolling()
    if (summaryTimeoutRef.current) {
      clearTimeout(summaryTimeoutRef.current)
      summaryTimeoutRef.current = null
    }
    onComplete()
    onClose()
  }

  // Error state
  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Error Loading Job
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={handleClose} variant="outline">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Loading state
  if (!jobStatus) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-semibold">
              Starting Enrichment
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-50">
              <BeatLoader color="#3B82F6" size={12} />
            </div>
            <p className="text-gray-600">Connecting to LinkedIn scraping service...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Get status info
  const getStatusInfo = () => {
    switch (jobStatus.status) {
      case 'pending':
        return {
          title: 'Processing Contacts',
          message: 'Starting LinkedIn enrichment...',
          icon: <BeatLoader color="#3B82F6" size={12} />,
          showSpinner: true
        }
      case 'running':
        const completed = jobStatus.progress.completed || 0
        const failed = jobStatus.progress.failed || 0  
        const total = jobStatus.progress.total || 0
        const processed = completed + failed
        
        return {
          title: 'Processing Contacts',
          message: `Enriching contacts (${processed}/${total})...`,
          icon: <BeatLoader color="#3B82F6" size={12} />,
          showSpinner: true
        }
      case 'completed':
        return {
          title: '🎉 Enrichment Complete!',
          message: 'All contacts have been processed successfully',
          icon: <CheckCircle className="h-8 w-8 text-green-600" />,
          showSpinner: false
        }
      case 'failed':
        return {
          title: 'Enrichment Failed',
          message: 'The enrichment process encountered errors',
          icon: <XCircle className="h-8 w-8 text-red-600" />,
          showSpinner: false
        }
      case 'cancelled':
        return {
          title: 'Enrichment Cancelled',
          message: 'The enrichment process was cancelled',
          icon: <AlertCircle className="h-8 w-8 text-orange-600" />,
          showSpinner: false
        }
      default:
        return {
          title: 'Processing...',
          message: 'Please wait while we process your request',
          icon: <BeatLoader color="#3B82F6" size={12} />,
          showSpinner: true
        }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            {statusInfo.title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-8">
          {/* Main content area */}
          <div className="flex flex-col items-center gap-6">
            
            {/* Status Icon/Spinner */}
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-50">
              {statusInfo.icon}
            </div>
            
            {/* Status Message */}
            <div className="text-center space-y-2">
              <p className="text-gray-700 text-lg">{statusInfo.message}</p>
          </div>
          
            {/* Brief Result Summary (shows for ~2s on completion) */}
            {showSummary && (
              <div className="w-full bg-white rounded-lg p-5 border border-green-200">
                {(() => {
                  const successful = jobStatus.summary?.successful_scrapes ?? (jobStatus.progress.completed || 0)
                  const failed = jobStatus.summary?.failed_scrapes ?? (jobStatus.progress.failed || 0)
                  const total = jobStatus.progress.total || (successful + failed)
                  return (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xl font-semibold text-green-700">{successful}</div>
                        <div className="text-xs text-gray-600">Successful</div>
          </div>
                      <div>
                        <div className="text-xl font-semibold text-red-700">{failed}</div>
                        <div className="text-xs text-gray-600">Failed</div>
                      </div>
                      <div>
                        <div className="text-xl font-semibold text-blue-700">{total}</div>
                        <div className="text-xs text-gray-600">Total</div>
                          </div>
                        </div>
                  )
                })()}
                {jobStatus.summary?.data_points_extracted !== undefined && (
                  <div className="mt-3 text-center text-xs text-gray-500">
                    Data points: {jobStatus.summary.data_points_extracted}
          </div>
        )}
          </div>
        )}


          </div>
            </div>

        {/* Footer Actions - Show for completed/failed jobs (manual close) */}
        {(jobStatus.status === 'completed' || jobStatus.status === 'failed' || jobStatus.status === 'cancelled') && (
          <div className="flex justify-center pt-4 border-t gap-2">
              {jobStatus.status === 'completed' && (
                <Button
                onClick={handleViewContacts}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Done
              </Button>
            )}
            <Button
              onClick={handleClose}
              variant="outline"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}