'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar, Clock } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
}

interface RescheduleCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: Campaign
  onReschedule: (campaignId: string, scheduleData: any) => void
}

export function RescheduleCampaignDialog({
  open,
  onOpenChange,
  campaign,
  onReschedule
}: RescheduleCampaignDialogProps) {
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const scheduleData = {
      type: scheduleType,
      ...(scheduleType === 'later' && {
        scheduledAt: `${scheduleDate}T${scheduleTime}:00.000Z`
      })
    }

    onReschedule(campaign.id, scheduleData)
    onOpenChange(false)
    
    // Reset form
    setScheduleType('now')
    setScheduleDate('')
    setScheduleTime('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reschedule Campaign</DialogTitle>
          <DialogDescription>
            Choose when to start the campaign "{campaign.name}".
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="now"
                name="schedule"
                value="now"
                checked={scheduleType === 'now'}
                onChange={(e) => setScheduleType(e.target.value as 'now' | 'later')}
                className="h-4 w-4 text-blue-600"
              />
              <Label htmlFor="now" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Start immediately</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="later"
                name="schedule"
                value="later"
                checked={scheduleType === 'later'}
                onChange={(e) => setScheduleType(e.target.value as 'now' | 'later')}
                className="h-4 w-4 text-blue-600"
              />
              <Label htmlFor="later" className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Schedule for later</span>
              </Label>
            </div>

            {scheduleType === 'later' && (
              <div className="ml-6 space-y-3">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <input
                    type="date"
                    id="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <input
                    type="time"
                    id="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {scheduleType === 'now' ? 'Start Now' : 'Schedule Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}