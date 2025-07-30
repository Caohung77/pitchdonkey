'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, LogOut, Plus, AlertCircle } from 'lucide-react'
import EmailAccountCard from '@/components/email-accounts/EmailAccountCard'
import AddEmailAccountDialog from '@/components/email-accounts/AddEmailAccountDialog'
import SMTPConfigDialog from '@/components/email-accounts/SMTPConfigDialog'

interface EmailAccount {
  id: string
  provider: string
  email: string
  name: string
  is_verified: boolean
  is_active: boolean
  settings: {
    daily_limit: number
    delay_between_emails: number
    warm_up_enabled: boolean
  }
  created_at: string
}

export default function EmailAccountsPage() {
  return (
    <ProtectedRoute>
      <EmailAccountsContent />
    </ProtectedRoute>
  )
}

function EmailAccountsContent() {
  const { user, signOut } = useAuth()
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const fetchAccounts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/email-accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.data || [])
      } else {
        throw new Error('Failed to fetch email accounts')
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setError('Failed to load email accounts')
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

  const handleEdit = (account: EmailAccount) => {
    // TODO: Implement edit functionality
    console.log('Edit account:', account)
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

  const handleVerify = async (accountId: string) => {
    try {
      const response = await fetch(`/api/email-accounts/${accountId}/verify`, {
        method: 'POST',
      })

      if (response.ok) {
        // Refresh accounts to show updated verification status
        fetchAccounts()
        alert('Email account verified successfully')
      } else {
        throw new Error('Verification failed')
      }
    } catch (error) {
      console.error('Error verifying account:', error)
      alert('Verification failed')
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">ColdReach Pro</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.user_metadata?.full_name || user?.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Email Accounts</h1>
              <p className="text-gray-600">Manage your connected email accounts for sending campaigns</p>
            </div>
            <div className="flex space-x-3">
              <AddEmailAccountDialog onAccountAdded={handleAccountAdded} />
              <SMTPConfigDialog onAccountCreated={handleAccountAdded} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-green-800">{successMessage}</span>
            </div>
          </div>
        )}

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
                  <AddEmailAccountDialog onAccountAdded={handleAccountAdded} />
                  <SMTPConfigDialog onAccountCreated={handleAccountAdded} />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <EmailAccountCard
                key={account.id}
                account={account}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTest={handleTest}
                onVerify={handleVerify}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}