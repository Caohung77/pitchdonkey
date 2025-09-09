'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Loader2, Globe, Clock, AlertCircle } from 'lucide-react'

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
  const [localProgress, setLocalProgress] = useState<{percentage: number, completed: number, failed: number, total: number}>({
    percentage: 0, 
    completed: 0, 
    failed: 0, 
    total: 0
  })

  // Calculate progress with proper logic
  const calculateProgress = (completed: number, failed: number, total: number) => {
    if (total === 0) return 0
    const processed = completed + failed
    return Math.min(Math.round((processed / total) * 100), 100)
  }

  // Update local progress state - SIMPLIFIED
  const updateProgress = (status: JobStatus) => {
    if (!status.progress) {
      console.warn('⚠️ Progress Update: No progress data in status')
      return
    }
    
    // Use the server-calculated percentage directly
    const newProgress = {
      percentage: status.progress.percentage || 0,
      completed: status.progress.completed || 0,
      failed: status.progress.failed || 0,
      total: status.progress.total || 0
    }
    
    console.log('📊 Real-time Progress Update:', {
      status: status.status,
      progress: newProgress
    })
    
    setLocalProgress(newProgress)
  }

  // SIMPLIFIED polling - just poll the real job ID
  useEffect(() => {
    if (!isOpen || !jobId) return
    
    // Extract job ID and metadata from different formats
    const actualJobId = typeof jobId === 'string' ? jobId : 
                       'jobId' in jobId ? jobId.jobId : jobId.job_id
    const totalContacts = typeof jobId === 'object' ? 
                         ('totalContacts' in jobId ? jobId.totalContacts : 
                          jobId.summary.eligible_contacts) : 0
    
    console.log('🔄 Progress Modal Starting:', {
      jobId: actualJobId,
      totalContacts,
      isTemp: actualJobId.startsWith('temp-')
    })
    
    setIsPolling(true)
    setError(null)
    
    // Initialize progress for temp IDs
    if (actualJobId.startsWith('temp-')) {
      setLocalProgress({
        percentage: 0,
        completed: 0,
        failed: 0,
        total: totalContacts
      })
      
      const tempStatus = {
        job_id: actualJobId,
        status: 'pending' as const,
        progress: {
          total: totalContacts,
          completed: 0,
          failed: 0,
          current_batch: 1,
          percentage: 0
        },
        results: [],
        created_at: new Date().toISOString()
      }
      setJobStatus(tempStatus)
      return // Don't poll temp IDs
    }

    // Polling function for real job IDs
    const pollStatus = async () => {
      if (actualJobId.startsWith('temp-')) return
      
      try {
        console.log('📡 Polling job:', actualJobId)
        const response = await fetch(`/api/contacts/bulk-enrich/${actualJobId}/status`)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        console.log('📊 Job status update:', {
          status: data.status,
          progress: data.progress?.percentage + '%'
        })
        
        setJobStatus(data)
        updateProgress(data)
        setError(null)
        
        // Stop polling when done
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          console.log('✅ Job finished, stopping polling')
          setIsPolling(false)
        }
      } catch (error) {
        console.error('❌ Polling error:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch job status')
      }
    }

    // Start polling immediately for real jobs
    pollStatus()
    
    // Poll every 2 seconds (more reasonable than every 1 second)
    const interval = setInterval(pollStatus, 2000)
    
    return () => {
      console.log('🛑 Cleaning up polling')
      clearInterval(interval)
    }
  }, [jobId, isOpen])

  // No more periodic checking - simple polling handles everything

  const handleCancelJob = async () => {
    const actualJobId = typeof jobId === 'string' ? jobId : 
                       'jobId' in jobId ? jobId.jobId : jobId.job_id
    if (!actualJobId || !jobStatus || jobStatus.status !== 'running') return

    try {
      const response = await fetch(`/api/contacts/bulk-enrich/${actualJobId}/cancel`, {
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
        return `Processing Batch ${jobStatus.progress?.current_batch || 1}...`
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
            Job ID: {typeof jobId === 'string' ? jobId : 
                     'jobId' in jobId ? jobId.jobId : jobId.job_id}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Overview */}
        <div className={`space-y-4 mb-6 transition-all duration-500 ${
          jobStatus.status === 'completed' ? 'animate-pulse bg-green-50 p-4 rounded-lg border border-green-200' : ''
        }`}>
          {/* Enhanced Progress Bar with Animation */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium text-gray-700">
              <span>Progress: <span className="text-blue-600 font-bold">{localProgress.percentage}%</span></span>
              <span><span className="text-green-600 font-bold">{localProgress.completed + localProgress.failed}</span> of <span className="font-bold">{localProgress.total}</span> contacts</span>
            </div>
            
            {/* Main Progress Bar */}
            <div className="relative w-full h-6 bg-gray-200 rounded-full shadow-inner overflow-hidden">
              {/* Background pattern for better visibility */}
              <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200"></div>
              
              {/* Progress fill */}
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-blue-600 to-green-500 rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${localProgress.percentage}%` }}
              >
                {/* Shimmer effect for active progress */}
                {jobStatus.status === 'running' && localProgress.percentage > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                )}
              </div>
              
              {/* Animated loading bar for preparation phase */}
              {jobStatus.status === 'pending' && (
                <div className="absolute inset-0">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse opacity-50"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-ping"></div>
                </div>
              )}
              
              {/* Progress text overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white drop-shadow-sm">
                  {localProgress.percentage}%
                </span>
              </div>
            </div>
            
            {/* Status indicator bar */}
            <div className="flex gap-1 h-1">
              {Array.from({ length: Math.max(1, localProgress.total) }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-full transition-all duration-500 ${
                    i < localProgress.completed 
                      ? 'bg-green-500' 
                      : i < localProgress.completed + localProgress.failed
                      ? 'bg-red-500'
                      : jobStatus.status === 'running'
                      ? 'bg-blue-300 animate-pulse'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 shadow-sm transition-all duration-500 hover:shadow-md">
              <div className="text-3xl font-extrabold text-green-600 mb-1">{localProgress.completed}</div>
              <div className="text-sm font-medium text-green-700">Completed</div>
              {localProgress.completed > 0 && (
                <div className="mt-1 h-1 bg-green-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 shadow-sm transition-all duration-500 hover:shadow-md">
              <div className="text-3xl font-extrabold text-red-600 mb-1">{localProgress.failed}</div>
              <div className="text-sm font-medium text-red-700">Failed</div>
              {localProgress.failed > 0 && (
                <div className="mt-1 h-1 bg-red-200 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm transition-all duration-500 hover:shadow-md">
              <div className="text-3xl font-extrabold text-gray-600 mb-1">
                {localProgress.total - localProgress.completed - localProgress.failed}
              </div>
              <div className="text-sm font-medium text-gray-700">Remaining</div>
              {jobStatus.status === 'running' && (localProgress.total - localProgress.completed - localProgress.failed) > 0 && (
                <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-400 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-purple-100 rounded-xl border border-purple-200 shadow-sm transition-all duration-500 hover:shadow-md">
              <div className="text-3xl font-extrabold text-purple-600 mb-1">{localProgress.percentage}%</div>
              <div className="text-sm font-medium text-purple-700">Progress</div>
              <div className="mt-1 h-1 bg-purple-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${localProgress.percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {jobStatus.progress?.estimated_remaining && jobStatus.status === 'running' && (
            <div className="text-center text-sm text-gray-600">
              Estimated time remaining: {jobStatus.progress.estimated_remaining}
            </div>
          )}

          {jobStatus.status === 'running' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mb-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">Processing enrichment...</span>
                <span className="font-bold">{localProgress.percentage}% complete</span>
                {jobStatus.progress?.current_batch && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Batch {jobStatus.progress.current_batch}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                🔄 Analyzing websites and extracting data...
              </div>
            </div>
          )}
          
          {jobStatus.status === 'pending' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-2">
                <div className="relative">
                  <Clock className="h-5 w-5 animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                </div>
                <span className="font-medium animate-pulse">Preparing to start enrichment...</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                  <span>Initializing AI enrichment engine</span>
                </div>
                <div className="flex items-center justify-center gap-2 animation-delay-150">
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"></div>
                  <span>Queuing {localProgress.total} contacts for processing</span>
                </div>
                <div className="flex items-center justify-center gap-2 animation-delay-300">
                  <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce"></div>
                  <span>Starting batch processing...</span>
                </div>
              </div>
            </div>
          )}
          
          {jobStatus.status === 'completed' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 mb-2">
                <CheckCircle className="h-5 w-5 animate-bounce" />
                <span className="font-bold">🎉 Enrichment Complete!</span>
              </div>
              <div className="text-xs text-green-700">
                Successfully processed {localProgress.completed} contacts with AI-powered data extraction
              </div>
            </div>
          )}
          
          {jobStatus.status === 'failed' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-red-600 mb-2">
                <XCircle className="h-5 w-5" />
                <span className="font-bold">❌ Enrichment Failed</span>
              </div>
              <div className="text-xs text-red-700">
                Check individual contact results below for error details
              </div>
            </div>
          )}
        </div>

        {/* Live Activity Log */}
        {(jobStatus.status === 'running' || jobStatus.status === 'pending') && (
          <div className="mb-6 border rounded-lg bg-gray-50">
            <div className="p-3 border-b bg-gray-100 rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Live Activity Log</span>
                <span className="text-xs text-gray-500 ml-auto">Real-time updates</span>
              </div>
            </div>
            <div className="p-4 max-h-32 overflow-y-auto font-mono text-xs text-gray-600 space-y-1">
              {jobStatus.status === 'pending' && (
                <>
                  <div className="flex items-center gap-2 opacity-75">
                    <span className="text-blue-500">●</span>
                    <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                    <span>Initializing bulk enrichment job...</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-60 animation-delay-500">
                    <span className="text-purple-500">●</span>
                    <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                    <span>Loading {localProgress.total} contacts for processing...</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-45 animation-delay-1000">
                    <span className="text-orange-500">●</span>
                    <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                    <span>Preparing AI enrichment pipeline...</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-30 animate-pulse">
                    <span className="text-green-500">●</span>
                    <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                    <span>Starting batch processing...</span>
                  </div>
                </>
              )}
              
              {jobStatus.status === 'running' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">●</span>
                    <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                    <span>Job started - Processing batch {jobStatus.progress?.current_batch || 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500">●</span>
                    <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                    <span>Analyzing {localProgress.total} websites with AI...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-500">●</span>
                    <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                    <span>Progress: {localProgress.completed} completed, {localProgress.failed} failed</span>
                  </div>
                  {localProgress.percentage > 50 && (
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">●</span>
                      <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                      <span>Over halfway complete - extracting remaining data...</span>
                    </div>
                  )}
                  {localProgress.percentage > 80 && (
                    <div className="flex items-center gap-2 animate-pulse">
                      <span className="text-green-500">●</span>
                      <span className="text-gray-500">{new Date().toLocaleTimeString()}</span>
                      <span>Nearly finished - finalizing enrichment data...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

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
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg mb-4 border-2 border-green-200 shadow-lg animate-pulse">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3 animate-bounce">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-green-900 mb-1">🎉 Enrichment Complete!</h4>
              <p className="text-sm text-green-700">All contacts have been successfully processed</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-green-600">{jobStatus.summary.successful_scrapes}</div>
                <div className="text-sm text-green-700 font-medium">Successful</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-red-600">{jobStatus.summary.failed_scrapes}</div>
                <div className="text-sm text-red-700 font-medium">Failed</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{jobStatus.summary.data_points_extracted}</div>
                <div className="text-sm text-blue-700 font-medium">Data Points</div>
              </div>
            </div>
            
            {/* Success celebration animation */}
            <div className="flex justify-center mt-4 space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                ></div>
              ))}
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
            <div className="space-x-2">
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