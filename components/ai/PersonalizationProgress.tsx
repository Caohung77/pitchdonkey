'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, 
  Clock, 
  Users, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Square,
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface BulkPersonalizationJob {
  id: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: {
    total: number
    completed: number
    failed: number
    current_batch: number
  }
  estimated_cost: number
  actual_cost: number
  estimated_tokens: number
  actual_tokens: number
  ai_provider: string
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
}

interface PersonalizationProgressProps {
  jobId: string
  onJobComplete?: (job: BulkPersonalizationJob) => void
  onJobFailed?: (job: BulkPersonalizationJob, error: string) => void
  autoRefresh?: boolean
  refreshInterval?: number
}

export function PersonalizationProgress({
  jobId,
  onJobComplete,
  onJobFailed,
  autoRefresh = true,
  refreshInterval = 2000
}: PersonalizationProgressProps) {
  const [job, setJob] = useState<BulkPersonalizationJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    loadJobStatus()

    if (autoRefresh) {
      const interval = setInterval(() => {
        if (job && ['pending', 'processing'].includes(job.status)) {
          loadJobStatus()
        }
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [jobId, autoRefresh, refreshInterval])

  useEffect(() => {
    if (job) {
      if (job.status === 'completed' && onJobComplete) {
        onJobComplete(job)
      } else if (job.status === 'failed' && onJobFailed) {
        onJobFailed(job, job.error_message || 'Unknown error')
      }
    }
  }, [job?.status])

  const loadJobStatus = async () => {
    try {
      setError(null)
      const response = await fetch(`/api/ai/bulk-personalize/${jobId}`)
      const data = await response.json()

      if (data.success) {
        setJob(data.data)
        setLastUpdated(new Date())
      } else {
        setError(data.error || 'Failed to load job status')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Error loading job status:', err)
    } finally {
      setLoading(false)
    }
  }

  const cancelJob = async () => {
    if (!job || !['pending', 'processing'].includes(job.status)) {
      return
    }

    try {
      const response = await fetch(`/api/ai/bulk-personalize/${jobId}/cancel`, {
        method: 'POST'
      })

      if (response.ok) {
        loadJobStatus()
      }
    } catch (err) {
      console.error('Error cancelling job:', err)
    }
  }

  const calculateProgress = () => {
    if (!job || job.progress.total === 0) return 0
    return Math.round((job.progress.completed / job.progress.total) * 100)
  }

  const calculateSuccessRate = () => {
    if (!job || job.progress.completed === 0) return 0
    const successful = job.progress.completed - job.progress.failed
    return Math.round((successful / job.progress.completed) * 100)
  }

  const formatDuration = () => {
    if (!job?.started_at) return 'Not started'
    
    const start = new Date(job.started_at)
    const end = job.completed_at ? new Date(job.completed_at) : new Date()
    const diffMs = end.getTime() - start.getTime()
    
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const estimateTimeRemaining = () => {
    if (!job || job.status !== 'processing' || !job.started_at || job.progress.completed === 0) {
      return null
    }

    const elapsed = Date.now() - new Date(job.started_at).getTime()
    const avgTimePerContact = elapsed / job.progress.completed
    const remaining = job.progress.total - job.progress.completed
    const estimatedMs = remaining * avgTimePerContact

    const minutes = Math.floor(estimatedMs / 60000)
    const seconds = Math.floor((estimatedMs % 60000) / 1000)

    if (minutes > 0) {
      return `~${minutes}m ${seconds}s remaining`
    }
    return `~${seconds}s remaining`
  }

  const getStatusIcon = () => {
    if (!job) return <RefreshCw className="w-5 h-5 animate-spin" />
    
    switch (job.status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500" />
      case 'processing':
        return <Zap className="w-5 h-5 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'cancelled':
        return <Square className="w-5 h-5 text-orange-500" />
      default:
        return <RefreshCw className="w-5 h-5" />
    }
  }

  const getStatusColor = () => {
    if (!job) return 'bg-gray-100 text-gray-800'
    
    switch (job.status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && !job) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading job status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadJobStatus}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!job) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Job not found
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">{job.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor()}>
                  {job.status}
                </Badge>
                <span className="text-sm text-gray-500">
                  {job.ai_provider.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['pending', 'processing'].includes(job.status) && (
              <Button variant="outline" size="sm" onClick={cancelJob}>
                <Square className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadJobStatus}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        {job.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>{job.progress.completed} / {job.progress.total} contacts</span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Batch {job.progress.current_batch}</span>
              <span>{estimateTimeRemaining()}</span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Users className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-sm font-medium">{job.progress.total}</div>
              <div className="text-xs text-gray-500">Total Contacts</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <div>
              <div className="text-sm font-medium text-green-700">
                {job.progress.completed - job.progress.failed}
              </div>
              <div className="text-xs text-gray-500">Successful</div>
            </div>
          </div>

          {job.progress.failed > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              <XCircle className="w-4 h-4 text-red-400" />
              <div>
                <div className="text-sm font-medium text-red-700">{job.progress.failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <DollarSign className="w-4 h-4 text-blue-400" />
            <div>
              <div className="text-sm font-medium text-blue-700">
                ${job.status === 'completed' ? job.actual_cost.toFixed(4) : job.estimated_cost.toFixed(4)}
              </div>
              <div className="text-xs text-gray-500">
                {job.status === 'completed' ? 'Final Cost' : 'Est. Cost'}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        {job.status === 'completed' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{calculateSuccessRate()}%</div>
              <div className="text-sm text-gray-500">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {job.actual_tokens.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Tokens Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatDuration()}</div>
              <div className="text-sm text-gray-500">Duration</div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {job.error_message && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <XCircle className="w-4 h-4" />
              <span className="font-medium">Error Details</span>
            </div>
            <p className="text-red-700 text-sm">{job.error_message}</p>
          </div>
        )}

        {/* Real-time Updates Info */}
        {autoRefresh && ['pending', 'processing'].includes(job.status) && (
          <div className="flex items-center justify-center text-xs text-gray-500 pt-2 border-t">
            <RefreshCw className="w-3 h-3 mr-1" />
            <span>Auto-updating every {refreshInterval / 1000}s</span>
            <span className="mx-2">•</span>
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simplified version for embedding in other components
export function PersonalizationProgressMini({ 
  jobId, 
  className = '' 
}: { 
  jobId: string
  className?: string 
}) {
  const [job, setJob] = useState<BulkPersonalizationJob | null>(null)

  useEffect(() => {
    const loadJob = async () => {
      try {
        const response = await fetch(`/api/ai/bulk-personalize/${jobId}`)
        const data = await response.json()
        if (data.success) {
          setJob(data.data)
        }
      } catch (error) {
        console.error('Error loading job:', error)
      }
    }

    loadJob()
    
    // Poll for updates if job is active
    const interval = setInterval(() => {
      if (job && ['pending', 'processing'].includes(job.status)) {
        loadJob()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [jobId])

  if (!job) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  const progress = job.progress.total > 0 
    ? Math.round((job.progress.completed / job.progress.total) * 100)
    : 0

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        {job.status === 'processing' && <Zap className="w-4 h-4 text-blue-500 animate-pulse" />}
        {job.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
        {job.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
        {job.status === 'pending' && <Clock className="w-4 h-4 text-gray-500" />}
        <span className="text-sm font-medium">{job.name}</span>
      </div>
      
      {job.status === 'processing' && (
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{progress}%</span>
        </div>
      )}
      
      {job.status === 'completed' && (
        <Badge className="bg-green-100 text-green-800 text-xs">
          {job.progress.completed} completed
        </Badge>
      )}
    </div>
  )
}