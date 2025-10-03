'use client'

import { Button } from '@/components/ui/button'
import { Sparkles, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

interface AISummaryButtonProps {
  onGenerate: () => void
  loading?: boolean
  variant?: 'default' | 'compact'
  className?: string
}

export function AISummaryButton({
  onGenerate,
  loading = false,
  variant = 'default',
  className,
}: AISummaryButtonProps) {
  if (variant === 'compact') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation() // Prevent card click
          onGenerate()
        }}
        disabled={loading}
        className={clsx(
          'group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
          'bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 hover:from-purple-100 hover:to-blue-100',
          'border border-purple-200/50 hover:border-purple-300',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          className
        )}
      >
        {loading ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3 group-hover:scale-110 transition-transform" />
        )}
        <span>{loading ? 'Generating...' : 'Instant Summary'}</span>
      </button>
    )
  }

  return (
    <Button
      onClick={onGenerate}
      disabled={loading}
      variant="outline"
      size="sm"
      className={clsx(
        'gap-2 bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 hover:from-purple-100 hover:to-blue-100',
        'border-purple-200/50 hover:border-purple-300',
        className
      )}
    >
      {loading ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      <span>{loading ? 'Generating AI Summary...' : 'Generate AI Summary'}</span>
    </Button>
  )
}
