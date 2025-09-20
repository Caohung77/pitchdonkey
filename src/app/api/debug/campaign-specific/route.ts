import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Debug specific campaign by ID
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const campaignId = url.searchParams.get('id') || 'fb6282de-cf26-40e9-ac8d-65e327da04a3' // Default to "nice" campaign

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError) {
      return NextResponse.json({ error: campaignError.message }, { status: 500 })
    }

    // Get email tracking records
    const { data: emailTracking, error: trackingError } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (trackingError) {
      return NextResponse.json({ error: trackingError.message }, { status: 500 })
    }

    // Get contact list details
    let contactDetails = []
    if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
      const { data: contactLists } = await supabase
        .from('contact_lists')
        .select('id, name, contact_ids')
        .in('id', campaign.contact_list_ids)

      if (contactLists) {
        for (const list of contactLists) {
          if (list.contact_ids && Array.isArray(list.contact_ids)) {
            const { data: contacts } = await supabase
              .from('contacts')
              .select('id, email, first_name, last_name')
              .in('id', list.contact_ids)

            contactDetails.push({
              listId: list.id,
              listName: list.name,
              contacts: contacts || []
            })
          }
        }
      }
    }

    // Analyze the tracking data
    const trackingAnalysis = {
      total_records: emailTracking?.length || 0,
      by_status: {
        pending: emailTracking?.filter(t => t.status === 'pending').length || 0,
        delivered: emailTracking?.filter(t => t.status === 'delivered').length || 0,
        failed: emailTracking?.filter(t => t.status === 'failed').length || 0,
        bounced: emailTracking?.filter(t => t.bounced_at !== null).length || 0
      },
      sent_emails: emailTracking?.filter(t => t.sent_at !== null).length || 0,
      timeline: emailTracking?.map(t => ({
        id: t.id,
        contact_id: t.contact_id,
        status: t.status,
        sent_at: t.sent_at,
        delivered_at: t.delivered_at,
        bounced_at: t.bounced_at,
        bounce_reason: t.bounce_reason,
        created_at: t.created_at
      })) || []
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      campaign,
      email_tracking: trackingAnalysis,
      contact_details: contactDetails,
      diagnosis: {
        campaign_says_sent: campaign.emails_sent || 0,
        tracking_says_sent: trackingAnalysis.sent_emails,
        mismatch: (campaign.emails_sent || 0) !== trackingAnalysis.sent_emails,
        all_bounced: trackingAnalysis.by_status.bounced === trackingAnalysis.total_records,
        ready_for_completion: trackingAnalysis.sent_emails >= (campaign.total_contacts || 0)
      }
    })

  } catch (error) {
    console.error('Campaign specific debug error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}