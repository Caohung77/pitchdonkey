'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  MoreVertical,
  Shield,
  User,
  XCircle,
  Edit,
  Send,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ScheduledReply } from '@/lib/scheduled-replies'

interface ScheduledReplyCardProps {
  reply: ScheduledReply
  onApprove: (replyId: string) => void
  onCancel: (replyId: string) => void
  onEdit: (reply: ScheduledReply) => void
}

export function ScheduledReplyCard({
  reply,
  onApprove,
  onCancel,
  onEdit,
}: ScheduledReplyCardProps) {
  const [showFullBody, setShowFullBody] = useState(false)

  // Status badge configuration
  const statusConfig = {
    scheduled: { variant: 'default' as const, icon: Clock, label: 'Scheduled' },
    needs_approval: { variant: 'warning' as const, icon: AlertCircle, label: 'Needs Approval' },
    approved: { variant: 'default' as const, icon: CheckCircle, label: 'Approved' },
    sending: { variant: 'default' as const, icon: Send, label: 'Sending' },
    sent: { variant: 'secondary' as const, icon: CheckCircle, label: 'Sent' },
    failed: { variant: 'destructive' as const, icon: XCircle, label: 'Failed' },
    cancelled: { variant: 'secondary' as const, icon: XCircle, label: 'Cancelled' },
  }

  const status = statusConfig[reply.status] || statusConfig.scheduled
  const StatusIcon = status.icon

  // Risk badge color
  const getRiskBadgeVariant = (riskScore: number) => {
    if (riskScore >= 0.6) return 'destructive'
    if (riskScore >= 0.4) return 'warning'
    return 'default'
  }

  // Time display
  const scheduledAt = new Date(reply.scheduled_at)
  const isPast = scheduledAt < new Date()
  const timeUntil = formatDistanceToNow(scheduledAt, { addSuffix: true })

  // Editable check
  const editableUntil = new Date(reply.editable_until)
  const isEditable = new Date() < editableUntil &&
    ['scheduled', 'needs_approval', 'approved'].includes(reply.status)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={status.variant}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              <Badge variant={getRiskBadgeVariant(reply.risk_score)}>
                <Shield className="h-3 w-3 mr-1" />
                Risk: {(reply.risk_score * 100).toFixed(0)}%
              </Badge>
              {reply.status === 'needs_approval' && (
                <Badge variant="warning">Action Required</Badge>
              )}
            </div>
            <CardTitle className="text-base font-medium">
              {reply.draft_subject}
            </CardTitle>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {reply.status === 'needs_approval' && (
                <DropdownMenuItem onClick={() => onApprove(reply.id)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Send
                </DropdownMenuItem>
              )}
              {isEditable && (
                <DropdownMenuItem onClick={() => onEdit(reply)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Reply
                </DropdownMenuItem>
              )}
              {['scheduled', 'needs_approval', 'approved'].includes(reply.status) && (
                <DropdownMenuItem
                  onClick={() => onCancel(reply.id)}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Reply
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contact & Agent Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">To</div>
              <div className="font-medium">
                {reply.contact?.first_name || reply.contact?.last_name
                  ? `${reply.contact.first_name || ''} ${reply.contact.last_name || ''}`.trim()
                  : reply.incoming_email?.from_address || 'Unknown'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">From</div>
              <div className="font-medium">{reply.email_account?.email || 'Unknown'}</div>
            </div>
          </div>
        </div>

        {/* Agent Info */}
        {reply.agent && (
          <div className="flex items-center gap-2 text-sm">
            <div className="text-xs text-muted-foreground">Agent:</div>
            <div className="font-medium">{reply.agent.name}</div>
            <Badge variant="secondary" className="text-xs">
              {reply.agent.language} · {reply.agent.tone}
            </Badge>
          </div>
        )}

        {/* Scheduled Time */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="text-muted-foreground">
              {isPast ? 'Was scheduled' : 'Will send'}
            </span>
            <span className="font-medium ml-1">{timeUntil}</span>
          </div>
        </div>

        {/* Risk Flags */}
        {reply.risk_flags && reply.risk_flags.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Risk Factors:</div>
            <div className="flex flex-wrap gap-1">
              {reply.risk_flags.map((flag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Reply Body Preview */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Draft Reply:</div>
          <div className="text-sm bg-muted/50 p-3 rounded-md">
            {showFullBody ? (
              <div className="whitespace-pre-wrap">{reply.draft_body}</div>
            ) : (
              <div className="line-clamp-3">{reply.draft_body}</div>
            )}
          </div>
          {reply.draft_body.length > 200 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowFullBody(!showFullBody)}
              className="p-0 h-auto text-xs"
            >
              {showFullBody ? 'Show less' : 'Show more'}
            </Button>
          )}
        </div>

        {/* Rationale */}
        {reply.rationale && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">AI Rationale:</div>
            <div className="text-xs text-muted-foreground italic">
              {reply.rationale}
            </div>
          </div>
        )}

        {/* Error Message */}
        {reply.error_message && (
          <div className="space-y-1">
            <div className="text-xs text-destructive">Error:</div>
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {reply.error_message}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {reply.status === 'needs_approval' && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onApprove(reply.id)}
              className="flex-1"
              size="sm"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve & Send
            </Button>
            <Button
              onClick={() => onCancel(reply.id)}
              variant="outline"
              size="sm"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
