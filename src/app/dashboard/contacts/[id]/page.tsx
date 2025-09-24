'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { Contact } from '@/lib/contacts'
import { ContactDetailHeader } from '@/components/contacts/ContactDetailHeader'
import { ContactDetailTabs } from '@/components/contacts/ContactDetailTabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { ToastProvider } from '@/components/ui/toast'

function ContactDetailContent() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const contactId = params?.id as string

  useEffect(() => {
    if (!user || !contactId) {
      setLoading(false)
      return
    }

    fetchContact()
  }, [user, contactId])

  const fetchContact = async () => {
    if (!user || !contactId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch contact using the API endpoint
      const response = await fetch(`/api/contacts?ids=${contactId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch contact')
      }

      const contactData = result.data?.contacts?.[0]

      if (!contactData) {
        throw new Error('Contact not found')
      }

      // Fetch additional LinkedIn data if available
      try {
        const linkedInResponse = await fetch(`/api/contacts/${contactId}/extract-linkedin`)
        if (linkedInResponse.ok) {
          const linkedInData = await linkedInResponse.json()
          if (linkedInData.data) {
            Object.assign(contactData, {
              linkedin_profile_data: linkedInData.data.linkedin_profile_data,
              linkedin_extraction_status: linkedInData.data.linkedin_extraction_status,
              linkedin_extracted_at: linkedInData.data.linkedin_extracted_at
            })
          }
        }
      } catch (linkedInError) {
        console.warn('Failed to fetch LinkedIn data:', linkedInError)
      }

      setContact(contactData)
    } catch (err) {
      console.error('Error fetching contact:', err)
      setError(err instanceof Error ? err.message : 'Failed to load contact')
    } finally {
      setLoading(false)
    }
  }

  const handleContactUpdate = (updatedContact: Contact) => {
    setContact(updatedContact)
  }

  const handleBackToList = () => {
    router.push('/dashboard/contacts')
  }

  // Loading states
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading contact details...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !contact) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button
            variant="ghost"
            onClick={handleBackToList}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Contacts</span>
          </Button>
        </div>

        <Card className="max-w-md mx-auto">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Contact Not Found</h2>
              <p className="text-gray-600 mb-4">
                {error || 'The contact you are looking for could not be found.'}
              </p>
              <div className="space-y-2">
                <Button onClick={fetchContact} className="w-full">
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBackToList}
                  className="w-full"
                >
                  Back to Contacts
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <ContactDetailHeader
        contact={contact}
        onBackToList={handleBackToList}
        onContactUpdate={handleContactUpdate}
      />

      {/* Tab Content */}
      <ContactDetailTabs
        contact={contact}
        onContactUpdate={handleContactUpdate}
      />
    </div>
  )
}

export default function ContactDetailPage() {
  return (
    <ToastProvider>
      <ContactDetailContent />
    </ToastProvider>
  )
}