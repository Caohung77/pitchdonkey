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
  const [error, setError] = useState<string | null>(null)

  const localDateString = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Helper: round Date to next 5-minute slot
  const getNext5MinSlot = () => {
    const now = new Date()
    const ms = 5 * 60 * 1000
    const rounded = new Date(Math.ceil(now.getTime() / ms) * ms)
    const yyyy = rounded.getFullYear()
    const mm = String(rounded.getMonth() + 1).padStart(2, '0')
    const dd = String(rounded.getDate()).padStart(2, '0')
    const hh = String(rounded.getHours()).padStart(2, '0')
    const min = String(rounded.getMinutes()).padStart(2, '0')
    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}:${min}`,
    }
  }

  // Build a local Date from date+time strings, tolerant of locales
  const parseLocalDateTime = (dateStr: string, timeStr: string) => {
    let year = 0, month = 0, day = 0
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-')
      year = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10)
      day = parseInt(parts[2], 10)
    } else if (dateStr.includes('.')) {
      const parts = dateStr.split('.')
      day = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10)
      year = parseInt(parts[2], 10)
    }
    const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10))
    return new Date(year, month - 1, day, h, m)
  }

  const validate = (): boolean => {
    setError(null)
    if (scheduleType === 'later') {
      if (!scheduleDate || !scheduleTime) {
        setError('Please choose both date and time.')
        return false
      }
      const selected = parseLocalDateTime(scheduleDate, scheduleTime)
      const now = new Date()
      if (selected.getTime() <= now.getTime()) {
        setError('Scheduled time must be in the future.')
        return false
      }
    }
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    
    // Convert local date+time to an accurate UTC instant
    const scheduleData = {
      type: scheduleType,
      ...(scheduleType === 'later' && scheduleDate && scheduleTime
        ? {
            // Use local interpretation then convert to UTC ISO string
            scheduledAt: parseLocalDateTime(scheduleDate, scheduleTime).toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : {})
    }

    onReschedule(campaign.id, scheduleData)
    onOpenChange(false)
    
    // Reset form
    setScheduleType('now')
    setScheduleDate('')
    setScheduleTime('')
    setError(null)
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
                onChange={(e) => {
                  const val = e.target.value as 'now' | 'later'
                  setScheduleType(val)
                  if (val === 'later' && (!scheduleDate || !scheduleTime)) {
                    const next = getNext5MinSlot()
                    setScheduleDate(next.date)
                    setScheduleTime(next.time)
                  }
                }}
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
                    onChange={(e) => { setScheduleDate(e.target.value); setTimeout(validate, 0) }}
                    min={localDateString()}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <select
                      aria-label="Hour"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={scheduleTime ? scheduleTime.split(':')[0] : ''}
                      onChange={(e) => {
                        const hour = e.target.value.padStart(2, '0')
                        const minute = scheduleTime ? scheduleTime.split(':')[1] : '00'
                        setScheduleTime(`${hour}:${minute}`)
                        setTimeout(validate, 0)
                      }}
                      required
                    >
                      <option value="" disabled>Select hour</option>
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={String(h).padStart(2, '0')}>
                          {String(h).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Minute"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={scheduleTime ? scheduleTime.split(':')[1] : ''}
                      onChange={(e) => {
                        const minute = e.target.value.padStart(2, '0')
                        const hour = scheduleTime ? scheduleTime.split(':')[0] : '00'
                        setScheduleTime(`${hour}:${minute}`)
                        setTimeout(validate, 0)
                      }}
                      required
                    >
                      <option value="" disabled>Select minutes</option>
                      {Array.from({ length: 12 }).map((_, i) => {
                        const m = String(i * 5).padStart(2, '0')
                        return (
                          <option key={m} value={m}>{m}</option>
                        )
                      })}
                    </select>
                  </div>
                </div>
                {error && (
                  <p className="text-red-600 text-sm" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={scheduleType === 'later' && !!error}>
              {scheduleType === 'now' ? 'Start Now' : 'Schedule Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
