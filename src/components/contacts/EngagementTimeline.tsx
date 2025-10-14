'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, MousePointer, MessageSquare, Ban, AlertTriangle } from 'lucide-react'

export interface EngagementEvent {
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complained' | 'unsubscribed'
  timestamp: string
  details?: string
}

interface EngagementTimelineProps {
  events: EngagementEvent[]
  maxEvents?: number
  className?: string
}

export function EngagementTimeline({
  events,
  maxEvents = 10,
  className = ''
}: EngagementTimelineProps) {
  const sortedEvents = events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, maxEvents)

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'sent':
      case 'delivered':
        return <Mail className="h-4 w-4 text-blue-500" />
      case 'opened':
        return <Mail className="h-4 w-4 text-green-500" />
      case 'clicked':
        return <MousePointer className="h-4 w-4 text-green-600" />
      case 'replied':
        return <MessageSquare className="h-4 w-4 text-purple-500" />
      case 'bounced':
        return <Ban className="h-4 w-4 text-red-500" />
      case 'complained':
      case 'unsubscribed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Mail className="h-4 w-4 text-gray-500" />
    }
  }

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'sent':
        return 'Email Sent'
      case 'delivered':
        return 'Email Delivered'
      case 'opened':
        return 'Email Opened'
      case 'clicked':
        return 'Link Clicked'
      case 'replied':
        return 'Reply Received'
      case 'bounced':
        return 'Email Bounced'
      case 'complained':
        return 'Spam Complaint'
      case 'unsubscribed':
        return 'Unsubscribed'
      default:
        return 'Unknown Event'
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'sent':
      case 'delivered':
        return 'bg-blue-100 text-blue-800'
      case 'opened':
        return 'bg-green-100 text-green-800'
      case 'clicked':
        return 'bg-green-100 text-green-900'
      case 'replied':
        return 'bg-purple-100 text-purple-800'
      case 'bounced':
      case 'complained':
      case 'unsubscribed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Engagement Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No engagement events recorded yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Engagement Timeline</span>
          <Badge variant="secondary">{events.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedEvents.map((event, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className={`${getEventColor(event.type)} border-0 text-xs`}
                  >
                    {getEventLabel(event.type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                {event.details && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.details}
                  </p>
                )}
              </div>
            </div>
          ))}

          {events.length > maxEvents && (
            <div className="text-center pt-2">
              <span className="text-xs text-muted-foreground">
                ... and {events.length - maxEvents} more events
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
