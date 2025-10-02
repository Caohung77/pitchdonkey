'use client'

import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'

export interface EnrichmentReport {
  total: number
  successful: number
  failed: number
  sources: {
    linkedin: number
    website: number
    hybrid: number
  }
  failureReasons?: string[]
  duration: string
}

export function useEnrichmentToast() {
  const { addToast } = useToast()
  const router = useRouter()

  const showEnrichmentStarted = (contactCount: number) => {
    addToast({
      type: 'info',
      title: 'Enrichment Started',
      message: `Processing ${contactCount} contact${contactCount > 1 ? 's' : ''} in the background. Progress will be visible on the dashboard.`,
      duration: 3000 // Auto-dismiss after 3 seconds
    })
  }

  const showEnrichmentCompleted = (report: EnrichmentReport) => {
    const successRate = Math.round((report.successful / report.total) * 100)

    addToast({
      type: 'success',
      title: '🎉 Enrichment Complete!',
      message: `✅ ${report.successful} successful  ❌ ${report.failed} failed  📊 ${report.total} total
📈 Sources: LinkedIn (${report.sources.linkedin}), Website (${report.sources.website}), Both (${report.sources.hybrid})`,
      action: {
        label: 'View Results',
        onClick: () => router.push('/dashboard/contacts?filter=recently-enriched')
      },
      duration: 10000
    })
  }

  const showEnrichmentFailed = (errorMessage: string) => {
    addToast({
      type: 'error',
      title: 'Enrichment Failed',
      message: errorMessage,
      action: {
        label: 'Try Again',
        onClick: () => router.push('/dashboard/contacts')
      },
      duration: 8000
    })
  }

  return {
    showEnrichmentStarted,
    showEnrichmentCompleted,
    showEnrichmentFailed
  }
}