'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Settings,
  Star,
  Link as LinkIcon,
  RefreshCcw,
  Play,
  Pause,
  Users,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  SequenceCampaignSummary,
  SequenceLinkRecord,
  SequenceWithRelations,
} from './types'

interface SequenceBoardProps {
  sequence: SequenceWithRelations
  onAddCampaign?: () => void
  onAddLinkedCampaign?: (parentCampaignId: string) => void
  onOpenLinkSettings?: (linkId: string) => void
  onSetEntryCampaign?: (campaignId: string) => void
  onMoveCampaign?: (campaignId: string, direction: 'left' | 'right') => void
  onCreateLink?: (parentCampaignId: string, nextCampaignId: string) => void
  onActivateSequence?: () => void
  onPauseSequence?: () => void
  onRefreshSequence?: () => void
}

const STATUS_VARIANTS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  active: { label: 'Active', className: 'bg-green-100 text-green-700' },
  paused: { label: 'Paused', className: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', className: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Archived', className: 'bg-gray-200 text-gray-700' },
  scheduled: { label: 'Scheduled', className: 'bg-purple-100 text-purple-700' },
  sending: { label: 'Sending', className: 'bg-orange-100 text-orange-700' },
  stopped: { label: 'Stopped', className: 'bg-red-100 text-red-700' },
}

const CONDITION_LABELS: Record<SequenceLinkRecord['condition_type'], string> = {
  no_reply: 'No reply',
  opened_no_reply: 'Opened • No reply',
  always: 'Always send',
  custom: 'Custom',
}

