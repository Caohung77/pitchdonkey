'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Globe,
  Linkedin,
  Sparkles,
  Eye,
  AlertCircle
} from 'lucide-react'
import { useState, useEffect } from 'react'

export interface EnrichmentJob {
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
    website_enriched: number
    linkedin_enriched: number
    sources_used: {
      website: number
      linkedin: number
      hybrid: number
    }
  }
  created_at: string
  started_at?: string
  completed_at?: string
}

interface EnrichmentProgressCardProps {
  job: EnrichmentJob
  onViewResults?: () => void
  onCancel?: () => void
  showDetails?: boolean
}

export function EnrichmentProgressCard({
  job,
  onViewResults,
  onCancel,
  showDetails = true
}: EnrichmentProgressCardProps) {
  const [timeAgo, setTimeAgo] = useState('')

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = new Date()
      const startTime = new Date(job.started_at || job.created_at)
      const diffMs = now.getTime() - startTime.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))

      if (diffMins < 1) {
        setTimeAgo('Just now')
      } else if (diffMins < 60) {
        setTimeAgo(`${diffMins} min${diffMins === 1 ? '' : 's'} ago`)
      } else {
        const diffHours = Math.floor(diffMins / 60)
        setTimeAgo(`${diffHours} hour${diffHours === 1 ? '' : 's'} ago`)
      }
    }

    updateTimeAgo()
    const interval = setInterval(updateTimeAgo, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [job.started_at, job.created_at])

  const getStatusIcon = () => {
    switch (job.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'running':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-orange-600" />
    }
  }

  const getStatusColor = () => {
    switch (job.status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200'
      case 'running':
        return 'bg-blue-50 border-blue-200'
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      case 'cancelled':
        return 'bg-orange-50 border-orange-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getStatusText = () => {
    switch (job.status) {
      case 'pending':
        return 'Starting...'
      case 'running':
        return `Processing (${job.progress.completed + job.progress.failed}/${job.progress.total})`
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
    }
  }

  return (
    <Card className={`${getStatusColor()} hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-sm font-medium">
                Contact Enrichment ({job.progress.total} contacts)
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {getStatusText()}
                </Badge>
                <span className="text-xs text-gray-500">{timeAgo}</span>
              </div>
            </div>
          </div>
          {job.status === 'running' && onCancel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="h-6 px-2 text-xs text-gray-500 hover:text-red-600"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress Bar */}
        {(job.status === 'running' || job.status === 'completed') && (
          <div className="space-y-2">
            <Progress
              value={job.progress.percentage}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>
                ✅ {job.progress.completed} completed
                ❌ {job.progress.failed} failed
              </span>
              <span>{job.progress.percentage}%</span>
            </div>
          </div>
        )}

        {/* Completion Summary */}
        {job.status === 'completed' && job.summary && showDetails && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-2 bg-white rounded border">
                <div className="font-semibold text-green-700">{job.summary.successful_scrapes}</div>
                <div className="text-green-600">Successful</div>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <div className="font-semibold text-red-700">{job.summary.failed_scrapes}</div>
                <div className="text-red-600">Failed</div>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <div className="font-semibold text-blue-700">{job.progress.total}</div>
                <div className="text-blue-600">Total</div>
              </div>
            </div>

            {/* Source Breakdown */}
            {(job.summary.sources_used.website > 0 || job.summary.sources_used.linkedin > 0 || job.summary.sources_used.hybrid > 0) && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">Enrichment Sources</div>
                <div className="flex gap-2 text-xs">
                  {job.summary.sources_used.website > 0 && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                      <Globe className="h-3 w-3 text-blue-600" />
                      <span className="text-blue-700">{job.summary.sources_used.website}</span>
                    </div>
                  )}
                  {job.summary.sources_used.linkedin > 0 && (
                    <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded">
                      <Linkedin className="h-3 w-3 text-purple-600" />
                      <span className="text-purple-700">{job.summary.sources_used.linkedin}</span>
                    </div>
                  )}
                  {job.summary.sources_used.hybrid > 0 && (
                    <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                      <Sparkles className="h-3 w-3 text-green-600" />
                      <span className="text-green-700">{job.summary.sources_used.hybrid}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        {job.status === 'completed' && onViewResults && (
          <Button
            size="sm"
            variant="outline"
            onClick={onViewResults}
            className="w-full h-8 text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            View Results
          </Button>
        )}

        {/* Error State */}
        {job.status === 'failed' && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            Enrichment failed. Please try again or contact support if the issue persists.
          </div>
        )}
      </CardContent>
    </Card>
  )
}