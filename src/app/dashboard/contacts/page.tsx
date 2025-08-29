'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ContactsErrorBoundary } from '@/components/contacts/ContactsErrorBoundary'
import { ContactsList } from '@/components/contacts/ContactsList'
import { ContactsStats } from '@/components/contacts/ContactsStats'
import { ContactsFilters } from '@/components/contacts/ContactsFilters'
import { AddContactModal } from '@/components/contacts/AddContactModal'
import { ImportContactsModal } from '@/components/contacts/ImportContactsModal'
import { SegmentManager } from '@/components/contacts/SegmentManager'
import { ContactListManager } from '@/components/contacts/ContactListManager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ContactsPageState {
  searchTerm: string
  statusFilter: string
  activeTab: string
}

function ContactsPageContent() {
  // Use AuthProvider instead of direct session management
  const { user, loading, error, refreshUser } = useAuth()
  
  const [state, setState] = useState<ContactsPageState>({
    searchTerm: '',
    statusFilter: 'all',
    activeTab: 'contacts'
  })

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

  const handleNavigateToContacts = () => {
    setState(prev => ({ ...prev, activeTab: 'contacts' }))
  }

  // Loading state
  if (loading) {
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
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={refreshUser} className="w-full">
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
  if (!user) {
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
    <div className="space-y-6">
      {/* Main Content */}
      <div>
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
              <p className="text-gray-600">Manage your contact database and segments</p>
            </div>
            <div className="flex space-x-3">
              <ImportContactsModal onImportComplete={handleContactAdded} />
              <AddContactModal 
                onContactAdded={handleContactAdded} 
                onNavigateToContacts={handleNavigateToContacts}
              />
            </div>
          </div>
        </div>

        <Tabs 
          value={state.activeTab} 
          onValueChange={(value) => setState(prev => ({ ...prev, activeTab: value }))}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="lists">Lists</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-6">
            {/* Contact Statistics */}
            <ContactsStats userId={user.id} />

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
              userId={user.id}
              searchTerm={state.searchTerm}
              statusFilter={state.statusFilter}
            />
          </TabsContent>

          <TabsContent value="segments">
            <SegmentManager userId={user.id} />
          </TabsContent>

          <TabsContent value="lists">
            <ContactListManager userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function ContactsPage() {
  return (
    <ContactsErrorBoundary>
      <ContactsPageContent />
    </ContactsErrorBoundary>
  )
}