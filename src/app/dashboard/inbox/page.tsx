'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  Search, 
  Filter,
  Archive,
  Trash2,
  ExternalLink,
  Mail,
  MailOpen,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Target,
  User,
  ChevronDown,
  Eye,
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
  
  // Contact modal states
  const [contactViewModalOpen, setContactViewModalOpen] = useState(false)
  const [addContactModalOpen, setAddContactModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [contactsData, setContactsData] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    fetchEmails()
    fetchEmailAccounts()
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [selectedAccount, filter, searchTerm])

  const fetchEmails = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (selectedAccount !== 'all') {
        params.append('account_id', selectedAccount)
      }
      if (filter !== 'all') {
        params.append('classification', filter)
      }
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      
      const url = `/api/inbox/emails${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setEmails(data.emails || [])
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
      } else {
        console.error('Sync failed:', data.error)
        // You might want to show a toast notification here
      }
      
    } catch (error) {
      console.error('Error during force sync:', error)
    } finally {
      setSyncing(false)
    }
  }

  const getClassificationBadge = (classification: string, confidence: number | null) => {
    const badges = {
      human_reply: { icon: MessageSquare, color: 'bg-green-100 text-green-800', label: 'Reply' },
      bounce: { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Bounce' },
      auto_reply: { icon: Clock, color: 'bg-blue-100 text-blue-800', label: 'Auto-Reply' },
      unsubscribe: { icon: Trash2, color: 'bg-orange-100 text-orange-800', label: 'Unsubscribe' },
      spam: { icon: AlertCircle, color: 'bg-gray-100 text-gray-800', label: 'Spam' },
      unclassified: { icon: Mail, color: 'bg-gray-100 text-gray-600', label: 'Unclassified' }
    }

    const badge = badges[classification as keyof typeof badges] || badges.unclassified
    const Icon = badge.icon

    return (
      <Badge className={`${badge.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {badge.label}
        {confidence && (
          <span className="text-xs opacity-75">
            {Math.round(confidence * 100)}%
          </span>
        )}
      </Badge>
    )
  }

  const filteredEmails = emails // Server-side filtering now handles all filters

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString()
  }

  const getEmailPreview = (email: IncomingEmail) => {
    const content = email.text_content || email.html_content || ''
    return content.length > 100 ? content.substring(0, 100) + '...' : content
  }

  const getCampaignInfo = (email: IncomingEmail) => {
    // Find the first reply that has campaign info
    const replyWithCampaign = email.email_replies?.find(reply => reply.campaigns)
    return replyWithCampaign?.campaigns || null
  }

  const getContactInfo = (email: IncomingEmail) => {
    // Find the first reply that has contact info
    const replyWithContact = email.email_replies?.find(reply => reply.contacts)
    return replyWithContact?.contacts || null
  }

  const getContactDisplayName = (contact: Contact) => {
    const firstName = contact.first_name || ''
    const lastName = contact.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    return fullName || contact.email
  }

  // Contact lookup and management functions
  const lookupContactByEmail = async (emailAddress: string) => {
    try {
      // Check if already cached
      if (contactsData.has(emailAddress)) {
        return contactsData.get(emailAddress)
      }

      const response = await fetch(`/api/contacts/lookup?email=${encodeURIComponent(emailAddress)}`)
      
      if (response.ok) {
        const data = await response.json()
        const contact = data.contact
        // Cache the contact data (including null if not found)
        setContactsData(prev => new Map(prev.set(emailAddress, contact)))
        return contact
      }
      
      return null
    } catch (error) {
      console.error('Error looking up contact:', error)
      return null
    }
  }

  const handleViewContact = async (emailAddress: string) => {
    const contact = await lookupContactByEmail(emailAddress)
    if (contact) {
      setSelectedContact(contact)
      setContactViewModalOpen(true)
    }
  }

  const handleAddContact = (emailAddress: string) => {
    // Pre-fill the email in the add contact form
    setSelectedContact({ email: emailAddress })
    setAddContactModalOpen(true)
  }

  const extractEmailAddress = (fromAddress: string): string => {
    // Extract email from formats like "Name <email@domain.com>" or just "email@domain.com"
    const match = fromAddress.match(/<([^>]+)>/)
    return match ? match[1] : fromAddress.trim()
  }

  // Component for contact action buttons
  const ContactActionButtons = ({ fromAddress }: { fromAddress: string }) => {
    const emailAddress = extractEmailAddress(fromAddress)
    const [isLoading, setIsLoading] = useState(false)
    const [contactExists, setContactExists] = useState<boolean | null>(null)

    // Check if contact exists when component mounts
    useEffect(() => {
      const checkContact = async () => {
        setIsLoading(true)
        const contact = await lookupContactByEmail(emailAddress)
        setContactExists(!!contact)
        setIsLoading(false)
      }
      
      checkContact()
    }, [emailAddress])

    if (isLoading) {
      return (
        <Button size="sm" variant="outline" disabled>
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-1"></div>
          Loading...
        </Button>
      )
    }

    if (contactExists) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            handleViewContact(emailAddress)
          }}
          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        >
          <Eye className="h-3 w-3 mr-1" />
          View Contact
        </Button>
      )
    } else {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            handleAddContact(emailAddress)
          }}
          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Add Contact
        </Button>
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Inbox</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-gray-600">
            {emails.length} emails • {filteredEmails.length} showing
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={loading || syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${(loading || syncing) ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Refresh'}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={fetchEmails}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Quick Refresh (Database Only)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => forceSync('all')}>
              <Mail className="h-4 w-4 mr-2" />
              Force IMAP Sync (All Accounts)
            </DropdownMenuItem>
            {selectedAccount !== 'all' && (
              <DropdownMenuItem onClick={() => forceSync(selectedAccount)}>
                <User className="h-4 w-4 mr-2" />
                Force Sync Selected Account
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-56">
            <Mail className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {emailAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.email} ({account.provider})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Emails</SelectItem>
            <SelectItem value="human_reply">Human Replies</SelectItem>
            <SelectItem value="bounce">Bounces</SelectItem>
            <SelectItem value="auto_reply">Auto-Replies</SelectItem>
            <SelectItem value="unsubscribe">Unsubscribes</SelectItem>
            <SelectItem value="unclassified">Unclassified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Email List */}
      <div className="bg-white rounded-lg border shadow">
        {filteredEmails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No emails found</p>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedEmail(email)}
              >
                <div className="flex items-start gap-4">
                  {/* Email Icon */}
                  <div className="mt-1">
                    {email.processing_status === 'completed' ? (
                      <MailOpen className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Mail className="h-5 w-5 text-blue-600" />
                    )}
                  </div>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 truncate">
                            {email.from_address}
                          </p>
                          {getClassificationBadge(email.classification_status, email.classification_confidence)}
                        </div>
                        <p className="font-medium text-gray-800 mb-1 truncate">
                          {email.subject || '(No Subject)'}
                        </p>
                        <div className="flex items-center gap-4 mb-1">
                          {getCampaignInfo(email) && (
                            <div className="flex items-center gap-1 text-xs text-blue-600">
                              <Target className="h-3 w-3" />
                              <span className="truncate">{getCampaignInfo(email)?.name}</span>
                            </div>
                          )}
                          {getContactInfo(email) && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <User className="h-3 w-3" />
                              <button 
                                className="truncate hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // TODO: Open contact modal or navigate to contact detail
                                  console.log('Open contact:', getContactInfo(email)?.id)
                                }}
                              >
                                {getContactDisplayName(getContactInfo(email)!)}
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {getEmailPreview(email)}
                        </p>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-500 mb-2">
                          {formatDate(email.date_received)}
                        </p>
                        <div className="flex gap-2 flex-col">
                          <ContactActionButtons fromAddress={email.from_address} />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              // Open in external email client
                              window.open(`mailto:${email.from_address}`, '_blank')
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Reading Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">
                  {selectedEmail.subject || '(No Subject)'}
                </h3>
                <p className="text-sm text-gray-600">
                  From: {selectedEmail.from_address}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getClassificationBadge(selectedEmail.classification_status, selectedEmail.classification_confidence)}
                <Button variant="outline" onClick={() => setSelectedEmail(null)}>
                  Close
                </Button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedEmail.html_content ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}
                  className="prose max-w-none"
                />
              ) : selectedEmail.text_content ? (
                <pre className="whitespace-pre-wrap font-sans text-gray-800">
                  {selectedEmail.text_content}
                </pre>
              ) : (
                <p className="text-gray-500 italic">No content available</p>
              )}
            </div>
            
            <div className="flex justify-between items-center p-6 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                Received: {new Date(selectedEmail.date_received).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    window.open(`mailto:${selectedEmail.from_address}?subject=Re: ${selectedEmail.subject}`, '_blank')
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Reply in Email Client
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact View Modal */}
      <ContactViewModal
        contact={selectedContact}
        isOpen={contactViewModalOpen}
        onClose={() => {
          setContactViewModalOpen(false)
          setSelectedContact(null)
        }}
        onEdit={(contact) => {
          // Handle edit if needed - for now just close the modal
          setContactViewModalOpen(false)
        }}
      />

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={addContactModalOpen}
        onClose={() => {
          setAddContactModalOpen(false)
          setSelectedContact(null)
        }}
        onContactAdded={() => {
          setAddContactModalOpen(false)
          setSelectedContact(null)
          // Refresh contacts data cache
          setContactsData(new Map())
        }}
        initialData={selectedContact}
      />
    </div>
  )
}