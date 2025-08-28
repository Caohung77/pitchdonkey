import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get campaign ID from query parameter or use default
    const url = new URL(request.url)
    const campaignId = url.searchParams.get('id') || "1395ec60-a1e0-47c6-bc18-03d0f1ceb44f"
    
    console.log(`🔍 Getting details for campaign: ${campaignId}`)
    
    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    // Get email tracking records
    const { data: emailTracking } = await supabase
      .from('email_tracking')
      .select('*')
      .eq('campaign_id', campaignId)
    
    // Get contact list info
    const contactListIds = campaign.contact_list_ids || []
    let contactInfo = null
    if (contactListIds.length > 0) {
      const { data: contactLists } = await supabase
        .from('contact_lists')
        .select('*')
        .in('id', contactListIds)
      contactInfo = contactLists
    }
    
    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        total_contacts: campaign.total_contacts,
        emails_sent: campaign.emails_sent,
        contact_list_ids: campaign.contact_list_ids,
        created_at: campaign.created_at,
        description: campaign.description
      },
      emailTracking: {
        count: emailTracking?.length || 0,
        records: emailTracking || []
      },
      contactLists: contactInfo,
      analysis: {
        trackingBasedSentCount: emailTracking?.filter(e => e.sent_at !== null).length || 0,
        campaignFieldSentCount: campaign.emails_sent || 0,
        totalContactsField: campaign.total_contacts || 0
      }
    })
    
  } catch (error) {
    console.error('💥 Details error:', error)
    return NextResponse.json({
      success: false,
      error: 'Details failed',
      details: error.message
    }, { status: 500 })
  }
}