import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types'

type Supabase = SupabaseClient<Database>

export type SequenceRecord = Tables<'sequences'>
export type SequenceInsert = TablesInsert<'sequences'>
export type SequenceUpdate = TablesUpdate<'sequences'>
export type SequenceLinkRecord = Tables<'sequence_links'>
export type SequenceLinkInsert = TablesInsert<'sequence_links'>
export type SequenceLinkUpdate = TablesUpdate<'sequence_links'>
export type SequenceEnrollmentRecord = Tables<'sequence_enrollments'>
type CampaignRow = Tables<'campaigns'>

export type SequenceConditionType = SequenceLinkRecord['condition_type']

export interface SequenceCampaignSummary {
  id: string
  name: string
  status: string | null
  sequence_id: string | null
  sequence_position: number | null
  created_at: string | null
  updated_at: string | null
}

export interface SequenceWithRelations {
  sequence: SequenceRecord
  campaigns: SequenceCampaignSummary[]
  links: SequenceLinkRecord[]
}

export interface SequenceCreateInput {
  name: string
  description?: string
  entryCampaignId?: string | null
  status?: SequenceRecord['status']
}

export interface SequenceUpdateInput {
  name?: string
  description?: string | null
  entryCampaignId?: string | null
  status?: SequenceRecord['status']
}

export interface CampaignSequenceAssignment {
  campaignId: string
  sequenceId: string | null
  position?: number | null
}

export interface SequenceLinkInput {
  parentCampaignId?: string | null
  nextCampaignId: string
  delayDays?: number
  delayHours?: number
  conditionType?: SequenceLinkRecord['condition_type']
  minOpens?: number
  minClicks?: number
  engagementRequired?: boolean
  filterAutoReply?: boolean
  filterBounced?: boolean
  filterUnsubscribed?: boolean
  personaOverrideId?: string | null
  deliveryWindow?: Record<string, any> | null
  metadata?: Record<string, any> | null
}

export class SequenceService {
  constructor(private readonly supabase: Supabase, private readonly userId: string) {}

