export type SequenceStatus = 'draft' | 'active' | 'paused'

export interface SequenceRecord {
  id: string
  user_id: string
  name: string
  description: string | null
  status: SequenceStatus
  entry_campaign_id: string | null
  created_at: string
  updated_at: string
}

export interface SequenceCampaignSummary {
  id: string
  name: string
  description?: string | null
  status: string | null
  sequence_id: string | null
  sequence_position: number | null
  created_at: string | null
  updated_at: string | null
  total_contacts?: number | null
  emails_sent?: number | null
  emails_opened?: number | null
  emails_clicked?: number | null
  emails_replied?: number | null
}

export type SequenceConditionType = 'no_reply' | 'opened_no_reply' | 'always' | 'custom'

export interface SequenceLinkRecord {
  id: string
  sequence_id: string
  parent_campaign_id: string | null
  next_campaign_id: string
  delay_days: number
  delay_hours: number
  condition_type: SequenceConditionType
  min_opens: number
  min_clicks: number
  engagement_required: boolean
  filter_auto_reply?: boolean
  filter_bounced?: boolean
  filter_unsubscribed?: boolean
  persona_override_id: string | null
  delivery_window: Record<string, any> | null
  metadata: Record<string, any>
  created_at: string | null
  updated_at: string | null
}

export interface SequenceWithRelations {
  sequence: SequenceRecord
  campaigns: SequenceCampaignSummary[]
  links: SequenceLinkRecord[]
}
