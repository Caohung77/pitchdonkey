'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Linkedin,
  Building,
  MapPin,
  Users,
  Briefcase,
  GraduationCap,
  Award,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Calendar,
  User
} from 'lucide-react'

interface Contact {
  id: string
  linkedin_url?: string
  enriched_data?: Record<string, any>
  company?: string
  job_title?: string
}

interface LinkedInData {
  profile_url: string
  headline: string
  summary: string
  location: string
  industry: string
  current_company: string
  current_position: string
  connections: number
  experience: Array<{
    company: string
    title: string
    duration: string
    location?: string
    description?: string
  }>
  education: Array<{
    school: string
    degree: string
    field: string
    year: string
  }>
  skills: string[]
  certifications: Array<{
    name: string
    issuer: string
    date: string
  }>
  profile_photo?: string
  last_updated: string
}

interface LinkedInTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function LinkedInTab({ contact, onContactUpdate }: LinkedInTabProps) {
  const [linkedinUrl, setLinkedinUrl] = useState(contact.linkedin_url || '')
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)

  // Mock LinkedIn data - in production, this would come from enriched_data
  const linkedInData: LinkedInData | null = contact.enriched_data?.linkedin ? {
    profile_url: contact.linkedin_url || '',
    headline: 'Senior Marketing Director | B2B Growth Specialist',
    summary: 'Experienced marketing professional with 10+ years in B2B growth, lead generation, and digital marketing. Passionate about helping companies scale through data-driven marketing strategies.',
    location: 'San Francisco, CA',
    industry: 'Marketing and Advertising',
    current_company: contact.company || 'TechCorp Solutions',
    current_position: contact.job_title || 'Senior Marketing Director',
    connections: 2847,
    experience: [
      {
        company: 'TechCorp Solutions',
        title: 'Senior Marketing Director',
        duration: '2022 - Present',
        location: 'San Francisco, CA',
        description: 'Leading a team of 12 marketers to drive B2B growth through integrated campaigns'
      },
      {
        company: 'Growth Dynamics',
        title: 'Marketing Manager',
        duration: '2019 - 2022',
        location: 'San Francisco, CA',
        description: 'Managed lead generation campaigns that increased MQLs by 300%'
      },
      {
        company: 'StartupCo',
        title: 'Marketing Specialist',
        duration: '2017 - 2019',
        location: 'San Jose, CA',
        description: 'Built marketing function from ground up, launched multiple product campaigns'
      }
    ],
    education: [
      {
        school: 'University of California, Berkeley',
        degree: 'Bachelor of Arts',
        field: 'Marketing',
        year: '2017'
      },
      {
        school: 'Stanford University',
        degree: 'Certificate',
        field: 'Digital Marketing Strategy',
        year: '2020'
      }
    ],
    skills: [
      'Digital Marketing', 'Lead Generation', 'B2B Marketing', 'Marketing Strategy',
      'Content Marketing', 'Email Marketing', 'Marketing Automation', 'Analytics',
      'SEO/SEM', 'Social Media Marketing', 'Campaign Management', 'Team Leadership'
    ],
    certifications: [
      {
        name: 'Google Analytics Certified',
        issuer: 'Google',
        date: '2023'
      },
      {
        name: 'HubSpot Content Marketing Certified',
        issuer: 'HubSpot',
        date: '2022'
      },
      {
        name: 'Facebook Blueprint Certified',
        issuer: 'Meta',
        date: '2022'
      }
    ],
    last_updated: '2024-01-15T10:00:00Z'
  } : null

  const handleSaveLinkedInUrl = async () => {
    // TODO: Implement save LinkedIn URL
    console.log('Saving LinkedIn URL:', linkedinUrl)
  }

  const handleEnrichProfile = async () => {
    if (!linkedinUrl) return

    setEnriching(true)
    try {
      // TODO: Implement LinkedIn profile enrichment API call
      console.log('Enriching LinkedIn profile:', linkedinUrl)
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      // Mock successful enrichment
      const updatedContact = {
        ...contact,
        linkedin_url: linkedinUrl,
        enriched_data: {
          ...contact.enriched_data,
          linkedin: true
        }
      }
      onContactUpdate(updatedContact)
    } catch (error) {
      console.error('Failed to enrich LinkedIn profile:', error)
    } finally {
      setEnriching(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* LinkedIn URL Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Linkedin className="h-5 w-5" />
            <span>LinkedIn Profile</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn Profile URL</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="linkedin_url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="flex-1"
              />
              <Button
                onClick={handleSaveLinkedInUrl}
                disabled={linkedinUrl === contact.linkedin_url}
                size="sm"
              >
                Save
              </Button>
            </div>
          </div>

          {linkedinUrl && (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Linkedin className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-sm font-medium">LinkedIn Profile</div>
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    <span>View Profile</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <Button
                onClick={handleEnrichProfile}
                disabled={enriching}
                size="sm"
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${enriching ? 'animate-spin' : ''}`} />
                <span>{enriching ? 'Enriching...' : 'Enrich Profile'}</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn Profile Data */}
      {linkedInData ? (
        <>
          {/* Profile Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Profile Summary</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Updated {formatDate(linkedInData.last_updated)}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{linkedInData.headline}</h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
                  <div className="flex items-center space-x-1">
                    <Building className="h-4 w-4" />
                    <span>{linkedInData.current_company}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>{linkedInData.location}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{linkedInData.connections.toLocaleString()} connections</span>
                  </div>
                </div>
              </div>

              {linkedInData.summary && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">About</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{linkedInData.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5" />
                <span>Experience</span>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                {linkedInData.experience.map((exp, index) => (
                  <div key={index} className="flex space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Building className="h-5 w-5 text-gray-600" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{exp.title}</h4>
                          <p className="text-sm text-gray-600">{exp.company}</p>
                          {exp.location && (
                            <p className="text-sm text-gray-500">{exp.location}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {exp.duration}
                        </Badge>
                      </div>

                      {exp.description && (
                        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Education</span>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {linkedInData.education.map((edu, index) => (
                  <div key={index} className="flex space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{edu.school}</h4>
                          <p className="text-sm text-gray-600">
                            {edu.degree} in {edu.field}
                          </p>
                        </div>
                        <span className="text-sm text-gray-500">{edu.year}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader>
              <CardTitle>Skills & Expertise</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex flex-wrap gap-2">
                {linkedInData.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Certifications */}
          {linkedInData.certifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="h-5 w-5" />
                  <span>Certifications</span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {linkedInData.certifications.map((cert, index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                          <Award className="h-5 w-5 text-yellow-600" />
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{cert.name}</h4>
                            <p className="text-sm text-gray-600">{cert.issuer}</p>
                          </div>
                          <span className="text-sm text-gray-500">{cert.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* No LinkedIn Data */
        <Card>
          <CardContent className="text-center py-12">
            {linkedinUrl ? (
              <div>
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Enriched</h3>
                <p className="text-gray-600 mb-6">
                  Click "Enrich Profile" to gather professional information from LinkedIn.
                </p>
                <Button
                  onClick={handleEnrichProfile}
                  disabled={enriching}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${enriching ? 'animate-spin' : ''}`} />
                  <span>{enriching ? 'Enriching...' : 'Enrich Profile'}</span>
                </Button>
              </div>
            ) : (
              <div>
                <Linkedin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No LinkedIn Profile</h3>
                <p className="text-gray-600 mb-6">
                  Add a LinkedIn profile URL to view and enrich professional information.
                </p>
                <p className="text-sm text-gray-500">
                  Professional data includes work experience, education, skills, and more.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}