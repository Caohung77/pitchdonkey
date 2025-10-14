'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  calculateEngagementScoreBreakdown,
  getEngagementStatusInfo,
  type ContactEngagementStatus
} from '@/lib/contact-engagement'
import { Mail, MousePointer, MessageSquare, Ban } from 'lucide-react'

interface EngagementBreakdownProps {
  status: ContactEngagementStatus
  score: number
  openCount: number
  clickCount: number
  replyCount: number
  bounceCount: number
  sentCount: number
  lastPositiveAt: string | null
  className?: string
}

export function EngagementBreakdown({
  status,
  score,
  openCount,
  clickCount,
  replyCount,
  bounceCount,
  sentCount,
  lastPositiveAt,
  className = ''
}: EngagementBreakdownProps) {
  const statusInfo = getEngagementStatusInfo(status)
  const breakdown = calculateEngagementScoreBreakdown(
    openCount,
    clickCount,
    replyCount,
    lastPositiveAt
  )

  const formatLastActivity = (timestamp: string | null) => {
    if (!timestamp) return 'Never'

    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 30) return `${diffDays} days ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  const getDecayInfo = () => {
    if (breakdown.decayFactor === 1) return null

    const decayPercentage = Math.round((1 - breakdown.decayFactor) * 100)
    return `${decayPercentage}% decay applied due to inactivity`
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <span>Engagement Analysis</span>
          <Badge
            variant="secondary"
            className={`${statusInfo.bgColor} ${statusInfo.color} border-0`}
          >
            {statusInfo.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Score</span>
            <span className="text-lg font-bold">{score}/100</span>
          </div>
          <Progress value={(score / 100) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {statusInfo.description}
          </p>
        </div>

        {/* Activity Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Opens</span>
                  <span className="font-medium">{openCount}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  +{breakdown.openScore} points
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <MousePointer className="h-4 w-4 text-green-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Clicks</span>
                  <span className="font-medium">{clickCount}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  +{breakdown.clickScore} points
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Replies</span>
                  <span className="font-medium">{replyCount}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  +{breakdown.replyScore} points
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Ban className="h-4 w-4 text-red-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bounces</span>
                  <span className="font-medium">{bounceCount}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Negative indicator
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Score Calculation */}
        <div className="border-t pt-3 space-y-2">
          <div className="text-sm font-medium">Score Calculation</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Base score:</span>
              <span>{breakdown.totalBeforeDecay}</span>
            </div>
            {breakdown.decayFactor < 1 && (
              <div className="flex justify-between text-muted-foreground">
                <span>After decay:</span>
                <span>{breakdown.finalScore}</span>
              </div>
            )}
          </div>
          {getDecayInfo() && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              ⚠️ {getDecayInfo()}
            </p>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="border-t pt-3 space-y-2">
          <div className="text-sm font-medium">Activity Summary</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Emails sent:</span>
              <span className="ml-1 font-medium">{sentCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Last activity:</span>
              <span className="ml-1 font-medium">{formatLastActivity(lastPositiveAt)}</span>
            </div>
          </div>
        </div>

        {/* Actionable Insight */}
        <div className="border-t pt-3">
          <div className="text-sm font-medium text-primary">
            📋 {statusInfo.actionable}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}