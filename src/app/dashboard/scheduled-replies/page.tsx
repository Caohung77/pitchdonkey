'use client'

import { useEffect, useState } from 'react'
import { ApiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScheduledReplyCard } from '@/components/scheduled-replies/ScheduledReplyCard'
import { EditReplyDialog } from '@/components/scheduled-replies/EditReplyDialog'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { toast } from 'sonner'
import {
  AlertCircle,
  Bot,
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  Shield,
} from 'lucide-react'
import type { ScheduledReply, ScheduledReplyStats } from '@/lib/scheduled-replies'

export default function ScheduledRepliesPage() {
  const [replies, setReplies] = useState<ScheduledReply[]>([])
  const [stats, setStats] = useState<ScheduledReplyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [editingReply, setEditingReply] = useState<ScheduledReply | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
    variant?: 'default' | 'destructive'
  }>({ open: false, title: '', description: '', action: () => {}, variant: 'default' })

  useEffect(() => {
    loadReplies()
  }, [statusFilter])

  const loadReplies = async () => {
    try {
      setLoading(true)

      // Build query params
      const params = new URLSearchParams({
        include_stats: 'true',
        limit: '100',
      })

      // Apply status filter
      if (statusFilter === 'active') {
        params.set('status', 'scheduled,needs_approval,approved,sending')
      } else if (statusFilter === 'needs_approval') {
        params.set('status', 'needs_approval')
      } else if (statusFilter === 'completed') {
        params.set('status', 'sent,cancelled')
      } else if (statusFilter === 'failed') {
        params.set('status', 'failed')
      }

      const response = await ApiClient.get(`/api/scheduled-replies?${params.toString()}`)

      setReplies(response.data.replies || [])
      setStats(response.data.stats || null)
    } catch (error) {
      console.error('Error loading scheduled replies:', error)
      toast.error('Failed to load scheduled replies')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (replyId: string) => {
    const reply = replies.find((r) => r.id === replyId)
    if (!reply) return

    setConfirmDialog({
      open: true,
      title: 'Approve Reply',
      description: `Are you sure you want to approve this reply to ${
        reply.contact?.email || reply.incoming_email?.from_address
      }? It will be sent at the scheduled time.`,
      variant: 'default',
      action: async () => {
        try {
          await ApiClient.post(`/api/scheduled-replies/${replyId}`, {
            action: 'approve',
          })
          toast.success('Reply approved successfully')
          loadReplies()
        } catch (error) {
          console.error('Error approving reply:', error)
          toast.error('Failed to approve reply')
        }
      },
    })
  }

  const handleCancel = async (replyId: string) => {
    const reply = replies.find((r) => r.id === replyId)
    if (!reply) return

    setConfirmDialog({
      open: true,
      title: 'Cancel Reply',
      description: `Are you sure you want to cancel this reply to ${
        reply.contact?.email || reply.incoming_email?.from_address
      }? This action cannot be undone.`,
      variant: 'destructive',
      action: async () => {
        try {
          await ApiClient.post(`/api/scheduled-replies/${replyId}`, {
            action: 'cancel',
          })
          toast.success('Reply cancelled successfully')
          loadReplies()
        } catch (error) {
          console.error('Error cancelling reply:', error)
          toast.error('Failed to cancel reply')
        }
      },
    })
  }

  const handleEdit = (reply: ScheduledReply) => {
    setEditingReply(reply)
  }

  const handleSaveEdit = async (
    replyId: string,
    subject: string,
    body: string
  ) => {
    try {
      await ApiClient.put(`/api/scheduled-replies/${replyId}`, {
        draft_subject: subject,
        draft_body: body,
      })
      toast.success('Reply updated successfully')
      loadReplies()
    } catch (error: any) {
      console.error('Error updating reply:', error)
      if (error.message?.includes('no longer editable')) {
        toast.error('Reply is no longer editable (editing window has expired)')
      } else if (error.message?.includes('Cannot edit reply')) {
        toast.error('Cannot edit reply in current status')
      } else {
        toast.error('Failed to update reply')
      }
      throw error
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8" />
            Scheduled Replies
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage AI-generated autonomous email replies
          </p>
        </div>
        <Button onClick={loadReplies} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Total Active</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Needs Approval</div>
                  <div className="text-2xl font-bold text-warning">
                    {stats.needs_approval}
                  </div>
                </div>
                <AlertCircle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Next 24h</div>
                  <div className="text-2xl font-bold">{stats.upcoming_24h}</div>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Avg Risk</div>
                  <div className="text-2xl font-bold">
                    {(stats.avg_risk_score * 100).toFixed(0)}%
                  </div>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="needs_approval">Needs Approval</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {stats && (
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline">
              <CheckCircle className="h-3 w-3 mr-1" />
              {stats.by_status.sent || 0} sent
            </Badge>
            <Badge variant="outline">
              {stats.by_status.failed || 0} failed
            </Badge>
          </div>
        )}
      </div>

      {/* Replies List */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-4">Loading scheduled replies...</p>
        </div>
      ) : replies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled replies</h3>
            <p className="text-muted-foreground">
              {statusFilter === 'needs_approval'
                ? 'No replies currently need approval.'
                : statusFilter === 'completed'
                ? 'No completed replies yet.'
                : statusFilter === 'failed'
                ? 'No failed replies.'
                : 'Your autonomous replies will appear here when AI agents draft responses.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {replies.map((reply) => (
            <ScheduledReplyCard
              key={reply.id}
              reply={reply}
              onApprove={handleApprove}
              onCancel={handleCancel}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <EditReplyDialog
        reply={editingReply}
        open={!!editingReply}
        onOpenChange={(open) => !open && setEditingReply(null)}
        onSave={handleSaveEdit}
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.variant === 'destructive' ? 'Cancel Reply' : 'Approve'}
        onConfirm={confirmDialog.action}
      />
    </div>
  )
}
