'use client'

import { useState, useEffect } from 'react'
import { Contact } from '@/lib/contacts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContactDetailsTab } from './tabs/ContactDetailsTab'
import { EngagementTab } from './tabs/EngagementTab'
import { LinkedInTab } from './tabs/LinkedInTab'
import { NotesTab } from './tabs/NotesTab'
import { CampaignsListsTab } from './tabs/CampaignsListsTab'
import { ContactEmailsTab } from './tabs/ContactEmailsTab'
import {
  User,
  Award,
  Linkedin,
  FileText,
  Send,
  Mail
} from 'lucide-react'

interface ContactDetailTabsProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function ContactDetailTabs({
  contact,
  onContactUpdate
}: ContactDetailTabsProps) {
  const [activeTab, setActiveTab] = useState('details')

  // Check if LinkedIn data is available
  const hasLinkedInData = !!(
    contact.linkedin_first_name ||
    contact.linkedin_headline ||
    contact.linkedin_about ||
    contact.linkedin_current_company ||
    (contact as any).linkedin_profile_data
  )

  // Show LinkedIn tab if we have data or if extraction failed
  const showLinkedInTab = hasLinkedInData || contact.linkedin_extraction_status === 'failed'

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-gray-200">
          <TabsList className={`grid w-full ${showLinkedInTab ? 'grid-cols-6' : 'grid-cols-5'} h-auto p-1 bg-gray-50`}>
            <TabsTrigger
              value="details"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Contact Details</span>
              <span className="sm:hidden">Details</span>
            </TabsTrigger>

            <TabsTrigger
              value="engagement"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">Engagement</span>
              <span className="sm:hidden">Engage</span>
            </TabsTrigger>

            {showLinkedInTab && (
              <TabsTrigger
                value="linkedin"
                className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <Linkedin className="h-4 w-4" />
                <span className="hidden sm:inline">LinkedIn</span>
                <span className="sm:hidden">Li</span>
              </TabsTrigger>
            )}

            <TabsTrigger
              value="emails"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
              <span className="sm:hidden">Emails</span>
            </TabsTrigger>

            <TabsTrigger
              value="notes"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
              <span className="sm:hidden">Notes</span>
            </TabsTrigger>

            <TabsTrigger
              value="campaigns"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Campaigns & Lists</span>
              <span className="sm:hidden">Campaigns</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-6">
          <TabsContent value="details" className="mt-0">
            <ContactDetailsTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>

          <TabsContent value="engagement" className="mt-0">
            <EngagementTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>

          {showLinkedInTab && (
            <TabsContent value="linkedin" className="mt-0">
              <LinkedInTab
                contact={contact}
                onContactUpdate={onContactUpdate}
              />
            </TabsContent>
          )}

          <TabsContent value="emails" className="mt-0">
            <ContactEmailsTab contact={contact} />
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <NotesTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>

          <TabsContent value="campaigns" className="mt-0">
            <CampaignsListsTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}