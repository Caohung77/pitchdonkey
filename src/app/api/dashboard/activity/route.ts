import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get recent activities from various sources
    const activities: any[] = []

    // Get recent enrichment jobs
    const { data: enrichmentJobs, error: jobsError } = await supabase
      .from('bulk_enrichment_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!jobsError && enrichmentJobs) {
      enrichmentJobs.forEach(job => {
        if (job.status === 'running') {
          activities.push({
            id: `enrichment-progress-${job.id}`,
            type: 'enrichment_progress',
            title: 'Contact Enrichment',
            description: `Processing ${job.progress?.completed || 0}/${job.progress?.total || 0} contacts`,
            timestamp: job.started_at || job.created_at,
            status: 'info',
            metadata: {
              job_id: job.id,
              progress: job.progress,
              total_contacts: job.progress?.total || 0
            }
          })
        } else if (job.status === 'completed') {
          const successful = job.results?.filter((r: any) => r.scrape_status === 'completed').length || 0
          const failed = job.results?.filter((r: any) => r.scrape_status === 'failed').length || 0

          activities.push({
            id: `enrichment-completed-${job.id}`,
            type: 'enrichment_completed',
            title: 'Enrichment Completed',
            description: `${successful} contacts enriched successfully${failed > 0 ? `, ${failed} failed` : ''}`,
            timestamp: job.completed_at || job.updated_at,
            status: 'success',
            metadata: {
              job_id: job.id,
              successful,
              failed,
              total: successful + failed
            }
          })
        } else if (job.status === 'failed') {
          activities.push({
            id: `enrichment-failed-${job.id}`,
            type: 'enrichment_failed',
            title: 'Enrichment Failed',
            description: 'Contact enrichment job failed to complete',
            timestamp: job.updated_at,
            status: 'error',
            metadata: {
              job_id: job.id
            }
          })
        }
      })
    }

    // Get recent campaigns
    const { data: recentCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!campaignsError && recentCampaigns) {
      recentCampaigns.forEach(campaign => {
        activities.push({
          id: `campaign-${campaign.id}`,
          type: 'campaign_started',
          title: 'Campaign Started',
          description: `Campaign "${campaign.name}" was ${campaign.status === 'active' ? 'started' : 'created'}`,
          timestamp: campaign.created_at,
          status: campaign.status === 'active' ? 'success' : 'warning'
        })
      })
    }

    // Get recent email accounts
    const { data: recentAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id, email, created_at, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)

    if (!accountsError && recentAccounts) {
      recentAccounts.forEach(account => {
        activities.push({
          id: `account-${account.id}`,
          type: 'account_connected',
          title: 'Email Account Connected',
          description: `Connected ${account.email}`,
          timestamp: account.created_at,
          status: account.is_active ? 'success' : 'warning'
        })
      })
    }

    // Get recent contacts
    const { data: recentContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, email, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!contactsError && recentContacts) {
      recentContacts.forEach(contact => {
        activities.push({
          id: `contact-${contact.id}`,
          type: 'contact_added',
          title: 'Contact Added',
          description: `Added ${contact.email}`,
          timestamp: contact.created_at,
          status: 'success'
        })
      })
    }

    // Get recent email tracking (sent emails)
    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)

    if (emailAccounts && emailAccounts.length > 0) {
      const accountIds = emailAccounts.map(acc => acc.id)
      
      const { data: recentEmails, error: emailsError } = await supabase
        .from('email_tracking')
        .select('id, recipient_email, sent_at, status, replied_at')
        .in('email_account_id', accountIds)
        .order('sent_at', { ascending: false })
        .limit(10)

      if (!emailsError && recentEmails) {
        recentEmails.forEach(email => {
          if (email.replied_at) {
            activities.push({
              id: `reply-${email.id}`,
              type: 'reply_received',
              title: 'Reply Received',
              description: `Reply from ${email.recipient_email}`,
              timestamp: email.replied_at,
              status: 'success'
            })
          } else if (email.sent_at) {
            activities.push({
              id: `email-${email.id}`,
              type: 'email_sent',
              title: 'Email Sent',
              description: `Email sent to ${email.recipient_email}`,
              timestamp: email.sent_at,
              status: email.status === 'delivered' ? 'success' : 
                      email.status === 'bounced' ? 'error' : 'warning'
            })
          }
        })
      }
    }

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Return top 20 most recent activities
    const recentActivity = activities.slice(0, 20)

    return createSuccessResponse(recentActivity)

  } catch (error) {
    return handleApiError(error)
  }
})