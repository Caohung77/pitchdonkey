'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, X } from 'lucide-react'

// Simple Contact interface to avoid import issues
interface Contact {
  id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
  company?: string
  position?: string
  phone?: string
  website?: string
  linkedin_url?: string
  twitter_url?: string
  country?: string
  city?: string
  timezone?: string
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  tags: string[]
  created_at: string
  updated_at: string
}

interface EditContactModalProps {
  contact: Contact | null
  isOpen: boolean
  onClose: () => void
  onContactUpdated: () => void
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
  country: string
  city: string
  timezone: string
}

export function EditContactModal({ contact, isOpen, onClose, onContactUpdated }: EditContactModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    country: '',
    city: '',
    timezone: ''
  })

  // Update form data when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        email: contact.email || '',
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        company: contact.company || '',
        position: contact.position || '',
        phone: contact.phone || '',
        website: contact.website || '',
        linkedin_url: contact.linkedin_url || '',
        twitter_url: contact.twitter_url || '',
        country: contact.country || '',
        city: contact.city || '',
        timezone: contact.timezone || ''
      })
    }
  }, [contact])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
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

    if (!formData.first_name && !formData.last_name) {
      setError('Please enter at least a first name or last name')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!contact || !validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('EditContactModal: Updating contact:', contact.id, formData)
      
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update contact')
      }

      console.log('EditContactModal: Contact updated successfully:', data)
      
      onClose()
      onContactUpdated()

    } catch (error) {
      console.error('EditContactModal: Error updating contact:', error)
      setError(error instanceof Error ? error.message : 'Failed to update contact')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    setError(null)
  }

  if (!isOpen || !contact) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Edit Contact</CardTitle>
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

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Contact'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}