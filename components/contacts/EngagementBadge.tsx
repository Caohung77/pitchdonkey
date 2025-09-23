'use client'

import { Badge } from '@/components/ui/badge'
import {
  getEngagementStatusInfo,
  type ContactEngagementStatus
} from '@/lib/contact-engagement'
// Note: Using title attribute for tooltips instead of custom tooltip component

interface EngagementBadgeProps {
  status: ContactEngagementStatus
  score?: number
  showTooltip?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function EngagementBadge({
  status,
  score,
  showTooltip = true,
  size = 'md',
  className = ''
}: EngagementBadgeProps) {
  const statusInfo = getEngagementStatusInfo(status)

  const getIcon = () => {
    switch (status) {
      case 'not_contacted':
        return '🟦'
      case 'pending':
        return '🟡'
      case 'engaged':
        return '🟢'
      case 'bad':
        return '🔴'
      default:
        return '⚪'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-1.5 py-0.5'
      case 'lg':
        return 'text-base px-3 py-1.5'
      default:
        return 'text-sm px-2 py-1'
    }
  }

  const tooltipText = showTooltip
    ? `${statusInfo.label} - ${statusInfo.description}. ${statusInfo.actionable}${score !== undefined ? `. Score: ${score}/100` : ''}`
    : undefined

  return (
    <Badge
      variant="secondary"
      title={tooltipText}
      className={`
        ${statusInfo.bgColor} ${statusInfo.color} border-0 font-medium
        ${getSizeClasses()}
        ${className}
        ${showTooltip ? 'cursor-help' : ''}
      `}
    >
      <span className="mr-1">{getIcon()}</span>
      {statusInfo.label}
      {score !== undefined && score > 0 && (
        <span className="ml-1 opacity-75">({score})</span>
      )}
    </Badge>
  )
}