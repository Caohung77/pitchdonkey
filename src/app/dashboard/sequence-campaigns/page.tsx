'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { ApiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { SequenceBoard } from '@/components/sequences/SequenceBoard'
import type { SequenceLinkRecord, SequenceWithRelations, SequenceStatus } from '@/components/sequences/types'
import { useRouter } from 'next/navigation'

interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: string
}

type ActiveLinkContext = {
  sequenceId: string
  parentCampaignId: string
  nextCampaignId: string
  link: SequenceLinkRecord | null
}

type LinkFormState = {
  delayDays: number
  delayHours: number
  conditionType: SequenceLinkRecord['condition_type']
  minOpens: number
  minClicks: number
  engagementRequired: boolean
}

const createDefaultLinkForm = (): LinkFormState => ({
  delayDays: 3,
  delayHours: 0,
  conditionType: 'no_reply',
  minOpens: 0,
  minClicks: 0,
  engagementRequired: false,
})

export default function SequenceCampaignsPage() {
  const router = useRouter()
  const [sequences, setSequences] = useState<SequenceWithRelations[]>([])
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creatingSequence, setCreatingSequence] = useState(false)
  const [newSequenceName, setNewSequenceName] = useState('')
  const [newSequenceDescription, setNewSequenceDescription] = useState('')
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [savingLink, setSavingLink] = useState(false)
  const [activeLinkContext, setActiveLinkContext] = useState<ActiveLinkContext | null>(null)
  const [linkForm, setLinkForm] = useState<LinkFormState>(() => createDefaultLinkForm())

  const selectedSequence = useMemo(
    () => sequences.find((item) => item.sequence.id === selectedSequenceId) ?? null,
    [sequences, selectedSequenceId],
  )

  useEffect(() => {
    refreshSequences()
  }, [])

  async function refreshSequences() {
    try {
      setLoading(true)
      setError(null)
      const response = (await ApiClient.get('/api/sequences')) as ApiEnvelope<
        SequenceWithRelations[]
      >

      if (!response.success) {
        throw new Error(response.error || 'Failed to load sequences')
      }

      setSequences(response.data)
      if (response.data.length > 0 && !selectedSequenceId) {
        setSelectedSequenceId(response.data[0].sequence.id)
      }
    } catch (err: any) {
      console.error('Failed to load sequences:', err)
      setError(err.message || 'Failed to load sequences')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSequence() {
    if (!newSequenceName.trim()) {
      setError('Sequence name is required')
      return
    }

    try {
      setCreatingSequence(true)
      const response = (await ApiClient.post('/api/sequences', {
        name: newSequenceName.trim(),
        description: newSequenceDescription.trim() || null,
      })) as ApiEnvelope<any>

      if (!response.success) {
        throw new Error(response.error || 'Failed to create sequence')
      }

      setShowCreateDialog(false)
      setNewSequenceName('')
      setNewSequenceDescription('')
      await refreshSequences()
    } catch (err: any) {
      console.error('Failed to create sequence:', err)
      setError(err.message || 'Failed to create sequence')
    } finally {
      setCreatingSequence(false)
    }
  }

  async function handleChangeSequenceStatus(sequenceId: string, status: SequenceStatus) {
    try {
      setError(null)
      await ApiClient.put(`/api/sequences/${sequenceId}`, { status })
      await refreshSequences()
    } catch (err: any) {
      console.error('Failed to update sequence status:', err)
      setError(err.message || 'Failed to update sequence status')
    }
  }

  function openLinkDialog(
    context: ActiveLinkContext,
    initialForm?: Partial<LinkFormState>,
  ) {
    setActiveLinkContext(context)
    setLinkForm({
      ...createDefaultLinkForm(),
      ...initialForm,
    })
    setLinkDialogOpen(true)
  }

  function closeLinkDialog() {
    setLinkDialogOpen(false)
    setSavingLink(false)
    setActiveLinkContext(null)
    setLinkForm(createDefaultLinkForm())
  }

  function handleOpenLinkSettings(linkId: string) {
    if (!selectedSequence) return
    const link = selectedSequence.links.find((item) => item.id === linkId)
    if (!link) {
      console.warn('Link not found for editing', linkId)
      return
    }
    if (!link.parent_campaign_id) {
      console.warn('Link missing parent campaign', linkId)
      return
    }
    openLinkDialog(
      {
        sequenceId: selectedSequence.sequence.id,
        parentCampaignId: link.parent_campaign_id,
        nextCampaignId: link.next_campaign_id,
        link,
      },
      {
        delayDays: link.delay_days,
        delayHours: link.delay_hours,
        conditionType: link.condition_type,
        minOpens: link.min_opens,
        minClicks: link.min_clicks,
        engagementRequired: link.engagement_required,
      },
    )
  }

  function handleCreateLink(parentCampaignId: string, nextCampaignId: string) {
    if (!selectedSequence) return
    setError(null)
    openLinkDialog({
      sequenceId: selectedSequence.sequence.id,
      parentCampaignId,
      nextCampaignId,
      link: null,
    })
  }

  async function handleSaveLink() {
    if (!activeLinkContext) return

    try {
      setSavingLink(true)
      setError(null)
      const payload = {
        delayDays: Number(linkForm.delayDays) || 0,
        delayHours: Number(linkForm.delayHours) || 0,
        conditionType: linkForm.conditionType,
        minOpens: Number(linkForm.minOpens) || 0,
        minClicks: Number(linkForm.minClicks) || 0,
        engagementRequired: !!linkForm.engagementRequired,
      }

      if (activeLinkContext.link) {
        await ApiClient.put(
          `/api/sequences/${activeLinkContext.sequenceId}/links/${activeLinkContext.link.id}`,
          payload,
        )
      } else {
        await ApiClient.post(`/api/sequences/${activeLinkContext.sequenceId}/links`, {
          parentCampaignId: activeLinkContext.parentCampaignId,
          nextCampaignId: activeLinkContext.nextCampaignId,
          ...payload,
        })
      }

      closeLinkDialog()
      await refreshSequences()
    } catch (err: any) {
      console.error('Failed to save link settings:', err)
      setError(err.message || 'Failed to save link settings')
    } finally {
      setSavingLink(false)
    }
  }

  async function handleDeleteLink() {
    if (!activeLinkContext?.link) return
    try {
      setSavingLink(true)
      setError(null)
      await ApiClient.delete(
        `/api/sequences/${activeLinkContext.sequenceId}/links/${activeLinkContext.link.id}`,
      )
      closeLinkDialog()
      await refreshSequences()
    } catch (err: any) {
      console.error('Failed to delete link:', err)
      setError(err.message || 'Failed to delete link')
    } finally {
      setSavingLink(false)
    }
  }

  async function handleSetEntryCampaign(campaignId: string) {
    if (!selectedSequence) return
    try {
      setError(null)
      await ApiClient.post(
        `/api/sequences/${selectedSequence.sequence.id}/entry`,
        { campaignId },
      )
      await refreshSequences()
    } catch (err: any) {
      console.error('Failed to update entry campaign:', err)
      setError(err.message || 'Failed to update entry campaign')
    }
  }

  async function handleMoveCampaign(
    campaignId: string,
    direction: 'left' | 'right',
  ) {
    if (!selectedSequence) return
    const orderedCampaignIds = [...selectedSequence.campaigns]
      .sort((a, b) => {
        const aPosition = a.sequence_position ?? Number.MAX_SAFE_INTEGER
        const bPosition = b.sequence_position ?? Number.MAX_SAFE_INTEGER
        return aPosition - bPosition
      })
      .map((campaign) => campaign.id)

    const currentIndex = orderedCampaignIds.indexOf(campaignId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= orderedCampaignIds.length) return

    const updated = [...orderedCampaignIds]
    ;[updated[currentIndex], updated[targetIndex]] = [
      updated[targetIndex],
      updated[currentIndex],
    ]

    try {
      setError(null)
      await ApiClient.post(
        `/api/sequences/${selectedSequence.sequence.id}/reorder`,
        { orderedCampaignIds: updated },
      )
      await refreshSequences()
    } catch (err: any) {
      console.error('Failed to reorder campaigns:', err)
      setError(err.message || 'Failed to reorder campaigns')
    }
  }

  function navigateToSimpleCampaignBuilder(params: {
    sequenceId?: string | null
    parentCampaignId?: string
  } = {}) {
    const searchParams = new URLSearchParams()

    if (params.sequenceId) {
      searchParams.set('sequenceId', params.sequenceId)
    }

    if (params.parentCampaignId) {
      searchParams.set('parentCampaignId', params.parentCampaignId)
    }

    const queryString = searchParams.toString()
    const target = queryString
      ? `/dashboard/campaigns/simple?${queryString}`
      : '/dashboard/campaigns/simple'

    router.push(target)
  }

  function handleAddCampaign() {
    if (!selectedSequenceId) {
      navigateToSimpleCampaignBuilder()
      return
    }

    navigateToSimpleCampaignBuilder({ sequenceId: selectedSequenceId })
  }

  function handleAddLinkedCampaign(parentCampaignId: string) {
    if (!selectedSequenceId) {
      setError('Select or create a sequence before adding follow-up campaigns.')
      return
    }

    navigateToSimpleCampaignBuilder({
      sequenceId: selectedSequenceId,
      parentCampaignId,
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Sequence Campaigns</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Chain your existing campaigns into automated multi-step sequences with timed
            transitions and engagement rules.
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null)
            setShowCreateDialog(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Sequence
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && sequences.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading sequences…
        </div>
      ) : sequences.length === 0 ? (
        <EmptyKanbanState />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {sequences.length} sequence{sequences.length === 1 ? '' : 's'} available
            </div>
            {loading && sequences.length > 0 && (
              <div className="flex items-center text-xs text-slate-500">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Refreshing sequences…
              </div>
            )}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-full items-center gap-3">
              {sequences.map((item) => {
                const isActive = selectedSequenceId === item.sequence.id
                return (
                  <button
                    key={item.sequence.id}
                    onClick={() => setSelectedSequenceId(item.sequence.id)}
                    className={`flex max-w-xs flex-1 flex-col rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition ${
                      isActive
                        ? 'border-sky-300 shadow-lg shadow-sky-100'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {item.sequence.name}
                    </span>
                    {item.sequence.description && (
                      <span className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {item.sequence.description}
                      </span>
                    )}
                    <span className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {item.campaigns.length} campaign{item.campaigns.length === 1 ? '' : 's'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedSequence ? (
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6 shadow-lg shadow-slate-100">
              <SequenceBoard
                sequence={selectedSequence}
                onAddCampaign={handleAddCampaign}
                onAddLinkedCampaign={handleAddLinkedCampaign}
                onOpenLinkSettings={handleOpenLinkSettings}
                onSetEntryCampaign={handleSetEntryCampaign}
                onMoveCampaign={handleMoveCampaign}
                onCreateLink={handleCreateLink}
                onActivateSequence={() =>
                  handleChangeSequenceStatus(selectedSequence.sequence.id, 'active')
                }
                onPauseSequence={() =>
                  handleChangeSequenceStatus(selectedSequence.sequence.id, 'paused')
                }
                onRefreshSequence={refreshSequences}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
              Select a sequence to view its campaigns on the board.
            </div>
          )}
        </div>
      )}

      <Dialog open={linkDialogOpen} onOpenChange={(open) => !open && closeLinkDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeLinkContext?.link ? 'Edit Link Settings' : 'Create Sequence Link'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="link-delay-days">Delay (Days)</Label>
                <Input
                  id="link-delay-days"
                  type="number"
                  min={0}
                  value={linkForm.delayDays}
                  onChange={(event) =>
                    setLinkForm((prev) => ({
                      ...prev,
                      delayDays: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-delay-hours">Delay (Hours)</Label>
                <Input
                  id="link-delay-hours"
                  type="number"
                  min={0}
                  max={23}
                  value={linkForm.delayHours}
                  onChange={(event) =>
                    setLinkForm((prev) => ({
                      ...prev,
                      delayHours: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-condition">Condition</Label>
              <Select
                value={linkForm.conditionType}
                onValueChange={(value: SequenceLinkRecord['condition_type']) =>
                  setLinkForm((prev) => ({ ...prev, conditionType: value }))
                }
              >
                <SelectTrigger id="link-condition">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_reply">No reply</SelectItem>
                  <SelectItem value="opened_no_reply">Opened but no reply</SelectItem>
                  <SelectItem value="always">Always send</SelectItem>
                  <SelectItem value="custom">Custom (manual logic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="link-engagement"
                  checked={linkForm.engagementRequired}
                  onCheckedChange={(checked) =>
                    setLinkForm((prev) => ({
                      ...prev,
                      engagementRequired: checked === true,
                    }))
                  }
                />
                <Label htmlFor="link-engagement" className="text-sm">
                  Require engagement thresholds
                </Label>
              </div>
              {linkForm.engagementRequired && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="link-min-opens">Min opens</Label>
                    <Input
                      id="link-min-opens"
                      type="number"
                      min={0}
                      value={linkForm.minOpens}
                      onChange={(event) =>
                        setLinkForm((prev) => ({
                          ...prev,
                          minOpens: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link-min-clicks">Min clicks</Label>
                    <Input
                      id="link-min-clicks"
                      type="number"
                      min={0}
                      value={linkForm.minClicks}
                      onChange={(event) =>
                        setLinkForm((prev) => ({
                          ...prev,
                          minClicks: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            {activeLinkContext?.link && (
              <Button
                variant="destructive"
                onClick={handleDeleteLink}
                disabled={savingLink}
              >
                {savingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Link
              </Button>
            )}
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={closeLinkDialog} disabled={savingLink}>
                Cancel
              </Button>
              <Button onClick={handleSaveLink} disabled={savingLink}>
                {savingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sequence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sequence-name">Sequence Name</Label>
              <Input
                id="sequence-name"
                placeholder="e.g. Product Launch Sequence"
                value={newSequenceName}
                onChange={(event) => setNewSequenceName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sequence-description">Description (optional)</Label>
              <Input
                id="sequence-description"
                placeholder="What is this sequence for?"
                value={newSequenceDescription}
                onChange={(event) => setNewSequenceDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSequence} disabled={creatingSequence}>
              {creatingSequence && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Sequence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyKanbanState() {
  const sampleColumns = [
    {
      title: 'Initial Outreach',
      subtitle: 'Entry step',
      campaigns: [
        {
          name: 'Product Launch Campaign',
          summary: 'Introduce new AI features to existing customer base',
          status: 'Active',
          contacts: '1,250 contacts',
        },
        {
          name: 'Cold Outreach – Tech Startups',
          summary: 'Target Series A-B tech companies in DACH region',
          status: 'Draft',
          contacts: '850 contacts',
        },
      ],
    },
    {
      title: 'Follow-up 1 (Day 3)',
      subtitle: 'Automated step',
      campaigns: [
        {
          name: 'Product Launch Follow-up',
          summary: 'Follow up with non-responders from initial campaign',
          status: 'Active',
          contacts: '420 contacts',
        },
      ],
    },
    {
      title: 'Follow-up 2',
      subtitle: 'Automated step',
      campaigns: [],
    },
  ]

  const gradients = [
    'bg-gradient-to-r from-sky-500 to-blue-500',
    'bg-gradient-to-r from-indigo-500 to-violet-500',
    'bg-gradient-to-r from-cyan-500 to-emerald-500',
  ]

  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 shadow-inner">
      <div className="flex items-stretch gap-6 overflow-x-auto pb-2">
        {sampleColumns.map((column, index) => (
          <div
            key={column.title}
            className="min-w-[260px] max-w-xs flex-1 rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-100"
          >
            <div className={`rounded-t-2xl p-4 text-white ${gradients[index % gradients.length]}`}>
              <div className="text-xs uppercase tracking-wide opacity-90">{column.subtitle}</div>
              <div className="text-lg font-semibold leading-tight">{column.title}</div>
              <div className="text-xs mt-1 opacity-90">
                {column.campaigns.length} campaign{column.campaigns.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="space-y-3 rounded-b-2xl border-t border-slate-100 bg-slate-50 p-4">
              {column.campaigns.map((campaign) => (
                <div
                  key={campaign.name}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="text-sm font-semibold text-slate-900">{campaign.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{campaign.summary}</div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{campaign.contacts}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 ${
                        campaign.status === 'Active'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                </div>
              ))}

              <div className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-sm text-slate-500">
                <div className="text-base font-semibold text-slate-600">Add Campaign</div>
                <p className="mt-1 text-xs">Click or drag here</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
