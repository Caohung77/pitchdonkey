'use client'

import { useState } from 'react'
import { Contact } from '@/lib/contacts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseCompanyName } from '@/lib/contact-utils'
import { EnrichmentButton } from '../EnrichmentButton'
import {
  Mail,
  Building,
  MapPin,
  Phone,
  Globe,
  User,
  Edit,
  Check,
  X,
  Calendar,
  Tag,
  Hash,
  Clock4,
  Sparkles
} from 'lucide-react'

interface ContactDetailsTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function ContactDetailsTab({
  contact,
  onContactUpdate
}: ContactDetailsTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingData, setEditingData] = useState<Partial<Contact>>({})
  const [saving, setSaving] = useState(false)

  const handleEdit = () => {
    setIsEditing(true)
    setEditingData({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email,
      phone: contact.phone || '',
      company: contact.company || '',
      position: contact.position || '',
      website: contact.website || '',
      linkedin_url: contact.linkedin_url || '',
      address: contact.address || '',
      city: contact.city || '',
      postcode: contact.postcode || '',
      country: contact.country || '',
      timezone: contact.timezone || '',
      source: contact.source || ''
    })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditingData({})
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingData)
      })

      if (!response.ok) {
        throw new Error('Failed to update contact')
      }

      const result = await response.json()
      onContactUpdate({ ...contact, ...editingData })
      setIsEditing(false)
      setEditingData({})
    } catch (error) {
      console.error('Error updating contact:', error)
      // TODO: Show error toast
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-8">
      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Contact
            </Button>
          )}
        </div>
      </div>

      {/* Contact Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600" />
            Personal Information
          </h3>

          <div className="space-y-4">
            {/* First Name */}
            <div>
              <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                First Name
              </Label>
              {isEditing ? (
                <Input
                  id="first_name"
                  value={editingData.first_name || ''}
                  onChange={(e) => setEditingData({ ...editingData, first_name: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.first_name || 'Not specified'}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                Last Name
              </Label>
              {isEditing ? (
                <Input
                  id="last_name"
                  value={editingData.last_name || ''}
                  onChange={(e) => setEditingData({ ...editingData, last_name: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.last_name || 'Not specified'}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              {isEditing ? (
                <Input
                  id="email"
                  type="email"
                  value={editingData.email || ''}
                  onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                  className="mt-1"
                  required
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{contact.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={editingData.phone || ''}
                  onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.phone || 'Not specified'}
                </p>
              )}
            </div>

            {/* Gender */}
            {'sex' in contact && contact.sex && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Gender</Label>
                <p className="mt-1 text-sm text-gray-900">
                  {contact.sex === 'm' ? 'Male' : contact.sex === 'f' ? 'Female' : 'Not specified'}
                </p>
              </div>
            )}

            {/* Timezone */}
            <div>
              <Label htmlFor="timezone" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock4 className="h-4 w-4" />
                Timezone
              </Label>
              {isEditing ? (
                <Input
                  id="timezone"
                  value={editingData.timezone || ''}
                  onChange={(e) => setEditingData({ ...editingData, timezone: e.target.value })}
                  className="mt-1"
                  placeholder="e.g., America/New_York"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.timezone || 'Not specified'}
                </p>
              )}
            </div>

            {/* Source */}
            <div>
              <Label htmlFor="source" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Source
              </Label>
              {isEditing ? (
                <Input
                  id="source"
                  value={editingData.source || ''}
                  onChange={(e) => setEditingData({ ...editingData, source: e.target.value })}
                  className="mt-1"
                  placeholder="e.g., Website, LinkedIn, Referral"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.source || 'Not specified'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Professional Information */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Building className="h-5 w-5 text-gray-600" />
            Professional Information
          </h3>

          <div className="space-y-4">
            {/* Company */}
            <div>
              <Label htmlFor="company" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Company
              </Label>
              {isEditing ? (
                <Input
                  id="company"
                  value={editingData.company || ''}
                  onChange={(e) => setEditingData({ ...editingData, company: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {parseCompanyName(contact.company) || 'Not specified'}
                </p>
              )}
            </div>

            {/* Position */}
            <div>
              <Label htmlFor="position" className="text-sm font-medium text-gray-700">
                Position
              </Label>
              {isEditing ? (
                <Input
                  id="position"
                  value={editingData.position || ''}
                  onChange={(e) => setEditingData({ ...editingData, position: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.position || 'Not specified'}
                </p>
              )}
            </div>

            {/* Website */}
            <div>
              <Label htmlFor="website" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </Label>
              {isEditing ? (
                <Input
                  id="website"
                  value={editingData.website || ''}
                  onChange={(e) => setEditingData({ ...editingData, website: e.target.value })}
                  className="mt-1"
                  placeholder="https://example.com"
                />
              ) : (
                <div className="mt-1">
                  {contact.website ? (
                    <a
                      href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      {contact.website}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-900">Not specified</p>
                  )}
                </div>
              )}
            </div>

            {/* LinkedIn */}
            <div>
              <Label htmlFor="linkedin_url" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                LinkedIn URL
              </Label>
              {isEditing ? (
                <Input
                  id="linkedin_url"
                  value={editingData.linkedin_url || ''}
                  onChange={(e) => setEditingData({ ...editingData, linkedin_url: e.target.value })}
                  className="mt-1"
                  placeholder="https://linkedin.com/in/username"
                />
              ) : (
                <div className="mt-1">
                  {contact.linkedin_url ? (
                    <a
                      href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      LinkedIn Profile
                    </a>
                  ) : (
                    <p className="text-sm text-gray-900">Not specified</p>
                  )}
                </div>
              )}
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="address" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </Label>
              {isEditing ? (
                <Textarea
                  id="address"
                  value={editingData.address || ''}
                  onChange={(e) => setEditingData({ ...editingData, address: e.target.value })}
                  className="mt-1"
                  rows={2}
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.address || 'Not specified'}
                </p>
              )}
            </div>

            {/* City */}
            <div>
              <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                City
              </Label>
              {isEditing ? (
                <Input
                  id="city"
                  value={editingData.city || ''}
                  onChange={(e) => setEditingData({ ...editingData, city: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.city || 'Not specified'}
                </p>
              )}
            </div>

            {/* Postcode */}
            <div>
              <Label htmlFor="postcode" className="text-sm font-medium text-gray-700">
                Postcode
              </Label>
              {isEditing ? (
                <Input
                  id="postcode"
                  value={editingData.postcode || ''}
                  onChange={(e) => setEditingData({ ...editingData, postcode: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.postcode || 'Not specified'}
                </p>
              )}
            </div>

            {/* Country */}
            <div>
              <Label htmlFor="country" className="text-sm font-medium text-gray-700">
                Country
              </Label>
              {isEditing ? (
                <Input
                  id="country"
                  value={editingData.country || ''}
                  onChange={(e) => setEditingData({ ...editingData, country: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">
                  {contact.country || 'Not specified'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {contact.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* AI Enrichment Section */}
      <div className="pt-6 border-t border-gray-200">
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI Enrichment
            </h3>
          </div>

          <EnrichmentButton
            contactId={contact.id}
            hasWebsite={!!contact.website}
            hasLinkedIn={!!contact.linkedin_url}
            linkedInUrl={contact.linkedin_url}
            currentStatus={(contact as any).enrichment_status}
            linkedInStatus={(contact as any).linkedin_extraction_status}
            onEnrichmentComplete={(updatedContact) => {
              onContactUpdate({ ...contact, ...updatedContact })
            }}
            className="w-full"
          />

          {/* Enrichment Data Display */}
          {(contact as any).enrichment_data && (contact as any).enrichment_status === 'completed' && (
            <div className="mt-6 bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-green-600" />
                <h4 className="text-lg font-medium text-green-900">Website Enrichment Data</h4>
                {(contact as any).enrichment_updated_at && (
                  <span className="text-xs text-green-600 ml-auto">
                    Enriched {formatDate((contact as any).enrichment_updated_at)}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {contact.enrichment_data.industry && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Industry</p>
                    <p className="text-sm text-green-700">{contact.enrichment_data.industry}</p>
                  </div>
                )}

                {contact.enrichment_data.products_services && contact.enrichment_data.products_services.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Products & Services</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.enrichment_data.products_services.map((service, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {contact.enrichment_data.target_audience && contact.enrichment_data.target_audience.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Target Audience</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.enrichment_data.target_audience.map((audience, index) => (
                        <Badge key={index} variant="outline" className="text-xs border-green-300 text-green-700">
                          {audience}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {contact.enrichment_data.unique_points && contact.enrichment_data.unique_points.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Unique Points</p>
                    <ul className="text-sm text-green-700 mt-1 space-y-1">
                      {contact.enrichment_data.unique_points.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {contact.enrichment_data.tone_style && (
                  <div>
                    <p className="text-sm font-medium text-green-800">Communication Style</p>
                    <p className="text-sm text-green-700">{contact.enrichment_data.tone_style}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="pt-6 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Metadata</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Contact ID</p>
            <p className="text-gray-600 font-mono">{contact.id}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Created</p>
            <p className="text-gray-600">{formatDate(contact.created_at)}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Last Updated</p>
            <p className="text-gray-600">{formatDate(contact.updated_at)}</p>
          </div>
          {(contact as any).enrichment_updated_at && (
            <div>
              <p className="font-medium text-gray-700">Website Enriched</p>
              <p className="text-gray-600">{formatDate((contact as any).enrichment_updated_at)}</p>
            </div>
          )}
          {(contact as any).linkedin_extracted_at && (
            <div>
              <p className="font-medium text-gray-700">LinkedIn Extracted</p>
              <p className="text-gray-600">{formatDate((contact as any).linkedin_extracted_at)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}