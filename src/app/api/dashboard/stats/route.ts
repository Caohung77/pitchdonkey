import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get user's email accounts
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)

    if (accountsError) {
      console.error('Error fetching email accounts:', accountsError)
      return handleApiError(accountsError)
    }

    const accountIds = emailAccounts?.map(acc => acc.id) || []

    // Get email tracking stats
    const { data: emailStats, error: emailError } = await supabase
      .from('email_tracking')
      .select('sent_at, opened_at, clicked_at, replied_at')
      .in('user_id', [user.id])

    if (emailError) {
      console.error('Error fetching email stats:', emailError)
    }

    // Get contacts count
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
    }

    // Get campaigns stats
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('user_id', user.id)

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
    }

    // Calculate stats
    const emailsTotal = emailStats?.length || 0
    const emailsSent = emailStats?.filter(e => e.sent_at !== null).length || 0
    const emailsDelivered = emailsSent // Assume sent emails are delivered
    const emailsOpened = emailStats?.filter(e => e.opened_at).length || 0
    const emailsClicked = emailStats?.filter(e => e.clicked_at).length || 0
    const emailsReplied = emailStats?.filter(e => e.replied_at).length || 0

    const contactsTotal = contacts?.length || 0
    const campaignsActive = campaigns?.filter(c => c.status === 'active').length || 0
    const campaignsCompleted = campaigns?.filter(c => c.status === 'completed').length || 0

    // Calculate rates
    const deliveryRate = emailsSent > 0 ? Math.round((emailsDelivered / emailsSent) * 100) : 0
    const openRate = emailsDelivered > 0 ? Math.round((emailsOpened / emailsDelivered) * 100) : 0
    const clickRate = emailsOpened > 0 ? Math.round((emailsClicked / emailsOpened) * 100) : 0
    const replyRate = emailsDelivered > 0 ? Math.round((emailsReplied / emailsDelivered) * 100) : 0

    const stats = {
      emailsSent,
      emailsDelivered,
      emailsOpened,
      emailsClicked,
      emailsReplied,
      contactsTotal,
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