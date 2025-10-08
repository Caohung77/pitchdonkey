'use client'

import { useEffect, useState } from 'react'
import { ApiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Mail,
  RefreshCw,
  Search,
  Bot,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'

interface IncomingEmail {
  id: string
  from_address: string
  subject: string
  text_content: string
  date_received: string
  classification_status: string
  processing_status: string
  flags: string[]
  email_account?: {
    email: string
    assigned_agent?: {
      name: string
    }
  }
  reply_job?: {
    id: string
    status: string
    draft_subject: string
    scheduled_at: string
    agent?: {
      name: string
    }
  }
}

export default function InboxPage() {
  const [emails, setEmails] = useState<IncomingEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('all')

  useEffect(() => {
    loadEmails()
  }, [classificationFilter])

  const loadEmails = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '50',
        include_reply_jobs: 'true',
      })

      if (classificationFilter !== 'all') {
        params.set('classification', classificationFilter)
      }

      const response = await ApiClient.get(`/api/inbox?${params.toString()}`)
      setEmails(response.data.emails || [])
    } catch (error) {
      console.error('Error loading emails:', error)
      toast.error('Failed to load emails')
    } finally {
      setLoading(false)
    }
  }

  const filteredEmails = emails.filter((email) =>
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.from_address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Mailbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Inbox • All accounts • {emails.length} messages
          </p>
        </div>
        <Button onClick={loadEmails} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incoming mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={classificationFilter} onValueChange={setClassificationFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classifications</SelectItem>
            <SelectItem value="human_reply">Human Replies</SelectItem>
            <SelectItem value="auto_reply">Auto Replies</SelectItem>
            <SelectItem value="bounce">Bounces</SelectItem>
            <SelectItem value="unsubscribe">Unsubscribes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Emails List */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-4">Loading emails...</p>
        </div>
      ) : filteredEmails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No emails</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'No emails match your search.'
                : 'Your incoming emails will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEmails.map((email) => (
            <Card
              key={email.id}
              className={`transition-colors hover:bg-accent/50 ${
                !email.flags?.includes('SEEN') ? 'bg-blue-50/30' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{email.from_address}</h3>
                      {!email.flags?.includes('SEEN') && (
                        <Badge variant="default" className="text-xs">
                          New
                        </Badge>
                      )}
                      {email.classification_status && email.classification_status !== 'unclassified' && (
                        <Badge variant="outline" className="text-xs">
                          {email.classification_status}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-sm mb-2">{email.subject}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {email.text_content}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(email.date_received).toLocaleString()}
                      </span>
                      <span>→ {email.email_account?.email}</span>
                    </div>
                  </div>

                  {/* Reply Status Indicator */}
                  <div className="flex flex-col items-end gap-2">
                    {email.reply_job ? (
                      <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded border border-green-200">
                        <Bot className="h-4 w-4" />
                        <div className="text-xs">
                          <div className="font-medium">
                            {email.reply_job.agent?.name || 'Agent'}: replied
                          </div>
                          {email.reply_job.status === 'needs_approval' && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <AlertCircle className="h-3 w-3" />
                              <span>Needs approval</span>
                            </div>
                          )}
                          {email.reply_job.status === 'scheduled' && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Scheduled</span>
                            </div>
                          )}
                          {email.reply_job.status === 'sent' && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              <span>Sent</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : email.email_account?.assigned_agent ? (
                      <div className="text-xs text-muted-foreground">
                        {email.processing_status === 'pending' ? 'Processing...' : 'No reply drafted'}
                      </div>
                    ) : null}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (email.reply_job) {
                          window.location.href = '/dashboard/scheduled-replies'
                        }
                      }}
                    >
                      {email.reply_job ? 'View Reply' : 'View'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
