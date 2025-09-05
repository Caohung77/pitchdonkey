import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/debug/campaign-stats - Debug campaign completion percentages
export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    
    // Get all user's campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        total_contacts,
        emails_sent,
        contact_list_ids
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    const debugInfo = []
    
    for (const campaign of campaigns || []) {
      // Get detailed email tracking stats
      const { data: emailStats } = await supabase
        .from('email_tracking')
        .select('status, sent_at, delivered_at, contact_id')
        .eq('campaign_id', campaign.id)

      // Get actual contact count from contact lists
      let realContactCount = 0
      if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
        const { data: contactLists } = await supabase
          .from('contact_lists')
          .select('contact_ids')
          .in('id', campaign.contact_list_ids)
        
        if (contactLists) {
          const allContactIds = []
          contactLists.forEach(list => {
            if (list.contact_ids && Array.isArray(list.contact_ids)) {
              allContactIds.push(...list.contact_ids)
            }
          })
          realContactCount = [...new Set(allContactIds)].length
        }
      }

      // Count actual sent emails
      const actualEmailsSent = emailStats?.filter(e => !!e.sent_at).length || 0
      
      // Calculate what the percentage should be
      const storedContactCount = campaign.total_contacts || 0
      const storedEmailsSent = campaign.emails_sent || 0
      
      const calculatedPercentage = realContactCount > 0 ? Math.round((actualEmailsSent / realContactCount) * 100) : 0
      const storedPercentage = storedContactCount > 0 ? Math.round((storedEmailsSent / storedContactCount) * 100) : 0
      
      debugInfo.push({
        campaign_name: campaign.name,
        campaign_status: campaign.status,
        campaign_id: campaign.id,
        stored_total_contacts: storedContactCount,
        stored_emails_sent: storedEmailsSent,
        stored_percentage: storedPercentage,
        real_contact_count: realContactCount,
        actual_emails_sent: actualEmailsSent,
        correct_percentage: calculatedPercentage,
        contact_list_ids: campaign.contact_list_ids,
        email_tracking_records: emailStats?.length || 0,
        issue_detected: storedPercentage !== calculatedPercentage || storedContactCount !== realContactCount
      })
    }

    return NextResponse.json({
      success: true,
      debug_info: debugInfo,
      summary: {
        total_campaigns_checked: campaigns?.length || 0,
        campaigns_with_issues: debugInfo.filter(c => c.issue_detected).length
      }
    })

  } catch (error) {
    console.error('Error debugging campaign stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})