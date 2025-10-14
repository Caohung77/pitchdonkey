'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
}

interface StopCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: Campaign
  onStop: (campaignId: string) => void
}

export function StopCampaignDialog({
  open,
  onOpenChange,
  campaign,
  onStop
}: StopCampaignDialogProps) {
  const handleStop = () => {
    onStop(campaign.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span>Stop Campaign</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to stop the campaign "{campaign.name}"?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Important Information
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>This will immediately stop all scheduled emails</li>
                    <li>Contacts who haven't received emails yet will not be contacted</li>
                    <li>You can view the campaign results in analytics</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleStop}>
            Stop Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}