  /**
   * Fetch all sequences for the authenticated user with their campaigns and links
   */
  async listSequences(): Promise<SequenceWithRelations[]> {
    const { data: sequences, error: sequencesError } = await this.supabase
      .from('sequences')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })

    if (sequencesError) {
      throw new Error(`Failed to load sequences: ${sequencesError.message}`)
    }

    if (!sequences || sequences.length === 0) {
      return []
    }

    const sequenceIds = sequences.map((seq) => seq.id)

    const [campaignsResult, linksResult] = await Promise.all([
      sequenceIds.length === 0
        ? Promise.resolve({ data: [] as SequenceCampaignSummary[], error: null })
        : this.supabase
            .from('campaigns')
            .select(
              'id, name, description, status, sequence_id, sequence_position, created_at, updated_at, user_id, total_contacts, emails_sent, emails_opened, emails_clicked, emails_replied',
            )
            .in('sequence_id', sequenceIds)
            .eq('user_id', this.userId)
            .order('sequence_position', { ascending: true }),
      this.supabase
        .from('sequence_links')
        .select('*')
        .in('sequence_id', sequenceIds),
    ])

    if (campaignsResult.error) {
      throw new Error(`Failed to load sequence campaigns: ${campaignsResult.error.message}`)
    }

    if (linksResult.error) {
      throw new Error(`Failed to load sequence links: ${linksResult.error.message}`)
    }

    const campaignsBySequence = new Map<string, SequenceCampaignSummary[]>()
    const campaignRows = (campaignsResult.data || []) as CampaignRow[]

    for (const campaign of campaignRows) {
      if (!campaign.sequence_id) continue

      const existing = campaignsBySequence.get(campaign.sequence_id) || []
      existing.push({
        id: campaign.id,
        name: campaign.name,
        description: (campaign as CampaignRow).description as any,
        status: campaign.status,
        sequence_id: campaign.sequence_id,
        sequence_position: campaign.sequence_position,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
        total_contacts: campaign.total_contacts ?? null,
        emails_sent: campaign.emails_sent ?? null,
        emails_opened: campaign.emails_opened ?? null,
        emails_clicked: campaign.emails_clicked ?? null,
        emails_replied: campaign.emails_replied ?? null,
      })
      campaignsBySequence.set(campaign.sequence_id, existing)
    }

    const linksBySequence = new Map<string, SequenceLinkRecord[]>()
    for (const link of linksResult.data || []) {
      const existing = linksBySequence.get(link.sequence_id) || []
      existing.push(link)
      linksBySequence.set(link.sequence_id, existing)
    }

    return sequences.map((sequence) => ({
      sequence,
      campaigns: campaignsBySequence.get(sequence.id) || [],
      links: linksBySequence.get(sequence.id) || [],
    }))
  }

  /**
   * Fetch a specific sequence with related data
   */
  async getSequence(sequenceId: string): Promise<SequenceWithRelations | null> {
    const sequences = await this.listSequences()
    return sequences.find((item) => item.sequence.id === sequenceId) || null
  }

  /**
   * Create a new sequence owned by the user
   */
  async createSequence(input: SequenceCreateInput): Promise<SequenceRecord> {
    const payload: SequenceInsert = {
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'draft',
      entry_campaign_id: input.entryCampaignId ?? null,
      user_id: this.userId,
    }

    const { data, error } = await this.supabase
      .from('sequences')
      .insert(payload)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create sequence: ${error?.message || 'Unknown error'}`)
    }

    return data
  }

  /**
   * Update basic sequence metadata
   */
  async updateSequence(sequenceId: string, updates: SequenceUpdateInput): Promise<SequenceRecord> {
    const payload: SequenceUpdate = {}

    if (typeof updates.name === 'string') {
      payload.name = updates.name
    }
    if (updates.description !== undefined) {
      payload.description = updates.description
    }
    if (updates.status) {
      payload.status = updates.status
    }
    if (updates.entryCampaignId !== undefined) {
      payload.entry_campaign_id = updates.entryCampaignId
    }

    if (Object.keys(payload).length === 0) {
      const { data, error } = await this.supabase
        .from('sequences')
        .select('*')
        .eq('id', sequenceId)
        .eq('user_id', this.userId)
        .single()

      if (error || !data) {
        throw new Error('Sequence not found or access denied')
      }

      return data
    }

    const { data, error } = await this.supabase
      .from('sequences')
      .update(payload)
      .eq('id', sequenceId)
      .eq('user_id', this.userId)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to update sequence: ${error?.message || 'Unknown error'}`)
    }

    return data
  }

  /**
   * Permanently remove a sequence and associated data
   */
  async deleteSequence(sequenceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('sequences')
      .delete()
      .eq('id', sequenceId)
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`Failed to delete sequence: ${error.message}`)
    }
  }

  /**
   * Update campaign assignments for a sequence.
   * Pass sequenceId = null to remove a campaign from any sequence.
   */
  async updateCampaignAssignments(assignments: CampaignSequenceAssignment[]): Promise<void> {
    if (assignments.length === 0) return

    const campaignsToVerify = assignments.map((a) => a.campaignId)

    const { data: campaigns, error: campaignsError } = await this.supabase
      .from('campaigns')
      .select('id, user_id')
      .in('id', campaignsToVerify)

    if (campaignsError) {
      throw new Error(`Failed to verify campaigns: ${campaignsError.message}`)
    }

    const unauthorized = campaigns?.filter((c) => c.user_id !== this.userId) || []
    if (unauthorized.length > 0) {
      throw new Error('Cannot modify campaigns that belong to a different user')
    }

    for (const assignment of assignments) {
      const updatePayload: TablesUpdate<'campaigns'> = {
        sequence_id: assignment.sequenceId,
        sequence_position: assignment.position ?? null,
      }

      const { error } = await this.supabase
        .from('campaigns')
        .update(updatePayload)
        .eq('id', assignment.campaignId)
        .eq('user_id', this.userId)

      if (error) {
        throw new Error(`Failed to update campaign ${assignment.campaignId}: ${error.message}`)
      }
    }
  }

  /**
   * Reorder campaigns inside a sequence by providing ordered campaign IDs
   */
  async reorderSequence(sequenceId: string, orderedCampaignIds: string[]): Promise<void> {
    if (orderedCampaignIds.length === 0) return

    await this.ensureSequenceOwnership(sequenceId)

    const updates = orderedCampaignIds.map((campaignId, index) =>
      this.supabase
        .from('campaigns')
        .update({ sequence_position: index + 1 })
        .eq('id', campaignId)
        .eq('user_id', this.userId)
        .eq('sequence_id', sequenceId),
    )

    const results = await Promise.all(updates)
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      throw new Error(`Failed to reorder campaigns: ${failed.error.message}`)
    }
  }

  /**
   * Create a new link definition between campaigns in a sequence
   */
  async createLink(sequenceId: string, input: SequenceLinkInput): Promise<SequenceLinkRecord> {
    await this.ensureSequenceOwnership(sequenceId)
    await this.ensureCampaignOwnership(input.nextCampaignId)

    if (input.parentCampaignId) {
      await this.ensureCampaignOwnership(input.parentCampaignId)
    }

    await this.assertCampaignInSequence(input.nextCampaignId, sequenceId)
    if (input.parentCampaignId) {
      await this.assertCampaignInSequence(input.parentCampaignId, sequenceId)
    }

    const payload: SequenceLinkInsert = {
      sequence_id: sequenceId,
      parent_campaign_id: input.parentCampaignId ?? null,
      next_campaign_id: input.nextCampaignId,
      delay_days: input.delayDays ?? 3,
      delay_hours: input.delayHours ?? 0,
      condition_type: input.conditionType ?? 'no_reply',
      min_opens: input.minOpens ?? 0,
      min_clicks: input.minClicks ?? 0,
      engagement_required: input.engagementRequired ?? false,
      filter_auto_reply: input.filterAutoReply ?? true,
      filter_bounced: input.filterBounced ?? true,
      filter_unsubscribed: input.filterUnsubscribed ?? true,
      persona_override_id: input.personaOverrideId ?? null,
      delivery_window: input.deliveryWindow ?? null,
      metadata: input.metadata ?? {},
    }

    const { data, error } = await this.supabase
      .from('sequence_links')
      .insert(payload)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create sequence link: ${error?.message || 'Unknown error'}`)
    }

    return data
  }

  /**
   * Update an existing link between campaigns
   */
  async updateLink(linkId: string, updates: SequenceLinkInput): Promise<SequenceLinkRecord> {
    const existing = await this.getLink(linkId)
    if (!existing) {
      throw new Error('Sequence link not found')
    }

    await this.ensureSequenceOwnership(existing.sequence_id)

    const payload: SequenceLinkUpdate = {}

    if (updates.parentCampaignId !== undefined) {
      if (updates.parentCampaignId) {
        await this.ensureCampaignOwnership(updates.parentCampaignId)
        await this.assertCampaignInSequence(updates.parentCampaignId, existing.sequence_id)
      }
      payload.parent_campaign_id = updates.parentCampaignId ?? null
    }

    if (updates.nextCampaignId) {
      await this.ensureCampaignOwnership(updates.nextCampaignId)
      await this.assertCampaignInSequence(updates.nextCampaignId, existing.sequence_id)
      payload.next_campaign_id = updates.nextCampaignId
    }

    if (updates.delayDays !== undefined) payload.delay_days = updates.delayDays
    if (updates.delayHours !== undefined) payload.delay_hours = updates.delayHours
    if (updates.conditionType) payload.condition_type = updates.conditionType
    if (updates.minOpens !== undefined) payload.min_opens = updates.minOpens
    if (updates.minClicks !== undefined) payload.min_clicks = updates.minClicks
    if (updates.engagementRequired !== undefined) payload.engagement_required = updates.engagementRequired
    if (updates.filterAutoReply !== undefined) payload.filter_auto_reply = updates.filterAutoReply
    if (updates.filterBounced !== undefined) payload.filter_bounced = updates.filterBounced
    if (updates.filterUnsubscribed !== undefined) payload.filter_unsubscribed = updates.filterUnsubscribed
    if (updates.personaOverrideId !== undefined) payload.persona_override_id = updates.personaOverrideId ?? null
    if (updates.deliveryWindow !== undefined) payload.delivery_window = updates.deliveryWindow ?? null
    if (updates.metadata !== undefined) payload.metadata = updates.metadata ?? {}

    const { data, error } = await this.supabase
      .from('sequence_links')
      .update(payload)
      .eq('id', linkId)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to update sequence link: ${error?.message || 'Unknown error'}`)
    }

    return data
  }

  /**
   * Remove a link definition
   */
  async deleteLink(linkId: string): Promise<void> {
    const link = await this.getLink(linkId)
    if (!link) return

    await this.ensureSequenceOwnership(link.sequence_id)

    const { error } = await this.supabase
      .from('sequence_links')
      .delete()
      .eq('id', linkId)

    if (error) {
      throw new Error(`Failed to delete sequence link: ${error.message}`)
    }
  }

  /**
   * Set or clear the entry campaign for a sequence
   */
  async setEntryCampaign(sequenceId: string, campaignId: string | null): Promise<SequenceRecord> {
    await this.ensureSequenceOwnership(sequenceId)

    if (campaignId) {
      await this.ensureCampaignOwnership(campaignId)
      await this.assertCampaignInSequence(campaignId, sequenceId)
    }

    return this.updateSequence(sequenceId, { entryCampaignId: campaignId })
  }

  private async ensureSequenceOwnership(sequenceId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('sequences')
      .select('id')
      .eq('id', sequenceId)
      .eq('user_id', this.userId)
      .single()

    if (error || !data) {
      throw new Error('Sequence not found or access denied')
    }
  }

  private async ensureCampaignOwnership(campaignId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', this.userId)
      .single()

    if (error || !data) {
      throw new Error('Campaign not found or access denied')
    }
  }

  private async assertCampaignInSequence(campaignId: string, sequenceId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select('sequence_id')
      .eq('id', campaignId)
      .single()

    if (error || !data) {
      throw new Error('Campaign lookup failed while validating sequence membership')
    }

    if (data.sequence_id !== sequenceId) {
      throw new Error('Campaign is not assigned to the target sequence')
    }
  }

  private async getLink(linkId: string): Promise<SequenceLinkRecord | null> {
    const { data, error } = await this.supabase
      .from('sequence_links')
      .select('*')
      .eq('id', linkId)
      .single()

    if (error) {
      return null
    }

    return data
  }
}
