'use client'

import { Progress } from '@/components/ui/progress'
import { getEngagementScoreColor } from '@/lib/contact-engagement'
// Note: Using title attribute for tooltips instead of custom tooltip component

interface EngagementScoreProps {
  score: number
  maxScore?: number
  showValue?: boolean
  showTooltip?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function EngagementScore({
  score,
  maxScore = 100,
  showValue = true,
  showTooltip = true,
  size = 'md',
  className = ''
}: EngagementScoreProps) {
  const percentage = Math.min((score / maxScore) * 100, 100)
  const { color, bgColor } = getEngagementScoreColor(score)

  const getHeightClass = () => {
    switch (size) {
      case 'sm':
        return 'h-1.5'
      case 'lg':
        return 'h-3'
      default:
        return 'h-2'
    }
  }

  const getTextSize = () => {
    switch (size) {
      case 'sm':
        return 'text-xs'
      case 'lg':
        return 'text-base'
      default:
        return 'text-sm'
    }
  }

  function getProgressColor() {
    if (score >= 75) return 'bg-green-500'
    if (score >= 50) return 'bg-blue-500'
    if (score >= 25) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const tooltipText = showTooltip
    ? `Engagement Score: ${score}/${maxScore}. ${
        score >= 75 ? "Excellent engagement - high priority prospect" :
        score >= 50 ? "Good engagement - ready for sales qualification" :
        score >= 25 ? "Moderate engagement - continue nurturing" :
        "Low engagement - needs follow-up strategy"
      }. Scoring: Opens +5 (cap: 15), Clicks +20 (cap: 60), Replies +50 (no cap)`
    : undefined

  return (
    <div
      className={`flex items-center space-x-2 ${className} ${showTooltip ? 'cursor-help' : ''}`}
      title={tooltipText}
    >
      <div className="flex-1">
        <Progress
          value={percentage}
          className={`${getHeightClass()} bg-gray-200`}
          indicatorClassName={getProgressColor()}
        />
      </div>
      {showValue && (
        <span className={`${getTextSize()} font-medium ${color} min-w-[2.5rem] text-right`}>
          {score}
        </span>
      )}
    </div>
  )
}