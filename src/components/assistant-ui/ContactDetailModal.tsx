'use client'

import { Contact } from '@/lib/contacts'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContactDetailsTab } from '@/components/contacts/tabs/ContactDetailsTab'
import { EngagementTab } from '@/components/contacts/tabs/EngagementTab'
import { ContactEmailsTab } from '@/components/contacts/tabs/ContactEmailsTab'
import { CampaignsListsTab } from '@/components/contacts/tabs/CampaignsListsTab'
import { LinkedInTab } from '@/components/contacts/tabs/LinkedInTab'
import { NotesTab } from '@/components/contacts/tabs/NotesTab'

interface ContactDetailModalProps {
  contact: Contact
  open: boolean
  onClose: () => void
}

export function ContactDetailModal({ contact, open, onClose }: ContactDetailModalProps) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12 bg-gradient-to-br from-blue-100 to-purple-100 text-blue-700 font-semibold">
              <AvatarFallback className="text-lg">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{name}</h2>
              {contact.position && <p className="text-sm text-gray-500">{contact.position}</p>}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-6 flex-shrink-0">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="details" className="mt-0">
              <ContactDetailsTab contact={contact} onContactUpdate={() => {}} readOnly />
            </TabsContent>

            <TabsContent value="engagement" className="mt-0">
              <EngagementTab contact={contact} />
            </TabsContent>

            <TabsContent value="emails" className="mt-0">
              <ContactEmailsTab contactId={contact.id} />
            </TabsContent>

            <TabsContent value="campaigns" className="mt-0">
              <CampaignsListsTab contactId={contact.id} />
            </TabsContent>

            <TabsContent value="linkedin" className="mt-0">
              <LinkedInTab contact={contact} onContactUpdate={() => {}} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <NotesTab contact={contact} onContactUpdate={() => {}} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
