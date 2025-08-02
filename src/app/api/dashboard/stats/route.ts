import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get current period (this month)
    const currentDate = new Date()
    const currentPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

    // Get usage metrics for current period
    const { data: usage, error: usageError } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('period', currentPeriod)
      .single()

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('Error fetching usage metrics:', usageError)
    }

    // Get email tracking stats for the current month
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const { data: emailStats, error: emailError } = await supabase
      .from('email_tracking')
      .select('status, sent_at, delivered_at, opened_at, clicked_at, replied_at')
      .eq('user_id', user.id)
      .gte('sent_at', startOfMonth.toISOString())

    if (emailError) {
      console.error('Error fetching email stats:', emailError)
    }

    // Get campaign stats
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('user_id', user.id)

    if (campaignError) {
      console.error('Error fetching campaign stats:', campaignError)
    }

    // Calculate stats
    const emailsSent = usage?.emails_sent || 0
    const emailsDelivered = emailStats?.filter(e => e.delivered_at).length || 0
    const emailsOpened = emailStats?.filter(e => e.opened_at).length || 0
    const emailsClicked = emailStats?.filter(e => e.clicked_at).length || 0
    const emailsReplied = emailStats?.filter(e => e.replied_at).length || 0

    const deliveryRate = emailsSent > 0 ? Math.round((emailsDelivered / emailsSent) * 100) : 0
    const openRate = emailsDelivered > 0 ? Math.round((emailsOpened / emailsDelivered) * 100) : 0
    const clickRate = emailsOpened > 0 ? Math.round((emailsClicked / emailsOpened) * 100) : 0
    const replyRate = emailsDelivered > 0 ? Math.round((emailsReplied / emailsDelivered) * 100) : 0

    const campaignsActive = campaigns?.filter(c => c.status === 'active').length || 0
    const campaignsCompleted = campaigns?.filter(c => c.status === 'completed').length || 0

    const stats = {
      emailsSent,
      emailsDelivered,
      emailsOpened,
      emailsClicked,
      emailsReplied,
      contactsTotal: usage?.contacts_count || 0,
      campaignsActive,
      campaignsCompleted,
      deliveryRate,
      openRate,
      clickRate,
      replyRate
    }

    return createSuccessResponse(stats)

  } catch (error) {
    return handleApiError(error)
  }
})