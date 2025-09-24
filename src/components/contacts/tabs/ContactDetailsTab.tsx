'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  User,
  Building,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Calendar,
  Edit3,
  Save,
  X,
  Plus
} from 'lucide-react'

interface Contact {
  id: string
  email: string
  first_name?: string
  last_name?: string
  company?: string
  job_title?: string
  phone?: string
  website?: string
  linkedin_url?: string
  engagement_status?: string
  engagement_score?: number
  custom_fields?: Record<string, any>
  enriched_data?: Record<string, any>
  created_at: string
  updated_at: string
}

interface ContactDetailsTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function ContactDetailsTab({ contact, onContactUpdate }: ContactDetailsTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    job_title: contact.job_title || '',
    website: contact.website || '',
    linkedin_url: contact.linkedin_url || ''
  })

  const handleSave = async () => {
    // TODO: Implement save functionality
    console.log('Saving contact updates:', editForm)
    setIsEditing(false)
    // onContactUpdate({ ...contact, ...editForm })
  }

  const handleCancel = () => {
    setEditForm({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      job_title: contact.job_title || '',
      website: contact.website || '',
      linkedin_url: contact.linkedin_url || ''
    })
    setIsEditing(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Basic Information Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Basic Information</span>
          </CardTitle>

          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2"
            >
              <Edit3 className="h-4 w-4" />
              <span>Edit</span>
            </Button>
          ) : (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="flex items-center space-x-1"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="flex items-center space-x-1"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Personal Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                {isEditing ? (
                  <Input
                    id="first_name"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    {contact.first_name || 'Not provided'}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="last_name">Last Name</Label>
                {isEditing ? (
                  <Input
                    id="last_name"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    {contact.last_name || 'Not provided'}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-500" />
                    <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                      {contact.email}
                    </a>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    {contact.phone ? (
                      <>
                        <Phone className="h-4 w-4 mr-2 text-gray-500" />
                        <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                          {contact.phone}
                        </a>
                      </>
                    ) : (
                      'Not provided'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span>Professional Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company">Company</Label>
                {isEditing ? (
                  <Input
                    id="company"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    {contact.company ? (
                      <>
                        <Building className="h-4 w-4 mr-2 text-gray-500" />
                        {contact.company}
                      </>
                    ) : (
                      'Not provided'
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="job_title">Job Title</Label>
                {isEditing ? (
                  <Input
                    id="job_title"
                    value={editForm.job_title}
                    onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    {contact.job_title || 'Not provided'}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                {isEditing ? (
                  <Input
                    id="website"
                    value={editForm.website}
                    onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    {contact.website ? (
                      <>
                        <Globe className="h-4 w-4 mr-2 text-gray-500" />
                        <a
                          href={contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                        >
                          {contact.website}
                        </a>
                      </>
                    ) : (
                      'Not provided'
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
                {isEditing ? (
                  <Input
                    id="linkedin_url"
                    value={editForm.linkedin_url}
                    onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                    {contact.linkedin_url ? (
                      <>
                        <Linkedin className="h-4 w-4 mr-2 text-gray-500" />
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                        >
                          LinkedIn Profile
                        </a>
                      </>
                    ) : (
                      'Not provided'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Fields Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Custom Fields</CardTitle>
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Field</span>
          </Button>
        </CardHeader>

        <CardContent>
          {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(contact.custom_fields).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-700">{key}</Label>
                    <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2">
                      {String(value)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No custom fields added yet</p>
              <p className="text-sm mt-1">Add custom fields to track additional information</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Contact Metadata</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Created At</Label>
              <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2">
                {formatDate(contact.created_at)}
              </div>
            </div>

            <div>
              <Label>Last Updated</Label>
              <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2">
                {formatDate(contact.updated_at)}
              </div>
            </div>

            <div>
              <Label>Contact ID</Label>
              <div className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 font-mono">
                {contact.id}
              </div>
            </div>

            <div>
              <Label>Engagement Status</Label>
              <div className="mt-1">
                <Badge variant="secondary" className="text-xs">
                  {contact.engagement_status || 'not_contacted'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}