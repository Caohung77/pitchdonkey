'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import { Mail, LogOut, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ContactsErrorBoundary } from '@/components/contacts/ContactsErrorBoundary'
import { ContactsList } from '@/components/contacts/ContactsList'
import { ContactsStats } from '@/components/contacts/ContactsStats'
import { ContactsFilters } from '@/components/contacts/ContactsFilters'
import { AddContactModal } from '@/components/contacts/AddContactModal'
import { ImportContactsModal } from '@/components/contacts/ImportContactsModal'
import { ToastProvider, useToast } from '@/components/ui/toast'

interface User {
  id: string
  email: string
  name: string
}

interface ContactsPageState {
  user: User | null
  loading: boolean
  error: string | null
  sessionChecked: boolean
  searchTerm: string
  statusFilter: string
}

function ContactsPageContent() {
  const [state, setState] = useState<ContactsPageState>({
    user: null,
    loading: true,
    error: null,
    sessionChecked: false,
    searchTerm: '',
    statusFilter: 'all'
  })

  // Direct session management without AuthProvider
  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      console.log('ContactsPage: Checking session...')
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('ContactsPage: Session error:', sessionError)
        setState(prev => ({
          ...prev,
          error: 'Session error: ' + sessionError.message,
          loading: false,
          sessionChecked: true
        }))
        return
      }

      if (!session?.user) {
        console.log('ContactsPage: No session found')
        setState(prev => ({
          ...prev,
          user: null,
          loading: false,
          sessionChecked: true
        }))
        return
      }

      console.log('ContactsPage: Session found for user:', session.user.email)
      
      // Create user object from session
      const user: User = {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.user_metadata?.full_name || 
              session.user.user_metadata?.name || 
              session.user.email?.split('@')[0] || 
              'User'
      }

      setState(prev => ({
        ...prev,
        user,
        loading: false,
        sessionChecked: true,
        error: null
      }))

    } catch (error) {
      console.error('ContactsPage: Error checking session:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to check authentication',
        loading: false,
        sessionChecked: true
      }))
    }
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        setState(prev => ({ ...prev, error: 'Failed to sign out' }))
      } else {
        setState(prev => ({
          ...prev,
          user: null,
          error: null
        }))
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setState(prev => ({ ...prev, error: 'Failed to sign out' }))
    }
  }

  const handleRetrySession = () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    checkSession()
  }

  // Filter handlers
  const handleSearchChange = (searchTerm: string) => {
    setState(prev => ({ ...prev, searchTerm }))
  }

  const handleStatusFilterChange = (statusFilter: string) => {
    setState(prev => ({ ...prev, statusFilter }))
  }

  const handleClearFilters = () => {
    setState(prev => ({ ...prev, searchTerm: '', statusFilter: 'all' }))
  }

  // Contact handlers
  const handleContactAdded = () => {
    // Refresh the contacts list and stats when a new contact is added
    console.log('Contact added, refreshing data...')
    // The ContactsList and ContactsStats components will automatically refresh
    // due to their useEffect dependencies
  }

  // Loading state
  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading contacts...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (state.error && state.sessionChecked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
                <p className="text-gray-600 mb-4">{state.error}</p>
                <Button onClick={handleRetrySession} className="w-full">
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // No session state - show login prompt
  if (!state.user && state.sessionChecked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center">
                <Mail className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Sign In Required</h2>
                <p className="text-gray-600 mb-4">
                  Please sign in to access your contacts.
                </p>
                <Button 
                  onClick={() => window.location.href = '/auth/signin'}
                  className="w-full"
                >
                  Go to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main contacts interface
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
                Welcome, {state.user.name}
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
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
              <p className="text-gray-600">Manage your contact database</p>
            </div>
            <div className="flex space-x-3">
              <ImportContactsModal onImportComplete={handleContactAdded} />
              <AddContactModal onContactAdded={handleContactAdded} />
            </div>
          </div>
        </div>

        {/* Contact Statistics */}
        <ContactsStats userId={state.user.id} />

        {/* Search and Filters */}
        <ContactsFilters
          searchTerm={state.searchTerm}
          statusFilter={state.statusFilter}
          onSearchChange={handleSearchChange}
          onStatusFilterChange={handleStatusFilterChange}
          onClearFilters={handleClearFilters}
        />

        {/* Contacts List */}
        <ContactsList 
          userId={state.user.id}
          searchTerm={state.searchTerm}
          statusFilter={state.statusFilter}
        />
      </main>
    </div>
  )
}

export default function ContactsPage() {
  return (
    <ToastProvider>
      <ContactsErrorBoundary>
        <ContactsPageContent />
      </ContactsErrorBoundary>
    </ToastProvider>
  )
}