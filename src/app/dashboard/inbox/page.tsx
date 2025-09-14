'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  RefreshCw, 
  Search, 
  Filter,
  Trash2,
  Mail,
  CheckSquare,
  Square,
  MoreHorizontal,
  UserPlus
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContactViewModal } from '@/components/contacts/ContactViewModal'
import { AddContactModal } from '@/components/contacts/AddContactModal'
import { EmailListItem } from '@/components/EmailListItem'
import { motion, AnimatePresence } from 'framer-motion'

interface EmailAccount {
  id: string
  email: string
  provider: string
}

interface Campaign {
  id: string
  name: string
}

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

interface EmailReply {
  campaign_id: string | null
  contact_id: string | null
  campaigns: Campaign | null
  contacts: Contact | null
}

interface IncomingEmail {
  id: string
  from_address: string
  subject: string
  date_received: string
  classification_status: 'unclassified' | 'bounce' | 'auto_reply' | 'human_reply' | 'unsubscribe' | 'spam'
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  classification_confidence: number | null
  text_content: string | null
  html_content: string | null
  created_at: string
  email_accounts: EmailAccount
  email_replies: EmailReply[]
}

export default function InboxPage() {
  const [emails, setEmails] = useState<IncomingEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [selectedEmail, setSelectedEmail] = useState<IncomingEmail | null>(null)
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [syncing, setSyncing] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')
  const [lastSyncTime, setLastSyncTime] = useState<number>(0)
  const [contactsData, setContactsData] = useState<Record<string, Contact>>({})
  const [contactDataLoading, setContactDataLoading] = useState<Record<string, boolean>>({})
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)

  // Auto-sync functionality
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!autoSyncing) return
      
      const now = Date.now()
      const timeSinceLastSync = now - lastSyncTime
      const minSyncInterval = 30000 // 30 seconds minimum between syncs
      
      if (timeSinceLastSync < minSyncInterval) return
      
      try {
        setSyncStatus('Auto-syncing...')
        await forceSync(selectedAccount === 'all' ? undefined : selectedAccount)
        setSyncStatus('Auto-sync completed')
        setTimeout(() => setSyncStatus(''), 3000)
      } catch (error: any) {
        console.log('Auto-sync skipped:', error.message)
        setSyncStatus('')
      }
    }, 45000) // Check every 45 seconds
    
    return () => clearInterval(interval)
  }, [autoSyncing, selectedAccount, lastSyncTime])

  useEffect(() => {
    fetchEmails()
    fetchEmailAccounts()
  }, [selectedAccount, filter, searchTerm])

  const preloadContactsForEmails = async (emailList: IncomingEmail[]) => {
    const emailsNeedingContacts = emailList.filter(email => {
      const reply = email.email_replies?.[0]
      return reply?.contact_id && !contactsData[reply.contact_id] && !contactDataLoading[reply.contact_id]
    })

    if (emailsNeedingContacts.length === 0) return

    const contactIds = emailsNeedingContacts.map(email => email.email_replies[0].contact_id).filter(Boolean) as string[]
    
    // Mark as loading to prevent duplicate requests
    const newLoadingState = { ...contactDataLoading }
    contactIds.forEach(id => newLoadingState[id] = true)
    setContactDataLoading(newLoadingState)

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds })
      })

      if (response.ok) {
        const data = await response.json()
        const newContactsData = { ...contactsData }
        data.contacts?.forEach((contact: Contact) => {
          newContactsData[contact.id] = contact
        })
        setContactsData(newContactsData)
      }
    } catch (error) {
      console.error('Error preloading contacts:', error)
    } finally {
      // Clear loading state
      const clearedLoadingState = { ...contactDataLoading }
      contactIds.forEach(id => delete clearedLoadingState[id])
      setContactDataLoading(clearedLoadingState)
    }
  }

  const fetchEmails = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (selectedAccount && selectedAccount !== 'all') {
        params.append('account_id', selectedAccount)
      }
      if (filter && filter !== 'all') {
        params.append('classification', filter)
      }
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      
      const url = `/api/inbox/emails?${params.toString()}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const emailList = data.emails || []
        setEmails(emailList)
        
        // Preload contact data to prevent button flashing
        await preloadContactsForEmails(emailList)
      }
    } catch (error) {
      console.error('Error fetching emails:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmailAccounts = async () => {
    try {
      const response = await fetch('/api/inbox/email-accounts')
      if (response.ok) {
        const data = await response.json()
        setEmailAccounts(data.emailAccounts || [])
      }
    } catch (error) {
      console.error('Error fetching email accounts:', error)
    }
  }

  const forceSync = async (accountId?: string) => {
    try {
      setSyncing(true)
      setLastSyncTime(Date.now()) // Update last sync time for rate limiting
      
      const response = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailAccountId: accountId === 'all' ? null : accountId
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        console.log('Sync completed:', data.message)
        // Automatically refresh emails after successful sync
        await fetchEmails()
        return data // Return the sync result
      } else {
        console.error('Sync failed:', data.error)
        
        // Handle different error types
        if (response.status === 429 || data.error?.includes('Rate limit')) {
          throw new Error('Rate limit exceeded - please wait before syncing again')
        } else {
          throw new Error(data.error || 'Sync failed')
        }
      }
      
    } catch (error) {
      console.error('Error during force sync:', error)
      throw error // Re-throw so calling code can handle it
    } finally {
      setSyncing(false)
    }
  }

  const deleteEmail = async (emailId: string) => {
    // Optimistic UI update
    setEmails(prev => prev.filter(e => e.id !== emailId))
    setSelectedEmails(prev => {
      const newSet = new Set(prev)
      newSet.delete(emailId)
      return newSet
    })

    try {
      const res = await fetch('/api/inbox/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds: [emailId] })
      })

      if (!res.ok) {
        console.error('Failed to delete email')
        // Revert optimistic update on failure
        fetchEmails()
      }
    } catch (error) {
      console.error('Error deleting email:', error)
      // Revert optimistic update on failure
      fetchEmails()
    }
  }

  const deleteSelectedEmails = async () => {
    if (selectedEmails.size === 0) return

    const emailIds = Array.from(selectedEmails)
    
    // Optimistic UI update
    setEmails(prev => prev.filter(e => !selectedEmails.has(e.id)))
    setSelectedEmails(new Set())
    setSelectionMode(false)

    try {
      const res = await fetch('/api/inbox/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds })
      })

      if (!res.ok) {
        console.error('Failed to delete emails')
        // Revert optimistic update on failure
        fetchEmails()
      }
    } catch (error) {
      console.error('Error deleting emails:', error)
      // Revert optimistic update on failure
      fetchEmails()
    }
  }

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev)
      if (newSet.has(emailId)) {
        newSet.delete(emailId)
      } else {
        newSet.add(emailId)
      }
      return newSet
    })
  }

  const selectAllEmails = () => {
    const allEmailIds = new Set(emails.map(email => email.id))
    setSelectedEmails(allEmailIds)
  }

  const clearSelection = () => {
    setSelectedEmails(new Set())
    setSelectionMode(false)
  }

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact)
    setIsContactModalOpen(true)
  }

  const handleContactModalClose = () => {
    setIsContactModalOpen(false)
    setSelectedContact(null)
  }

  const filteredEmails = emails // Server-side filtering now handles all filters

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} 
              {selectionMode && selectedEmails.size > 0 && (
                <span className="ml-2 text-blue-600">
                  • {selectedEmails.size} selected
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Selection Mode Toggle */}
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode)
                if (!selectionMode) {
                  setSelectedEmails(new Set())
                }
              }}
            >
              {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </Button>

            {/* Auto-sync Toggle */}
            <Button
              variant={autoSyncing ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoSyncing(!autoSyncing)}
            >
              <RefreshCw className={`h-4 w-4 ${autoSyncing ? 'animate-spin' : ''}`} />
              {autoSyncing ? 'Auto' : 'Manual'}
            </Button>

            {/* Manual Sync */}
            <Button
              onClick={() => forceSync(selectedAccount === 'all' ? undefined : selectedAccount)}
              disabled={syncing}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>

            {/* Add Contact */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddContactModalOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {emailAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Emails</SelectItem>
                <SelectItem value="unclassified">Unclassified</SelectItem>
                <SelectItem value="human_reply">Replies</SelectItem>
                <SelectItem value="bounce">Bounces</SelectItem>
                <SelectItem value="auto_reply">Auto-Replies</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="unsubscribe">Unsubscribes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selection Actions Bar */}
        <AnimatePresence>
          {selectionMode && selectedEmails.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllEmails}
                    className="text-blue-700 border-blue-300"
                  >
                    Select All
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteSelectedEmails}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    className="text-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Status */}
        {syncStatus && (
          <div className="mt-4 text-sm text-blue-600">
            {syncStatus}
          </div>
        )}
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-auto p-6">
        {filteredEmails.length === 0 ? (
          <div className="text-center py-16">
            <Mail className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">No emails found</p>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {filteredEmails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                onEmailClick={setSelectedEmail}
                onDelete={deleteEmail}
                onContactClick={handleContactClick}
                isSelected={selectedEmails.has(email.id)}
                selectionMode={selectionMode}
                onSelectionToggle={toggleEmailSelection}
              />
            ))}
          </div>
        )}
      </div>

      {/* Email Detail Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold truncate">
                {selectedEmail.subject || '(No Subject)'}
              </h2>
              <Button variant="outline" onClick={() => setSelectedEmail(null)}>
                Close
              </Button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="font-medium text-gray-900">{selectedEmail.from_address}</p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedEmail.date_received).toLocaleString()}
                </p>
              </div>
              <div className="prose max-w-none">
                {selectedEmail.html_content ? (
                  <div 
                    className="email-content"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">
                    {selectedEmail.text_content || 'No content available'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact View Modal */}
      {isContactModalOpen && selectedContact && (
        <ContactViewModal
          contact={selectedContact}
          isOpen={isContactModalOpen}
          onClose={handleContactModalClose}
        />
      )}

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddContactModalOpen}
        onClose={() => setIsAddContactModalOpen(false)}
        onContactAdded={() => {
          // Refresh contacts data if needed
          setIsAddContactModalOpen(false)
        }}
      />
    </div>
  )
}