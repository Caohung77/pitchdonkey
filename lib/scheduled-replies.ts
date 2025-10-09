import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type Supabase = SupabaseClient<Database>

// Reply job status type
export type ReplyJobStatus =
  | 'scheduled'
  | 'needs_approval'
  | 'approved'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'

// Scheduled reply with all related data
export interface ScheduledReply {
  id: string
  user_id: string
  agent_id: string
  email_account_id: string
  contact_id: string | null
  incoming_email_id: string
  thread_id: string
  message_ref: string | null
  draft_subject: string
  draft_body: string
  rationale: string | null
  risk_score: number
  risk_flags: string[]
  confidence_score: number
  scheduled_at: string
  editable_until: string
  status: ReplyJobStatus
  sent_at: string | null
  error_message: string | null
  retry_count: number
  created_at: string
  updated_at: string
  audit_log: any[]

  // Related data
  agent?: {
    id: string
    name: string
    status: string
    language: string
    tone: string
  }
  email_account?: {
    id: string
    email: string
    provider: string
  }
  contact?: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
  }
  incoming_email?: {
    id: string
    subject: string
    from_address: string
    date_received: string
  }
}

// Filters for scheduled replies list
export interface ScheduledReplyFilters {
  status?: ReplyJobStatus[]
  agent_id?: string
  email_account_id?: string
  date_from?: string
  date_to?: string
  search?: string
}

// Statistics for scheduled replies
export interface ScheduledReplyStats {
  total: number
  by_status: Record<ReplyJobStatus, number>
  needs_approval: number
  upcoming_24h: number
  high_risk: number
  avg_risk_score: number
}

/**
 * Get scheduled replies with filters
 */
export async function getScheduledReplies(
  supabase: Supabase,
  userId: string,
  filters?: ScheduledReplyFilters,
  limit: number = 50
): Promise<ScheduledReply[]> {
  let query = supabase
    .from('reply_jobs')
    .select(`
      *,
      agent:outreach_agents!reply_jobs_agent_id_fkey(
        id,
        name,
        status,
        language,
        tone
      ),
      email_account:email_accounts!reply_jobs_email_account_id_fkey(
        id,
        email,
        provider
      ),
      contact:contacts(
        id,
        email,
        first_name,
        last_name
      ),
      incoming_email:incoming_emails(
        id,
        subject,
        from_address,
        date_received
      )
    `)
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  // Apply filters
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }
  if (filters?.agent_id) {
    query = query.eq('agent_id', filters.agent_id)
  }
  if (filters?.email_account_id) {
    query = query.eq('email_account_id', filters.email_account_id)
  }
  if (filters?.date_from) {
    query = query.gte('scheduled_at', filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte('scheduled_at', filters.date_to)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching scheduled replies:', error)
    throw error
  }

  return data as ScheduledReply[]
}

/**
 * Get statistics for scheduled replies
 */
export async function getScheduledReplyStats(
  supabase: Supabase,
  userId: string
): Promise<ScheduledReplyStats> {
  const { data, error } = await supabase
    .from('reply_jobs')
    .select('status, risk_score, scheduled_at')
    .eq('user_id', userId)
    .in('status', ['scheduled', 'needs_approval', 'approved', 'sending'])

  if (error) {
    console.error('Error fetching scheduled reply stats:', error)
    throw error
  }

  const now = new Date()
  const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const stats: ScheduledReplyStats = {
    total: data?.length || 0,
    by_status: {
      scheduled: 0,
      needs_approval: 0,
      approved: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
    },
    needs_approval: 0,
    upcoming_24h: 0,
    high_risk: 0,
    avg_risk_score: 0,
  }

  let totalRiskScore = 0

  data?.forEach((job) => {
    // Count by status
    stats.by_status[job.status as ReplyJobStatus] =
      (stats.by_status[job.status as ReplyJobStatus] || 0) + 1

    // Count needs approval
    if (job.status === 'needs_approval') {
      stats.needs_approval++
    }

    // Count upcoming in 24h
    const scheduledAt = new Date(job.scheduled_at)
    if (scheduledAt <= twentyFourHoursLater && scheduledAt >= now) {
      stats.upcoming_24h++
    }

    // Count high risk (≥0.6)
    if (job.risk_score >= 0.6) {
      stats.high_risk++
    }

    // Sum risk scores for average
    totalRiskScore += job.risk_score
  })

  stats.avg_risk_score = data && data.length > 0
    ? totalRiskScore / data.length
    : 0

  return stats
}

/**
 * Approve a reply job
 */
export async function approveReplyJob(
  supabase: Supabase,
  userId: string,
  replyJobId: string
): Promise<void> {
  const { error } = await supabase
    .from('reply_jobs')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
      audit_log: supabase.rpc('jsonb_array_append', {
        arr: supabase.raw('audit_log'),
        elem: JSON.stringify({
          action: 'manually_approved',
          timestamp: new Date().toISOString(),
        }),
      }),
    })
    .eq('id', replyJobId)
    .eq('user_id', userId)
    .eq('status', 'needs_approval')

  if (error) {
    console.error('Error approving reply job:', error)
    throw error
  }
}

/**
 * Cancel a reply job
 */
export async function cancelReplyJob(
  supabase: Supabase,
  userId: string,
  replyJobId: string
): Promise<void> {
  const { error } = await supabase
    .from('reply_jobs')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      audit_log: supabase.rpc('jsonb_array_append', {
        arr: supabase.raw('audit_log'),
        elem: JSON.stringify({
          action: 'manually_cancelled',
          timestamp: new Date().toISOString(),
        }),
      }),
    })
    .eq('id', replyJobId)
    .eq('user_id', userId)
    .in('status', ['scheduled', 'needs_approval', 'approved'])

  if (error) {
    console.error('Error cancelling reply job:', error)
    throw error
  }
}

/**
 * Update reply job content (subject and body)
 */
export async function updateReplyJobContent(
  supabase: Supabase,
  userId: string,
  replyJobId: string,
  draftSubject: string,
  draftBody: string,
  scheduledAt?: string
): Promise<void> {
  const now = new Date()

  // Check if job is still editable
  const { data: job, error: fetchError } = await supabase
    .from('reply_jobs')
    .select('editable_until, status, audit_log')
    .eq('id', replyJobId)
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    console.error('Error fetching reply job:', fetchError)
    throw fetchError
  }

  const editableUntil = new Date(job.editable_until)
  if (now > editableUntil) {
    throw new Error('Reply is no longer editable (editing window has expired)')
  }

  if (!['scheduled', 'needs_approval', 'approved'].includes(job.status)) {
    throw new Error(`Cannot edit reply in status: ${job.status}`)
  }

  const existingAudit = Array.isArray(job.audit_log) ? job.audit_log : []
  const newAudit = [
    ...existingAudit,
    {
      action: 'content_edited',
      timestamp: new Date().toISOString(),
    },
  ]

  const updatePayload: any = {
    draft_subject: draftSubject,
    draft_body: draftBody,
    updated_at: new Date().toISOString(),
    audit_log: newAudit,
  }

  if (scheduledAt) {
    updatePayload.scheduled_at = new Date(scheduledAt).toISOString()
  }

  const { error } = await supabase
    .from('reply_jobs')
    .update(updatePayload)
    .eq('id', replyJobId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating reply job content:', error)
    throw error
  }
}