export function SequenceBoard({
  sequence,
  onAddCampaign,
  onAddLinkedCampaign,
  onOpenLinkSettings,
  onSetEntryCampaign,
  onMoveCampaign,
  onCreateLink,
  onActivateSequence,
  onPauseSequence,
  onRefreshSequence,
}: SequenceBoardProps) {
  const [draggingCampaignId, setDraggingCampaignId] = useState<string | null>(null)
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false)
  const [selectedParentCampaign, setSelectedParentCampaign] = useState<string>('')
  const [dialogTargetPosition, setDialogTargetPosition] = useState<number | null>(null)

  const columns = useMemo(() => {
    const map = new Map<number, SequenceCampaignSummary[]>()
    ;(sequence.campaigns || []).forEach((campaign) => {
      const position = campaign.sequence_position ?? 1
      if (!map.has(position)) {
        map.set(position, [])
      }
      map.get(position)!.push(campaign)
    })
    const sortedPositions = Array.from(map.keys()).sort((a, b) => a - b)
    const grouped = sortedPositions.map((position) => ({
      position,
      campaigns: map.get(position)!.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    }))

    if (grouped.length === 0) {
      return [{ position: 1, campaigns: [] }]
    }

    // Add placeholder column for next follow-up step
    const lastPosition = grouped[grouped.length - 1]?.position ?? 1
    grouped.push({ position: lastPosition + 1, campaigns: [] })
    return grouped
  }, [sequence.campaigns])

  const allCampaigns = useMemo(() => sequence.campaigns || [], [sequence.campaigns])

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, campaignId: string) => {
    event.dataTransfer.setData('text/plain', campaignId)
    setDraggingCampaignId(campaignId)
  }

  const handleDragEnd = () => {
    setDraggingCampaignId(null)
  }

  const handleDropOnColumn = (targetPosition: number, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const draggedId = event.dataTransfer.getData('text/plain') || draggingCampaignId
    if (!draggedId) return

    setDraggingCampaignId(null)
    if (onAddLinkedCampaign) {
      onAddLinkedCampaign(draggedId)
    }
  }

  const openFollowUpDialog = (position: number) => {
    setDialogTargetPosition(position)
    setSelectedParentCampaign('')
    setFollowUpDialogOpen(true)
  }

  const confirmFollowUpSelection = () => {
    if (!selectedParentCampaign || !onAddLinkedCampaign) {
      return
    }
    onAddLinkedCampaign(selectedParentCampaign)
    setFollowUpDialogOpen(false)
  }

  return (
    <div className="flex flex-col space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">{sequence.sequence.name}</h2>
          {sequence.sequence.description && (
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              {sequence.sequence.description}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs uppercase tracking-wide">
            {sequence.sequence.status}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={onRefreshSequence}
            disabled={!onRefreshSequence}
          >
            <RefreshCcw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          {sequence.sequence.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onPauseSequence}
              disabled={!onPauseSequence}
            >
              <Pause className="mr-1 h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8"
              onClick={onActivateSequence}
              disabled={!onActivateSequence}
            >
              <Play className="mr-1 h-4 w-4" />
              Activate
            </Button>
          )}
          <Button size="sm" onClick={onAddCampaign} disabled={!onAddCampaign}>
            + New Campaign
          </Button>
        </div>
      </header>

      <div className="flex items-stretch space-x-6 overflow-x-auto pb-6">
        {columns.map((column, index) => {
          const isInitial = index === 0
          const previousCampaigns = index > 0 ? columns[index - 1].campaigns : []
          const gradient = gradientByIndex(index)
          const columnTitle = getColumnTitle(index, column.position, previousCampaigns, column.campaigns, sequence.links)
          const nextColumnExists = index < columns.length - 1

      return (
            <div
              key={`column-${column.position}`}
              className="min-w-[280px] max-w-xs flex flex-col rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-100"
            >
              <div className={`rounded-t-2xl p-4 text-white ${gradient}`}>
                <div className="text-xs uppercase tracking-wide opacity-90">
                  {columnTitle.subtitle}
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {columnTitle.title}
                </div>
                <div className="text-xs mt-1 opacity-90">
                  {column.campaigns.length} campaign{column.campaigns.length === 1 ? '' : 's'} in step {column.position}
                </div>
              </div>

              <div className="flex-1 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-3 pb-5 pt-4 space-y-3">
                {column.campaigns.length === 0 ? (
                  <EmptyColumnContent
                    isInitial={isInitial}
                    onAdd={() => {
                      if (isInitial) {
                        onAddCampaign?.()
                      } else {
                        openFollowUpDialog(column.position)
                      }
                    }}
                    onDrop={(event) => handleDropOnColumn(column.position, event)}
                    highlight={draggingCampaignId !== null && !isInitial}
                  />
                ) : (
                  <div className="space-y-3">
                    {column.campaigns.map((campaign, campaignIndex) => (
                      <SequenceCampaignCard
                        key={campaign.id}
                        campaign={campaign}
                        isEntry={sequence.sequence.entry_campaign_id === campaign.id}
                        isFinal={!sequence.links.some((link) => link.parent_campaign_id === campaign.id)}
                        index={campaignIndex}
                        totalIndex={column.campaigns.length}
                        onMoveLeft={() => onMoveCampaign?.(campaign.id, 'left')}
                        onMoveRight={() => onMoveCampaign?.(campaign.id, 'right')}
                        onSetEntry={() => onSetEntryCampaign?.(campaign.id)}
                        draggable
                        onDragStart={(event) => handleDragStart(event, campaign.id)}
                        onDragEnd={handleDragEnd}
                      />
                    ))}

                    {nextColumnExists && (
                      <DropConnector
                        dragged={draggingCampaignId !== null}
                        link={findLinkForColumn(sequence.links, column.campaigns)}
                        onConfigure={() => {
                          const link = findLinkForColumn(sequence.links, column.campaigns)
                          if (link) {
                            onOpenLinkSettings?.(link.id)
                          }
                        }}
                      />
                    )}

                    <AddCampaignCard
                      isInitial={isInitial}
                      onAdd={() => {
                        if (isInitial) {
                          onAddCampaign?.()
                        } else {
                          openFollowUpDialog(column.position)
                        }
                      }}
                      onDrop={(event) => handleDropOnColumn(column.position, event)}
                      highlight={draggingCampaignId !== null && !isInitial}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Follow-up Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Choose the campaign this follow-up should target. Contacts from the selected campaign will move forward into the new step.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Previous campaign</label>
              <Select value={selectedParentCampaign} onValueChange={setSelectedParentCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Select initiative campaign" />
                </SelectTrigger>
                <SelectContent>
                  {allCampaigns
                    .filter((campaign) =>
                      dialogTargetPosition ? (campaign.sequence_position ?? 1) < dialogTargetPosition : true,
                    )
                    .map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Apply engagement filters</label>
              <div className="flex flex-col space-y-2 text-sm text-slate-600">
                <label className="flex items-center space-x-2">
                  <Checkbox checked readOnly />
                  <span>Skip contacts with active auto-reply</span>
                </label>
                <label className="flex items-center space-x-2">
                  <Checkbox checked readOnly />
                  <span>Exclude bounced contacts</span>
                </label>
                <label className="flex items-center space-x-2">
                  <Checkbox checked readOnly />
                  <span>Exclude unsubscribed contacts</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFollowUpDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmFollowUpSelection} disabled={!selectedParentCampaign}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function gradientByIndex(index: number): string {
  const gradients = [
    'bg-gradient-to-r from-sky-500 to-blue-500',
    'bg-gradient-to-r from-indigo-500 to-violet-500',
    'bg-gradient-to-r from-cyan-500 to-emerald-500',
    'bg-gradient-to-r from-amber-500 to-orange-500',
  ]
  return gradients[index % gradients.length]
}

function getColumnTitle(
  index: number,
  position: number,
  previousCampaigns: SequenceCampaignSummary[],
  currentCampaigns: SequenceCampaignSummary[],
  links: SequenceLinkRecord[],
): { title: string; subtitle: string } {
  if (index === 0) {
    return { title: 'Initial Outreach', subtitle: 'Entry step' }
  }

  const parentIds = previousCampaigns.map((campaign) => campaign.id)
  const nextIds = currentCampaigns.map((campaign) => campaign.id)
  let delayLabel: string | null = null

  for (const link of links) {
    if (
      (!nextIds.length || nextIds.includes(link.next_campaign_id || '')) &&
      parentIds.includes(link.parent_campaign_id || '')
    ) {
      delayLabel = formatDelay(link.delay_days, link.delay_hours)
      break
    }
  }

  return {
    title: `Follow-up ${index}${delayLabel ? ` (${delayLabel})` : ''}`,
    subtitle: 'Automated step',
  }
}

function formatDelay(days: number, hours: number): string {
  if (days === 0 && hours === 0) return 'Immediate'

  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)

  return parts.join(' ')
}

function findLinkForColumn(
  links: SequenceLinkRecord[],
  campaigns: SequenceCampaignSummary[],
): SequenceLinkRecord | null {
  if (!campaigns.length) return null
  const parentIds = campaigns.map((campaign) => campaign.id)
  return links.find((link) => link.parent_campaign_id && parentIds.includes(link.parent_campaign_id)) ?? null
}

function formatNumber(value: number | null | undefined): string {
  if (!value) return '0'
  return value >= 1000 ? `${Math.round(value / 100) / 10}k` : value.toLocaleString()
}

function formatRate(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1)
}

function SequenceCampaignCard({
  campaign,
  isEntry,
  isFinal,
  index,
  totalIndex,
  onMoveLeft,
  onMoveRight,
  onSetEntry,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  campaign: SequenceCampaignSummary
  isEntry: boolean
  isFinal: boolean
  index: number
  totalIndex: number
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onSetEntry?: () => void
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
}) {
  const statusConfig =
    (campaign.status && STATUS_VARIANTS[campaign.status]) ?? STATUS_VARIANTS.draft

  const totalContacts = campaign.total_contacts ?? 0
  const emailsSent = campaign.emails_sent ?? 0
  const emailsOpened = campaign.emails_opened ?? 0
  const emailsReplied = campaign.emails_replied ?? 0
  const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0
  const replyRate = emailsSent > 0 ? (emailsReplied / emailsSent) * 100 : 0

  const description = (() => {
    if (!campaign.description) return ''
    try {
      const parsed = JSON.parse(campaign.description)
      if (typeof parsed === 'string') return parsed
      if (parsed && typeof parsed === 'object') {
        return parsed.description || parsed.summary || ''
      }
    } catch (error) {
      // ignore parse errors
    }
    return campaign.description
  })()

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white shadow-md transition hover:shadow-lg hover:shadow-slate-200/70"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <div className="font-semibold text-slate-900">{campaign.name}</div>
          <div className="mt-1 flex items-center space-x-2 text-xs text-slate-500">
            {isEntry && <Badge variant="secondary">Entry</Badge>}
            {isFinal && <Badge variant="outline">End</Badge>}
            {campaign.sequence_position && <span>Step {campaign.sequence_position}</span>}
          </div>
        </div>
        <Badge className={`text-xs ${statusConfig.className}`}>{statusConfig.label}</Badge>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="text-sm text-slate-600 line-clamp-2 min-h-[40px]">
          {description || 'No description provided'}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span>{formatNumber(totalContacts)} contacts</span>
          </div>
          <div className="flex items-center space-x-2">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            <span>{formatNumber(emailsSent)} sent</span>
          </div>
          <div className="col-span-1">
            <span className="font-medium text-slate-700">{formatRate(openRate)}%</span>
            <span className="ml-1 text-slate-500">open rate</span>
          </div>
          <div className="col-span-1">
            <span className="font-medium text-slate-700">{formatRate(replyRate)}%</span>
            <span className="ml-1 text-slate-500">reply rate</span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onMoveLeft}
              disabled={!onMoveLeft || index === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onMoveRight}
              disabled={!onMoveRight || index === totalIndex - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onSetEntry}
            disabled={!onSetEntry || isEntry}
          >
            <Star className="mr-1 h-3 w-3" />
            Set as Entry
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmptyColumnContent({
  isInitial,
  onAdd,
  onDrop,
  highlight,
}: {
  isInitial: boolean
  onAdd: () => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  highlight: boolean
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 transition ${highlight ? 'border-sky-400 bg-sky-50/50 shadow-sm' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="mb-3 text-lg font-semibold text-slate-600">
        {isInitial ? 'Start your sequence' : 'Add follow-up campaign'}
      </div>
      <p className="mb-4 text-xs text-slate-500">
        {isInitial
          ? 'Begin by creating the first outreach initiative for this sequence.'
          : 'Drag a campaign here or use the add button to create a follow-up.'}
      </p>
      <Button variant="outline" size="sm" onClick={onAdd}>
        + {isInitial ? 'Create Campaign' : 'New Follow-up'}
      </Button>
    </div>
  )
}

function AddCampaignCard({
  isInitial,
  onAdd,
  onDrop,
  highlight,
}: {
  isInitial: boolean
  onAdd: () => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  highlight: boolean
}) {
  return (
    <div
      className={`flex h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-sm text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 ${highlight ? 'border-sky-400 bg-sky-50/70 shadow-sm' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="text-lg font-semibold text-slate-600 mb-1">Add Campaign</div>
      <p className="text-xs">Click or drag here</p>
      <Button size="sm" className="mt-3" onClick={onAdd}>
        + {isInitial ? 'Initial Campaign' : 'Follow-up'}
      </Button>
    </div>
  )
}

function DropConnector({
  dragged,
  link,
  onConfigure,
}: {
  dragged: boolean
  link: SequenceLinkRecord | null
  onConfigure: () => void
}) {
  const hasLink = !!link
  return (
    <div className="flex flex-col items-center space-y-2">
      <ArrowRight className={`h-6 w-6 ${dragged ? 'text-sky-400' : 'text-slate-300'}`} />
      <div className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm shadow-slate-100">
        {hasLink ? (
          <div className="space-y-1">
            <div className="font-semibold text-slate-700">Link Settings</div>
            <div className="flex items-center space-x-1 text-slate-500">
              <Clock className="h-3 w-3" />
              <span>{formatDelay(link!.delay_days, link!.delay_hours)}</span>
            </div>
            <div>{CONDITION_LABELS[link!.condition_type] ?? 'No condition'}</div>
            <Button variant="ghost" size="xs" className="h-7 text-[11px]" onClick={onConfigure}>
              <Settings className="mr-1 h-3 w-3" /> Configure link
            </Button>
          </div>
        ) : (
          <div className="space-y-1 text-center">
            <div className="font-medium text-slate-600">
              No link configured yet
            </div>
            <div className="text-[11px] text-slate-500">
              Drop a campaign here to start a follow-up
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
