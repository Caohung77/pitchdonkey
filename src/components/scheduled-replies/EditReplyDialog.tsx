'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ScheduledReply } from '@/lib/scheduled-replies'

interface EditReplyDialogProps {
  reply: ScheduledReply | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (replyId: string, subject: string, body: string) => Promise<void>
}

export function EditReplyDialog({
  reply,
  open,
  onOpenChange,
  onSave,
}: EditReplyDialogProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  // Update form when reply changes - use useEffect instead of direct state update
  useEffect(() => {
    if (reply) {
      setSubject(reply.draft_subject)
      setBody(reply.draft_body)
    }
  }, [reply?.id]) // Only update when reply ID changes

  const handleSave = async () => {
    if (!reply) return

    setSaving(true)
    try {
      await onSave(reply.id, subject, body)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving reply:', error)
      // Error handling is done in parent
    } finally {
      setSaving(false)
    }
  }

  if (!reply) return null

  // Calculate editable_until from scheduled_at if missing
  const editableUntil = reply.editable_until
    ? new Date(reply.editable_until)
    : new Date(new Date(reply.scheduled_at).getTime() - 2 * 60 * 1000)
  const timeRemaining = formatDistanceToNow(editableUntil, { addSuffix: true })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Scheduled Reply</DialogTitle>
          <DialogDescription>
            Make changes to your scheduled reply. The reply will still be sent at the scheduled time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reply Info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">
              <Clock className="h-3 w-3 mr-1" />
              Sending {formatDistanceToNow(new Date(reply.scheduled_at), { addSuffix: true })}
            </Badge>
            <Badge variant="outline">
              <Shield className="h-3 w-3 mr-1" />
              Risk: {(reply.risk_score * 100).toFixed(0)}%
            </Badge>
            <Badge variant="warning">
              <AlertCircle className="h-3 w-3 mr-1" />
              Editable {timeRemaining}
            </Badge>
          </div>

          {/* Contact Info */}
          <div className="bg-muted/50 p-3 rounded-md space-y-1">
            <div className="text-xs text-muted-foreground">Replying to:</div>
            <div className="font-medium">
              {reply.contact?.first_name || reply.contact?.last_name
                ? `${reply.contact.first_name || ''} ${reply.contact.last_name || ''}`.trim()
                : reply.incoming_email?.from_address || 'Unknown'}
            </div>
            <div className="text-sm text-muted-foreground">
              {reply.contact?.email || reply.incoming_email?.from_address}
            </div>
          </div>

          {/* Subject Input */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Body Textarea */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body"
              rows={12}
              className="font-mono text-sm"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{body.length} characters</span>
              {body.length < 100 && (
                <span className="text-warning">⚠️ Message may be too short</span>
              )}
              {body.length > 2000 && (
                <span className="text-warning">⚠️ Message may be too long</span>
              )}
            </div>
          </div>

          {/* Original AI Rationale */}
          {reply.rationale && (
            <div className="bg-muted/50 p-3 rounded-md space-y-1">
              <div className="text-xs text-muted-foreground">Original AI Rationale:</div>
              <div className="text-sm italic">{reply.rationale}</div>
            </div>
          )}

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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !subject.trim() || !body.trim()}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
