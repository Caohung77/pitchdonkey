'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, X, Sparkles, Eye, EyeOff } from 'lucide-react'
import { EnrichmentDisplay } from './EnrichmentDisplay'

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
  address?: string
  postcode?: string
  country?: string
  city?: string
  timezone?: string
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  tags: string[]
  created_at: string
  updated_at: string
  enrichment_data?: {
    company_name: string
    industry: string
    products_services: string[]
    target_audience: string[]
    unique_points: string[]
    tone_style: string
  } | null
  enrichment_status?: 'pending' | 'completed' | 'failed' | null
  enrichment_updated_at?: string | null
  source?: string
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
  address: string
  postcode: string
  country: string
  city: string
  timezone: string
  // Enrichment fields (company is merged with normal company field)
  enriched_industry: string
  enriched_products_services: string
  enriched_target_audience: string
  enriched_unique_points: string
  enriched_tone_style: string
  source: string
}

export function EditContactModal({ contact, isOpen, onClose, onContactUpdated }: EditContactModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEnrichmentFields, setShowEnrichmentFields] = useState(false)
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
    // Enrichment fields (company is merged with normal company field)
    enriched_industry: '',
    enriched_products_services: '',
    enriched_target_audience: '',
    enriched_unique_points: '',
    enriched_tone_style: '',
    source: ''
  })

  // Update form data when contact changes
  useEffect(() => {
    if (contact) {
      const enrichmentData = contact.enrichment_data
      setFormData({
        email: contact.email || '',
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        company: enrichmentData?.company_name || contact.company || '',
        position: contact.position || '',
        phone: contact.phone || '',
        website: contact.website || '',
        linkedin_url: contact.linkedin_url || '',
        twitter_url: contact.twitter_url || '',
        address: contact.address || '',
        postcode: contact.postcode || '',
        country: contact.country || '',
        city: contact.city || '',
        timezone: contact.timezone || '',
        // Populate enrichment fields if available (company overwrites normal company field)
        enriched_industry: enrichmentData?.industry || '',
        enriched_products_services: enrichmentData?.products_services?.join(', ') || '',
        enriched_target_audience: enrichmentData?.target_audience?.join(', ') || '',
        enriched_unique_points: enrichmentData?.unique_points?.join(', ') || '',
        enriched_tone_style: enrichmentData?.tone_style || '',
        source: contact.source || 'manual'
      })
      
      // Show enrichment fields if we have enrichment data
      setShowEnrichmentFields(!!enrichmentData && contact.enrichment_status === 'completed')
    }
  }, [contact])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    // Note: Only email is required now, first_name and last_name are optional

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
        const errorMessage = data.error?.message || data.error || 'Failed to update contact'
        throw new Error(errorMessage)
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
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                  placeholder="manual"
                  className="bg-gray-50"
                  title="How this contact was created (manual, import:filename, etc.)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How this contact was added to your system
                </p>
              </div>
            </div>

            {/* Enrichment Section */}
            {contact?.enrichment_status === 'completed' && (
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900">Enriched Information</h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEnrichmentFields(!showEnrichmentFields)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {showEnrichmentFields ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-1" />
                        Hide Fields
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        Show Fields
                      </>
                    )}
                  </Button>
                </div>

                {/* Display enrichment data */}
                {contact?.enrichment_data && !showEnrichmentFields && (
                  <div className="mb-4">
                    <EnrichmentDisplay
                      enrichmentData={contact.enrichment_data}
                      enrichmentStatus={contact.enrichment_status}
                      enrichmentUpdatedAt={contact.enrichment_updated_at}
                    />
                  </div>
                )}

                {/* Editable enrichment fields */}
                {showEnrichmentFields && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <strong>Note:</strong> The company name from enrichment overwrites the main company field above.
                    </div>
                    
                    <div>
                      <Label htmlFor="enriched_industry">Industry</Label>
                      <Input
                        id="enriched_industry"
                        name="enriched_industry"
                        value={formData.enriched_industry}
                        onChange={handleInputChange}
                        placeholder="Industry"
                      />
                    </div>

                    <div>
                      <Label htmlFor="enriched_products_services">Products & Services</Label>
                      <Textarea
                        id="enriched_products_services"
                        name="enriched_products_services"
                        value={formData.enriched_products_services}
                        onChange={handleInputChange}
                        placeholder="Comma-separated list of products and services"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="enriched_target_audience">Target Audience</Label>
                      <Textarea
                        id="enriched_target_audience"
                        name="enriched_target_audience"
                        value={formData.enriched_target_audience}
                        onChange={handleInputChange}
                        placeholder="Comma-separated list of target audience"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label htmlFor="enriched_unique_points">Unique Points</Label>
                      <Textarea
                        id="enriched_unique_points"
                        name="enriched_unique_points"
                        value={formData.enriched_unique_points}
                        onChange={handleInputChange}
                        placeholder="Comma-separated list of unique selling points"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="enriched_tone_style">Communication Tone & Style</Label>
                      <Input
                        id="enriched_tone_style"
                        name="enriched_tone_style"
                        value={formData.enriched_tone_style}
                        onChange={handleInputChange}
                        placeholder="Communication tone and style"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

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