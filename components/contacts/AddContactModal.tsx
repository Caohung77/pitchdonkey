'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Plus, X } from 'lucide-react'
import { EnrichmentButton } from './EnrichmentButton'

interface AddContactModalProps {
  onContactAdded: () => void
  onNavigateToContacts?: () => void
  isOpen?: boolean
  onClose?: () => void
  autoAddToList?: string
  initialData?: Partial<ContactFormData>
}

interface ContactFormData {
  email: string
  first_name: string
  last_name: string
  company: string
  position: string
  phone: string
  website: string
  linkedin_url: string
  twitter_url: string
  address: string
  postcode: string
  country: string
  city: string
  timezone: string
  sex: string
  source: string
}

export function AddContactModal({ onContactAdded, onNavigateToContacts, isOpen: propIsOpen, onClose: propOnClose, autoAddToList, initialData }: AddContactModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen
  const onClose = propOnClose || (() => setInternalIsOpen(false))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdContactId, setCreatedContactId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ContactFormData>({
    email: '',
    first_name: '',
    last_name: '',
    company: '',
    position: '',
    phone: '',
    website: '',
    linkedin_url: '',
    twitter_url: '',
    address: '',
    postcode: '',
    country: '',
    city: '',
    timezone: '',
    source: 'manual' // Default to manual for new contacts
  })

  // Update form data when initial data changes
  useEffect(() => {
    if (initialData && isOpen) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        source: initialData.source || 'inbox'
      }))
    } else if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        company: '',
        position: '',
        phone: '',
        website: '',
        linkedin_url: '',
        twitter_url: '',
        address: '',
        postcode: '',
        country: '',
        city: '',
        timezone: '',
        sex: '',
        source: 'manual'
      })
    }
  }, [initialData, isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    if (!formData.email) {
      setError('Email is required')
      return false
    }
    
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address')
      return false
    }

    // Note: Only email is required now, first_name and last_name are optional

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('AddContactModal: Submitting contact:', formData)
      
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle different error types
        if (response.status === 409 && data.code === 'DUPLICATE_CONTACT') {
          setError(`A contact with email "${formData.email}" already exists. Please use a different email address.`)
          return
        }
        setError(data.error || 'Failed to create contact')
        return
      }

      console.log('AddContactModal: Contact created successfully:', data)
      
      // Store the created contact ID for potential enrichment
      let contactId = null
      if (data.data && data.data.id) {
        contactId = data.data.id
        setCreatedContactId(data.data.id)
      } else if (data.id) {
        contactId = data.id
        setCreatedContactId(data.id)
      }
      
      // Auto-add to list if specified
      if (autoAddToList && contactId) {
        try {
          await fetch(`/api/contacts/lists/${autoAddToList}/contacts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contact_ids: [contactId] }),
          })
        } catch (error) {
          console.error('Failed to add contact to list:', error)
        }
      }
      
      // Call parent callback
      onContactAdded()

    } catch (error) {
      console.error('AddContactModal: Unexpected error creating contact:', error)
      setError(error instanceof Error ? error.message : 'Failed to create contact')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    setError(null)
    setCreatedContactId(null)
    // Reset form data when closing after successful creation
    if (createdContactId) {
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        company: '',
        position: '',
        phone: '',
        website: '',
        linkedin_url: '',
        twitter_url: '',
        address: '',
        postcode: '',
        country: '',
        city: '',
        timezone: '',
        sex: '',
        source: 'manual'
      })
    }
  }

  const handleViewContacts = () => {
    handleClose()
    if (onNavigateToContacts) {
      onNavigateToContacts()
    }
  }

  if (!isOpen) {
    // Only show button if not controlled externally
    if (propIsOpen !== undefined) {
      return null
    }
    return (
      <Button onClick={() => setInternalIsOpen(true)} className="flex items-center space-x-2">
        <Plus className="h-4 w-4" />
        <span>Add Contact</span>
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Add New Contact</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            )}

            {/* Required Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="john@example.com"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="John"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Doe"
                />
              </div>
              
              <div>
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  placeholder="Software Engineer"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Optional Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                />
              </div>
              
              <div>
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  name="linkedin_url"
                  type="url"
                  value={formData.linkedin_url}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/johndoe"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="twitter_url">Twitter URL</Label>
                <Input
                  id="twitter_url"
                  name="twitter_url"
                  type="url"
                  value={formData.twitter_url}
                  onChange={handleInputChange}
                  placeholder="https://twitter.com/johndoe"
                />
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="123 Main Street"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postcode">Postcode/Zip Code</Label>
                <Input
                  id="postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleInputChange}
                  placeholder="12345 or SW1A 1AA"
                />
              </div>
              
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  placeholder="United States"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="New York"
                />
              </div>
              
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleInputChange}
                  placeholder="America/New_York"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sex">Sex/Gender</Label>
                <Select value={formData.sex} onValueChange={(value) => handleSelectChange('sex', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">Male</SelectItem>
                    <SelectItem value="f">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Success Message and Enrichment */}
            {createdContactId && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-800 font-medium">✅ Contact created successfully!</p>
                      <p className="text-green-700 text-sm mt-1">
                        {formData.first_name} {formData.last_name} has been added to your contacts.
                      </p>
                    </div>
                  </div>
                  
                  {(formData.website || formData.linkedin_url) && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div>
                        <p className="text-blue-800 text-sm font-medium">
                          {formData.website && formData.linkedin_url ? 'Smart Enrichment Available' :
                           formData.website ? 'Website Analysis Available' : 
                           'LinkedIn Extraction Available'}
                        </p>
                        <p className="text-blue-700 text-xs mt-1">
                          {formData.website && formData.linkedin_url ? 
                            'Get comprehensive insights from both website and LinkedIn profile.' :
                            formData.website ? 
                            'Get AI insights from their website for better email personalization.' :
                            'Extract professional profile data from LinkedIn for personalization.'}
                        </p>
                      </div>
                      <EnrichmentButton
                        contactId={createdContactId}
                        hasWebsite={!!formData.website}
                        hasLinkedIn={!!formData.linkedin_url}
                        linkedInUrl={formData.linkedin_url}
                        size="sm"
                        onEnrichmentComplete={() => {
                          console.log('Enrichment completed for new contact')
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              {createdContactId ? (
                <>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Add Another Contact
                  </Button>
                  <Button type="button" onClick={handleViewContacts}>
                    View All Contacts
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Contact'}
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}