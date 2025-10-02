'use client'

import { useEnrichmentProgress } from '@/hooks/useEnrichmentProgress'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EnrichmentProgressBarProps {
  userId: string | undefined
  className?: string
  compact?: boolean
}

export function EnrichmentProgressBar({
  userId,
  className,
  compact = false
}: EnrichmentProgressBarProps) {
  const { activeJobs, hasActiveJobs } = useEnrichmentProgress(userId)

  if (!hasActiveJobs) {
    return null
  }

  if (compact) {
    // Compact version for top bar
    const mostRecentJob = activeJobs[0]
    if (!mostRecentJob) return null

    return (
      <div className={cn('flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full', className)}>
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span className="text-xs font-medium text-primary">
          Enriching {mostRecentJob.progress.completed}/{mostRecentJob.progress.total} contacts
        </span>
        <div className="w-24 h-1.5 bg-primary/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${mostRecentJob.percentage}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-primary">
          {mostRecentJob.percentage}%
        </span>
      </div>
    )
  }

  // Full card version for dashboard
  return (
    <Card className={cn('p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Contact Enrichment in Progress
        </h3>
        <span className="text-xs text-muted-foreground">
          {activeJobs.length} {activeJobs.length === 1 ? 'job' : 'jobs'} active
        </span>
      </div>

      <div className="space-y-3">
        {activeJobs.map((job) => (
          <div key={job.jobId} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {job.status === 'running' && (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                )}
                {job.status === 'pending' && (
                  <Clock className="h-3 w-3 text-yellow-500" />
                )}
                {job.status === 'completed' && (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                )}
                {job.status === 'failed' && (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span className="font-medium capitalize">{job.status}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {job.progress.completed}/{job.progress.total} contacts
                  {job.progress.failed > 0 && (
                    <span className="text-red-500 ml-1">
                      ({job.progress.failed} failed)
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold">
                  {job.percentage}%
                </span>
              </div>
            </div>
            <Progress
              value={job.percentage}
              className={cn(
                'h-2',
                job.status === 'failed' && 'bg-red-100',
                job.status === 'completed' && 'bg-green-100'
              )}
              indicatorClassName={cn(
                job.status === 'failed' && 'bg-red-500',
                job.status === 'completed' && 'bg-green-500',
                job.status === 'running' && 'bg-primary'
              )}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}
