'use client'

import { Contact } from '@/lib/contacts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Linkedin,
  Building,
  User,
  Globe,
  Award,
  AlertCircle,
  ExternalLink,
  Calendar
} from 'lucide-react'

interface LinkedInTabProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function LinkedInTab({
  contact,
  onContactUpdate
}: LinkedInTabProps) {
  // Check for individual LinkedIn fields first, fallback to legacy JSON blob
  const hasLinkedInData = !!(
    contact.linkedin_first_name ||
    contact.linkedin_headline ||
    contact.linkedin_about ||
    contact.linkedin_current_company ||
    (contact as any).linkedin_profile_data
  )

  // Backwards compatibility: use JSON blob if individual fields aren't populated yet
  const lp: any = hasLinkedInData ? {
    // Personal Information
    first_name: contact.linkedin_first_name,
    last_name: contact.linkedin_last_name,
    name: contact.linkedin_first_name && contact.linkedin_last_name ?
          `${contact.linkedin_first_name} ${contact.linkedin_last_name}` :
          contact.linkedin_first_name || contact.linkedin_last_name,
    headline: contact.linkedin_headline,
    summary: contact.linkedin_summary,
    about: contact.linkedin_about,

    // Professional Information
    current_company: contact.linkedin_current_company,
    position: contact.linkedin_current_position,
    industry: contact.linkedin_industry,

    // Location
    location: contact.linkedin_location,
    city: contact.linkedin_city,
    country: contact.linkedin_country,
    country_code: contact.linkedin_country_code,

    // Social Stats
    follower_count: contact.linkedin_follower_count,
    connection_count: contact.linkedin_connection_count,
    recommendations_count: contact.linkedin_recommendations_count,
    profile_completeness: contact.linkedin_profile_completeness,

    // Media
    avatar: contact.linkedin_avatar_url,
    banner_image: contact.linkedin_banner_url,

    // Complex Data (from JSONB fields)
    experience: contact.linkedin_experience,
    education: contact.linkedin_education,
    skills: contact.linkedin_skills,
    languages: contact.linkedin_languages,
    certifications: contact.linkedin_certifications,
    volunteer_experience: contact.linkedin_volunteer_experience,
    honors_and_awards: contact.linkedin_honors_awards,
    projects: contact.linkedin_projects,
    courses: contact.linkedin_courses,
    publications: contact.linkedin_publications,
    patents: contact.linkedin_patents,
    organizations: contact.linkedin_organizations,
    posts: contact.linkedin_posts,
    activity: contact.linkedin_activity,
    recommendations: contact.linkedin_recommendations,
    people_also_viewed: contact.linkedin_people_also_viewed,
    contact_info: contact.linkedin_contact_info,
    services: contact.linkedin_services
  } : (contact as any).linkedin_profile_data

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
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Linkedin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-blue-900">LinkedIn Profile</h2>
              {'linkedin_extracted_at' in contact && contact.linkedin_extracted_at && (
                <p className="text-sm text-blue-600">
                  Extracted {formatDate(contact.linkedin_extracted_at as string)}
                </p>
              )}
            </div>
          </div>
          <div>
            {hasLinkedInData && lp ? (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                ✓ Data Available
              </Badge>
            ) : contact.linkedin_extraction_status === 'failed' ? (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                ⚠ Extraction Failed
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                No Data
              </Badge>
            )}
          </div>
        </div>

        {/* LinkedIn URL Management */}
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="linkedin_url" className="text-sm font-medium text-blue-800">
                LinkedIn Profile URL
              </Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="linkedin_url"
                  value={contact.linkedin_url || ''}
                  placeholder="https://linkedin.com/in/username"
                  className="bg-white"
                  readOnly
                />
                {contact.linkedin_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(
                      contact.linkedin_url!.startsWith('http')
                        ? contact.linkedin_url!
                        : `https://${contact.linkedin_url}`,
                      '_blank'
                    )}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Show failure message if extraction failed */}
      {contact.linkedin_extraction_status === 'failed' && (!hasLinkedInData || !lp) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">LinkedIn Extraction Failed</h3>
              <p className="text-sm text-red-700">Unable to extract data from this LinkedIn profile</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="bg-red-100 p-3 rounded-lg border-l-4 border-red-400">
              <p className="font-medium text-red-800 mb-1">Possible Reasons:</p>
              <ul className="text-red-700 space-y-1">
                <li>• Profile privacy settings prevent data extraction</li>
                <li>• Profile may be restricted or incomplete</li>
                <li>• LinkedIn URL may be invalid or redirected</li>
                <li>• Temporary API limitations or rate limiting</li>
              </ul>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
              <p className="font-medium text-blue-800 mb-1">What you can try:</p>
              <ul className="text-blue-700 space-y-1">
                <li>• Verify the LinkedIn URL is correct and accessible</li>
                <li>• Try again later (rate limits may have been reached)</li>
                <li>• Use website enrichment instead for company information</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Profile Data */}
      {typeof lp === 'object' && lp && (
        <div className="grid gap-6">

          {/* Professional Summary Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Professional Summary</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company & Position */}
              <div className="space-y-4">
                {lp.current_company && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Company</span>
                    <p className="text-base font-medium text-gray-900 mt-1">
                      {typeof lp.current_company === 'object'
                        ? lp.current_company.name
                        : lp.current_company}
                    </p>
                  </div>
                )}

                {lp.position && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Position</span>
                    <p className="text-base text-gray-800 mt-1">{lp.position}</p>
                  </div>
                )}
              </div>

              {/* Location & Industry */}
              <div className="space-y-4">
                {lp.city && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Location</span>
                    <p className="text-base text-gray-800 mt-1">
                      {lp.city}
                      {lp.country && `, ${lp.country}`}
                    </p>
                  </div>
                )}

                {lp.industry && (
                  <div>
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Industry</span>
                    <p className="text-base text-gray-800 mt-1">{lp.industry}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* About Section - CRITICAL for personalization */}
          {lp.about && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">About</h3>
                <Badge variant="outline" className="text-xs">Personalization Key</Badge>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                  {lp.about}
                </p>
                {lp.about && (lp.about.endsWith('…') || lp.about.endsWith('...')) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ <span>Content may be truncated due to LinkedIn privacy settings</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Network Stats */}
          {(lp.followers || lp.connections || lp.follower_count || lp.connection_count || lp.profile_completeness) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(lp.followers || lp.follower_count) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(lp.followers || lp.follower_count)?.toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Followers</div>
                </div>
              )}

              {(lp.connections || lp.connection_count) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(lp.connections || lp.connection_count)}+
                  </div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Connections</div>
                </div>
              )}

              {lp.recommendations_count && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {lp.recommendations_count}
                  </div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recommendations</div>
                </div>
              )}

              {lp.profile_completeness && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {lp.profile_completeness}%
                  </div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profile Complete</div>
                </div>
              )}
            </div>
          )}

          {/* Experience */}
          {(lp.experience && Array.isArray(lp.experience) && lp.experience.length > 0) ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 text-gray-600">💼</div>
                <h3 className="text-lg font-semibold text-gray-900">Professional Experience</h3>
              </div>
              <div className="space-y-4">
                {lp.experience.slice(0, 3).map((exp: any, index: number) => (
                  <div key={index} className="border border-gray-100 rounded-lg p-4 bg-gray-50 relative">
                    {/* Timeline indicator */}
                    {index < lp.experience.length - 1 && (
                      <div className="absolute left-4 top-16 w-px h-8 bg-gray-300"></div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{exp.title}</p>
                            <p className="text-sm text-gray-700">{exp.company}</p>
                            {exp.location && <p className="text-xs text-gray-600">{exp.location}</p>}
                          </div>
                          <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded text-right">
                            {exp.start_date && (
                              <div>{exp.start_date} - {exp.end_date || 'Present'}</div>
                            )}
                            {exp.duration && <div className="text-gray-400">{exp.duration}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {lp.experience.length > 3 && (
                  <div className="text-center">
                    <Badge variant="outline" className="text-xs">
                      +{lp.experience.length - 3} more positions
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 text-gray-600">💼</div>
                <h3 className="text-lg font-semibold text-gray-900">Professional Experience</h3>
              </div>
              <div className="text-center py-8">
                <div className="text-gray-500 text-sm">
                  <div className="mb-2">📍 Professional experience not available on LinkedIn profile</div>
                  <div className="text-xs text-gray-400">
                    This contact may have their experience section set to private or not filled out
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Education */}
          {((lp.education && Array.isArray(lp.education) && lp.education.length > 0) ||
            (lp.educations_details && Array.isArray(lp.educations_details) && lp.educations_details.length > 0)) && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 text-gray-600">🎓</div>
                <h3 className="text-lg font-semibold text-gray-900">Education</h3>
              </div>
              <div className="space-y-3">
                {(Array.isArray(lp.education) ? lp.education : (Array.isArray(lp.educations_details) ? lp.educations_details : [])).map((edu: any, index: number) => (
                  <div key={index} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {edu.title || edu.school || edu.institute || edu.institution || (typeof edu === 'string' ? edu : `Education ${index + 1}`)}
                        </p>
                        {edu.degree && <p className="text-sm text-gray-700">{edu.degree}</p>}
                        {(edu.field_of_study || edu.field) && <p className="text-sm text-gray-600">{edu.field_of_study || edu.field}</p>}
                      </div>
                      {(edu.start_year || edu.end_year || edu.start_date || edu.end_date) && (
                        <div className="text-xs text-gray-500 text-right bg-white px-2 py-1 rounded">
                          {(edu.start_year || edu.start_date) && (edu.start_year || edu.start_date).toString().replace(':', '')} {(edu.start_year || edu.start_date) && (edu.end_year || edu.end_date) ? '–' : ''} {(edu.end_year || edu.end_date) && (edu.end_year || edu.end_date).toString().replace(':', '')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {lp.skills && Array.isArray(lp.skills) && lp.skills.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {lp.skills.slice(0, 20).map((skill: any, index: number) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs"
                  >
                    {typeof skill === 'object' ? skill.name || skill.title : skill}
                  </Badge>
                ))}
                {lp.skills.length > 20 && (
                  <Badge variant="outline" className="text-xs">
                    +{lp.skills.length - 20} more
                  </Badge>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}