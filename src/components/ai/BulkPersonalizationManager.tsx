'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  RefreshCw,
  Plus,
  Users,
  Eye,
  Download,
  Square,
  Trash2,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign
} from 'lucide-react'

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
  ai_provider: string
  estimated_cost: number
  actual_cost: number
  actual_tokens: number
  error_message?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

interface BulkPersonalizationManagerProps {
  onCreateNew?: () => void
  onViewResults?: (job: BulkPersonalizationJob) => void
}

export default function BulkPersonalizationManager({ 
  onCreateNew, 
  onViewResults 
}: BulkPersonalizationManagerProps) {
  const [jobs, setJobs] = useState<BulkPersonalizationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadJobs()
  }, [statusFilter])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      const response = await fetch(`/api/ai/bulk-personalize?${params}`)
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/ai/bulk-personalize/${jobId}/cancel`, {
        method: 'POST'
      })
      if (response.ok) {
        loadJobs()
      }
    } catch (error) {
      console.error('Failed to cancel job:', error)
    }
  }

  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/ai/bulk-personalize/${jobId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        loadJobs()
      }
    } catch (error) {
      console.error('Failed to delete job:', error)
    }
  }

  const exportResults = async (jobId: string, jobName: string) => {
    try {
      const response = await fetch(`/api/ai/bulk-personalize/${jobId}/results?export=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${jobName}-results.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to export results:', error)
    }
  }

  const viewJobResults = (job: BulkPersonalizationJob) => {
    if (onViewResults) {
      onViewResults(job)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'processing': return <Zap className="w-4 h-4 animate-pulse" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'cancelled': return <Square className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const calculateProgress = (completed: number, total: number) => {
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  }

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'Not started'
    
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const diffMs = end.getTime() - start.getTime()
    
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading jobs...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk Personalization</h2>
          <p className="text-gray-600">Manage your bulk AI personalization jobs</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadJobs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {onCreateNew && (
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          )}
        </div>
      </div>

      {/* Jobs List */}
      <div className="grid gap-4">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No jobs found</h3>
              <p className="text-gray-600 mb-4">
                {statusFilter === 'all' 
                  ? 'You haven\'t created any bulk personalization jobs yet.'
                  : `No jobs found with status: ${statusFilter}`
                }
              </p>
              {onCreateNew && (
                <Button onClick={onCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Job
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          jobs.map(job => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <h3 className="font-semibold">{job.name}</h3>
                    </div>
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === 'completed' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewJobResults(job)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Results
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportResults(job.id, job.name)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Export
                        </Button>
                      </>
                    )}
                    {['pending', 'processing'].includes(job.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelJob(job.id)}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteJob(job.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                {job.status === 'processing' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{job.progress.completed} / {job.progress.total} contacts</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${calculateProgress(job.progress.completed, job.progress.total)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Job Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{job.progress.total} contacts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gray-400" />
                    <span>{job.ai_provider.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span>
                      {job.status === 'completed' 
                        ? `$${job.actual_cost.toFixed(4)}`
                        : `~$${job.estimated_cost.toFixed(4)}`
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{formatDuration(job.started_at, job.completed_at)}</span>
                  </div>
                </div>

                {/* Error Message */}
                {job.error_message && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2 text-red-800">
                      <XCircle className="w-4 h-4" />
                      <span className="font-medium">Error:</span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">{job.error_message}</p>
                  </div>
                )}

                {/* Success Summary */}
                {job.status === 'completed' && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center justify-between text-green-800 text-sm">
                      <span>
                        ✅ {job.progress.completed} successful, {job.progress.failed} failed
                      </span>
                      <span>
                        {job.actual_tokens.toLocaleString()} tokens used
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}