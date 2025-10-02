'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClientSupabase } from '@/lib/supabase-client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface EnrichmentProgress {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: {
    total: number
    completed: number
    failed: number
    current_batch: number
  }
  percentage: number
  isActive: boolean
}

interface BulkEnrichmentJob {
  id: string
  status: string
  progress: {
    total: number
    completed: number
    failed: number
    current_batch: number
  }
}

export function useEnrichmentProgress(userId: string | undefined) {
  const [activeJobs, setActiveJobs] = useState<Map<string, EnrichmentProgress>>(new Map())
  const supabase = createClientSupabase()

  // Fetch initial active jobs
  const fetchActiveJobs = useCallback(async () => {
    if (!userId) return

    console.log('🔄 Fetching active enrichment jobs for user:', userId)

    const { data, error } = await supabase
      .from('bulk_enrichment_jobs')
      .select('id, status, progress, updated_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'running', 'completed', 'failed']) // Include completed/failed for 30 seconds
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error fetching active enrichment jobs:', error)
      return
    }

    console.log('📊 Found active jobs:', data)

    const jobs = new Map<string, EnrichmentProgress>()
    const now = Date.now()

    data?.forEach((job: BulkEnrichmentJob & { updated_at?: string }) => {
      const progress = job.progress || { total: 0, completed: 0, failed: 0, current_batch: 1 }
      const percentage = progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0

      const isActive = job.status === 'running' || job.status === 'pending'

      // For completed/failed jobs, only show if updated within last 30 seconds
      const updatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0
      const age = now - updatedAt
      const isRecent = age < 30000 // 30 seconds

      if (isActive || isRecent) {
        console.log(`📈 Job ${job.id}: ${progress.completed}/${progress.total} (${percentage}%) - Status: ${job.status}`)

        jobs.set(job.id, {
          jobId: job.id,
          status: job.status as EnrichmentProgress['status'],
          progress,
          percentage,
          isActive
        })
      }
    })

    setActiveJobs(jobs)
  }, [userId, supabase])

  useEffect(() => {
    if (!userId) return

    console.log('🚀 useEnrichmentProgress mounted for user:', userId)

    // Fetch initial jobs
    fetchActiveJobs()

    // Subscribe to job updates
    const channel = supabase
      .channel('enrichment_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bulk_enrichment_jobs',
          filter: `user_id=eq.${userId}`
        },
        (payload: RealtimePostgresChangesPayload<BulkEnrichmentJob>) => {
          console.log('🔔 Realtime update received:', payload)
          const job = payload.new as BulkEnrichmentJob

          if (payload.eventType === 'DELETE') {
            setActiveJobs(prev => {
              const next = new Map(prev)
              next.delete(payload.old.id)
              return next
            })
            return
          }

          const progress = job.progress || { total: 0, completed: 0, failed: 0, current_batch: 1 }
          const percentage = progress.total > 0
            ? Math.round((progress.completed / progress.total) * 100)
            : 0

          const isActive = job.status === 'running' || job.status === 'pending'

          setActiveJobs(prev => {
            const next = new Map(prev)

            if (isActive || prev.has(job.id)) {
              next.set(job.id, {
                jobId: job.id,
                status: job.status as EnrichmentProgress['status'],
                progress,
                percentage,
                isActive
              })
            }

            // Remove completed/failed jobs after 30 seconds (matches fetch logic)
            if (!isActive && prev.has(job.id)) {
              setTimeout(() => {
                setActiveJobs(current => {
                  const updated = new Map(current)
                  updated.delete(job.id)
                  return updated
                })
              }, 30000) // 30 seconds to match fetch logic
            }

            return next
          })
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status)
      })

    console.log('🔌 Subscribed to enrichment jobs channel for user:', userId)

    // Polling fallback every 3 seconds while jobs are active
    const pollInterval = setInterval(() => {
      if (activeJobs.size > 0) {
        console.log('⏱️ Polling for job updates (fallback)...')
        fetchActiveJobs()
      }
    }, 3000)

    return () => {
      console.log('🔌 Unsubscribing from enrichment jobs channel')
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, fetchActiveJobs, activeJobs.size])

  return {
    activeJobs: Array.from(activeJobs.values()),
    hasActiveJobs: activeJobs.size > 0,
    totalProgress: activeJobs.size > 0
      ? Math.round(
          Array.from(activeJobs.values()).reduce((sum, job) => sum + job.percentage, 0) /
          activeJobs.size
        )
      : 0
  }
}
