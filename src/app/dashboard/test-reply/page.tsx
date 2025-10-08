'use client'

import { useState, useEffect } from 'react'
import { ApiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { TestTube, Bot, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface EmailAccount {
  id: string
  email: string
  provider: string
  assigned_agent?: {
    name: string
  }
}

export default function TestReplyPage() {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    loadEmailAccounts()
  }, [])

  const loadEmailAccounts = async () => {
    try {
      const response = await ApiClient.get('/api/email-accounts')
      setEmailAccounts(response.data || [])
    } catch (error) {
      console.error('Error loading email accounts:', error)
      toast.error('Failed to load email accounts')
    }
  }

  const handleTest = async () => {
    if (!selectedAccount) {
      toast.error('Please select an email account')
      return
    }

    try {
      setLoading(true)
      setResult(null)

      const response = await ApiClient.post('/api/test-autonomous-reply', {
        email_account_id: selectedAccount,
        from_address: 'test@example.com',
        subject: 'Test: Interested in your product',
        body_text: 'Hi, I saw your website and I\'m interested in learning more about your product. Can you provide more information about pricing and features?',
      })

      setResult(response.data)

      if (response.data.processing.autonomous_draft_created) {
        toast.success('✅ Autonomous reply drafted successfully!')
      } else if (response.data.email_account.has_assigned_agent) {
        toast.warning('⚠️ Email processed but no reply drafted')
      } else {
        toast.warning('⚠️ No agent assigned to this email account')
      }
    } catch (error: any) {
      console.error('Error testing autonomous reply:', error)
      toast.error(error.message || 'Failed to test autonomous reply')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TestTube className="h-8 w-8" />
          Test Autonomous Reply System
        </h1>
        <p className="text-muted-foreground mt-1">
          Simulate an incoming email and test the autonomous reply workflow
        </p>
      </div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Select an email account to simulate an incoming email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Account</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an email account..." />
              </SelectTrigger>
              <SelectContent>
                {emailAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{account.email}</span>
                      {account.assigned_agent && (
                        <span className="ml-2 text-xs text-green-600 flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {account.assigned_agent.name}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <p className="text-xs text-muted-foreground">
                {emailAccounts.find(a => a.id === selectedAccount)?.assigned_agent
                  ? `✅ Agent assigned: ${emailAccounts.find(a => a.id === selectedAccount)?.assigned_agent?.name}`
                  : '⚠️ No agent assigned - reply will not be drafted'}
              </p>
            )}
          </div>

          <Button onClick={handleTest} disabled={loading || !selectedAccount} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.processing.autonomous_draft_created ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-600" />
              )}
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Incoming Email */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">📧 Incoming Email Created</h3>
              <div className="bg-blue-50 p-3 rounded text-sm space-y-1">
                <p><strong>From:</strong> {result.incoming_email.from}</p>
                <p><strong>Subject:</strong> {result.incoming_email.subject}</p>
                <p><strong>Classification:</strong> {result.incoming_email.classification}</p>
                <p><strong>ID:</strong> {result.incoming_email.id}</p>
              </div>
            </div>

            {/* Processing */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">⚙️ Processing Actions</h3>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <ul className="space-y-1">
                  {result.processing.actions_taken.map((action: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Reply Job */}
            {result.reply_job ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-green-600" />
                  Autonomous Reply Drafted
                </h3>
                <div className="bg-green-50 p-3 rounded text-sm space-y-1">
                  <p><strong>Agent:</strong> {result.reply_job.agent_name}</p>
                  <p><strong>Status:</strong> {result.reply_job.status}</p>
                  <p><strong>Subject:</strong> {result.reply_job.draft_subject}</p>
                  <p><strong>Risk Score:</strong> {(result.reply_job.risk_score * 100).toFixed(0)}%</p>
                  <p><strong>Scheduled:</strong> {new Date(result.reply_job.scheduled_at).toLocaleString()}</p>
                  {result.reply_job.requires_approval && (
                    <p className="text-orange-600 font-medium">⚠️ Requires manual approval</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-400" />
                  No Reply Drafted
                </h3>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p className="text-muted-foreground">
                    {result.email_account.has_assigned_agent
                      ? 'Email was processed but no autonomous reply was created. Check logs for details.'
                      : 'No agent is assigned to this email account.'}
                  </p>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">📝 Next Steps</h3>
              <ul className="bg-blue-50 p-3 rounded text-sm space-y-1">
                {result.next_steps.map((step: string, i: number) => (
                  <li key={i}>• {step}</li>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard/inbox'}>
                View Inbox
              </Button>
              {result.reply_job && (
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard/scheduled-replies'}>
                  View Scheduled Replies
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="space-y-2">
            <li>Select an email account (preferably one with an assigned agent)</li>
            <li>Click "Run Test" to simulate an incoming email</li>
            <li>The system will:
              <ul>
                <li>Create a fake incoming email</li>
                <li>Classify it as a "human_reply"</li>
                <li>Check if the email account has an assigned agent</li>
                <li>If yes, draft an autonomous reply using AI</li>
                <li>Schedule the reply (or mark as needs approval if high risk)</li>
              </ul>
            </li>
            <li>View the results and check the inbox/scheduled replies pages</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
