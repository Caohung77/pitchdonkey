'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Plus, AlertCircle, Settings, CheckCircle, XCircle } from 'lucide-react'
import SMTPConfigDialog from '@/components/email-accounts/SMTPConfigDialog'
import EditEmailAccountDialog from '@/components/email-accounts/EditEmailAccountDialog'
import DomainAuthDialog from '@/components/email-accounts/DomainAuthDialog'

interface EmailAccount {
  id: string
  provider: string
  email: string
  status: string
  domain: string
  dkim_verified: boolean
  spf_verified: boolean
  dmarc_verified: boolean
  warmup_enabled: boolean
  warmup_stage: string
  daily_send_limit: number
  current_daily_sent: number
  reputation_score: string
  bounce_rate: string
  complaint_rate: string
  smtp_host?: string
  smtp_port?: number
  smtp_username?: string
  smtp_secure?: boolean
  created_at: string
}

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const fetchAccounts = async () => {
    try {
      setIsLoading(true)
      setError('') // Clear any previous errors
      const response = await fetch('/api/email-accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.data || [])
      } else {
        // Only show error for actual server errors, not empty results
        if (response.status >= 500) {
          setError('Failed to load email accounts')
        } else {
          console.error('API error:', response.status)
          setAccounts([]) // Just set empty array for other errors
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      // Only show error for network/connection issues
      setError('Unable to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
    
    // Check for OAuth success/error messages
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')
    
    if (success === 'gmail_connected') {
      setSuccessMessage('Gmail account connected successfully!')
    } else if (success === 'outlook_connected') {
      setSuccessMessage('Outlook account connected successfully!')
    } else if (error === 'oauth_cancelled') {
      setError('OAuth authorization was cancelled')
    } else if (error === 'oauth_invalid') {
      setError('Invalid OAuth response')
    } else if (error === 'oauth_expired') {
      setError('OAuth session expired. Please try again.')
    } else if (error === 'oauth_failed') {
      setError('Failed to connect email account')
    } else if (error === 'account_exists') {
      setError('This email account is already connected')
    }
    
    // Clear URL parameters
    if (success || error) {
      window.history.replaceState({}, '', '/dashboard/email-accounts')
    }
  }, [])

  const handleAccountAdded = () => {
    fetchAccounts()
  }

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this email account?')) {
      return
    }

    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setAccounts(accounts.filter(account => account.id !== accountId))
      } else {
        throw new Error('Failed to delete email account')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      setError('Failed to delete email account')
    }
  }

  const handleTest = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email-accounts/${accountId}/test`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Connection test successful: ${data.data.message}`)
      } else {
        throw new Error('Connection test failed')
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      alert('Connection test failed')
    }
  }

  const handleSendTest = async (accountId: string, email: string) => {
    const to = prompt('Enter email address to send test to:', email)
    if (!to) return

    const subject = prompt('Enter subject:', 'Test Email from ColdReach Pro')
    if (!subject) return

    const message = prompt('Enter message:', 'This is a test email to verify that email sending is working correctly.')
    if (!message) return

    try {
      const response = await fetch(`/api/email-accounts/${accountId}/send-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          message
        })
      })

      const data = await response.json()

      if (response.ok) {
        alert(`✅ Test email sent successfully!\n\nFrom: ${data.data.from}\nTo: ${data.data.to}\nMessage ID: ${data.data.messageId}`)
      } else {
        alert(`❌ Failed to send test email:\n${data.error}\n${data.details || ''}`)
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      alert('❌ Failed to send test email')
    }
  }

  const handleActivate = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'active',
        }),
      })

      if (response.ok) {
        setSuccessMessage('Email account activated successfully!')
        fetchAccounts() // Refresh the accounts list
      } else {
        throw new Error('Failed to activate email account')
      }
    } catch (error) {
      console.error('Error activating account:', error)
      setError('Failed to activate email account')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Accounts</h1>
          <p className="text-muted-foreground">
            Manage your connected email accounts for sending campaigns
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Connect Account
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No email accounts connected</h3>
              <p className="text-gray-600 mb-6">
                Connect your first email account to start sending cold email campaigns
              </p>
              <div className="flex space-x-3 justify-center">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Gmail
                </Button>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Outlook
                </Button>
                <SMTPConfigDialog onAccountCreated={handleAccountAdded} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{account.email}</CardTitle>
                  {account.dkim_verified && account.spf_verified && account.dmarc_verified ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span>{account.provider} • {account.status === 'active' ? 'Active' : account.status}</span>
                  {!account.dkim_verified || !account.spf_verified || !account.dmarc_verified ? (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      Auth Required
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Daily Limit:</span>
                    <span>{account.daily_send_limit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Warmup:</span>
                    <span>{account.warmup_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reputation:</span>
                    <span>{account.reputation_score}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Domain Auth:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs">
                        {account.dkim_verified && account.spf_verified && account.dmarc_verified 
                          ? '✓ Verified' 
                          : account.spf_verified || account.dkim_verified || account.dmarc_verified
                            ? '⚠ Partial'
                            : '❌ Not Setup'
                        }
                      </span>
                      <div className="flex gap-1">
                        {account.spf_verified ? (
                          <span className="text-xs text-green-600" title="SPF Verified">S</span>
                        ) : (
                          <span className="text-xs text-gray-400" title="SPF Not Verified">S</span>
                        )}
                        {account.dkim_verified ? (
                          <span className="text-xs text-green-600" title="DKIM Verified">D</span>
                        ) : (
                          <span className="text-xs text-gray-400" title="DKIM Not Verified">D</span>
                        )}
                        {account.dmarc_verified ? (
                          <span className="text-xs text-green-600" title="DMARC Verified">M</span>
                        ) : (
                          <span className="text-xs text-gray-400" title="DMARC Not Verified">M</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleTest(account.id)}>
                    Test Connection
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSendTest(account.id, account.email)}>
                    Send Test Email
                  </Button>
                  {account.status === 'pending' && (
                    <Button size="sm" onClick={() => handleActivate(account.id)}>
                      Activate
                    </Button>
                  )}
                  <EditEmailAccountDialog 
                    account={account} 
                    onAccountUpdated={fetchAccounts}
                  />
                  <DomainAuthDialog domain={account.domain} />
                  <Button size="sm" variant="outline" onClick={() => handleDelete(account.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}