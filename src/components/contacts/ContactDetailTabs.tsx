'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContactDetailsTab } from './tabs/ContactDetailsTab'
import { EngagementTab } from './tabs/EngagementTab'
import { LinkedInTab } from './tabs/LinkedInTab'
import { NotesTab } from './tabs/NotesTab'
import { CampaignsListsTab } from './tabs/CampaignsListsTab'
import {
  User,
  TrendingUp,
  Linkedin,
  FileText,
  Target,
  Users
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
  engagement_sent_count?: number
  engagement_open_count?: number
  engagement_click_count?: number
  engagement_reply_count?: number
  engagement_bounce_count?: number
  engagement_last_positive_at?: string
  notes?: string
  custom_fields?: Record<string, any>
  enriched_data?: Record<string, any>
  created_at: string
  updated_at: string
}

interface ContactDetailTabsProps {
  contact: Contact
  onContactUpdate: (contact: Contact) => void
}

export function ContactDetailTabs({ contact, onContactUpdate }: ContactDetailTabsProps) {
  const [activeTab, setActiveTab] = useState('details')

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 px-6">
          <TabsList className="grid w-full grid-cols-5 bg-transparent h-auto p-0">
            <TabsTrigger
              value="details"
              className="flex items-center space-x-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent py-4 px-6 hover:text-blue-600 transition-colors"
            >
              <User className="h-4 w-4" />
              <span>Details</span>
            </TabsTrigger>

            <TabsTrigger
              value="engagement"
              className="flex items-center space-x-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent py-4 px-6 hover:text-blue-600 transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Engagement</span>
            </TabsTrigger>

            <TabsTrigger
              value="linkedin"
              className="flex items-center space-x-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent py-4 px-6 hover:text-blue-600 transition-colors"
            >
              <Linkedin className="h-4 w-4" />
              <span>LinkedIn</span>
            </TabsTrigger>

            <TabsTrigger
              value="notes"
              className="flex items-center space-x-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent py-4 px-6 hover:text-blue-600 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>Notes</span>
            </TabsTrigger>

            <TabsTrigger
              value="campaigns"
              className="flex items-center space-x-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none border-b-2 border-transparent py-4 px-6 hover:text-blue-600 transition-colors"
            >
              <Target className="h-4 w-4" />
              <span>Campaigns & Lists</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <TabsContent value="details" className="space-y-6 mt-0">
            <ContactDetailsTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6 mt-0">
            <EngagementTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>

          <TabsContent value="linkedin" className="space-y-6 mt-0">
            <LinkedInTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>

          <TabsContent value="notes" className="space-y-6 mt-0">
            <NotesTab
              contact={contact}
              onContactUpdate={onContactUpdate}
            />
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6 mt-0">
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