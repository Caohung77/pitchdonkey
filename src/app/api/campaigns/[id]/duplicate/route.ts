import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const POST = withAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = params
    const supabase = createServerSupabaseClient()

    // Get the original campaign
    const { data: originalCampaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !originalCampaign) {
      return handleApiError(new Error('Campaign not found'))
    }

    // Create duplicate campaign with modified name
    const duplicateName = `${originalCampaign.name} (Copy)`
    
    const { data: duplicateCampaign, error: duplicateError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name: duplicateName,
        description: originalCampaign.description,
        status: 'draft', // Always start as draft
        daily_send_limit: originalCampaign.daily_send_limit,
        track_opens: originalCampaign.track_opens,
        track_clicks: originalCampaign.track_clicks,
        track_replies: originalCampaign.track_replies,
        ab_test_enabled: originalCampaign.ab_test_enabled,
        ab_test_config: originalCampaign.ab_test_config,
        // Reset all stats to 0
        total_contacts: 0,
        emails_sent: 0,
        emails_delivered: 0,
        emails_opened: 0,
        emails_clicked: 0,
        emails_replied: 0,
        emails_bounced: 0,
        emails_complained: 0
      })
      .select()
      .single()

    if (duplicateError) {
      console.error('Error duplicating campaign:', duplicateError)
      return handleApiError(new Error('Failed to duplicate campaign'))
    }

    // Copy campaign sequences if they exist
    const { data: originalSequences, error: sequencesError } = await supabase
      .from('campaign_sequences')
      .select('*')
      .eq('campaign_id', id)
      .order('step_number')

    if (!sequencesError && originalSequences && originalSequences.length > 0) {
      const duplicateSequences = originalSequences.map(sequence => ({
        campaign_id: duplicateCampaign.id,
        step_number: sequence.step_number,
        email_template_id: sequence.email_template_id,
        subject_line: sequence.subject_line,
        email_body: sequence.email_body,
        delay_days: sequence.delay_days,
        delay_hours: sequence.delay_hours,
        conditions: sequence.conditions,
        is_active: sequence.is_active
      }))

      await supabase
        .from('campaign_sequences')
        .insert(duplicateSequences)
    }

    // Return the duplicated campaign with stats format expected by frontend
    const campaignWithStats = {
      id: duplicateCampaign.id,
      name: duplicateCampaign.name,
      description: duplicateCampaign.description || '',
      status: duplicateCampaign.status,
      contactCount: 0,
      emailsSent: 0,
      openRate: 0,
      replyRate: 0,
      createdAt: duplicateCampaign.created_at,
      launchedAt: null,
      completedAt: null,
      nextSendAt: null
    }

    return createSuccessResponse(campaignWithStats)

  } catch (error) {
    return handleApiError(error)
  }
})