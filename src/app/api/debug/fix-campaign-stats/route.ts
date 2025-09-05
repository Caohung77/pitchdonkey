import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/debug/fix-campaign-stats - Fix campaign completion percentages
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

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    const fixResults = []
    
    for (const campaign of campaigns || []) {
      let shouldUpdate = false
      let newTotalContacts = campaign.total_contacts
      let newEmailsSent = campaign.emails_sent

      // Get real contact count
      let realContactCount = 0
      if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
        const { data: contactLists } = await supabase
          .from('contact_lists')
          .select('contact_ids')
          .in('id', campaign.contact_list_ids)
        
        if (contactLists && contactLists.length > 0) {
          const allContactIds = []
          contactLists.forEach(list => {
            if (list.contact_ids && Array.isArray(list.contact_ids)) {
              allContactIds.push(...list.contact_ids)
            }
          })
          realContactCount = [...new Set(allContactIds)].length
        }
      }

      // Get real email count from tracking
      const { data: emailStats } = await supabase
        .from('email_tracking')
        .select('sent_at')
        .eq('campaign_id', campaign.id)

      const realEmailsSent = emailStats?.filter(e => !!e.sent_at).length || 0

      // Check if we need to update
      if (realContactCount > 0 && realContactCount !== campaign.total_contacts) {
        newTotalContacts = realContactCount
        shouldUpdate = true
      }
      
      if (realEmailsSent !== campaign.emails_sent) {
        newEmailsSent = realEmailsSent
        shouldUpdate = true
      }

      // Update if needed
      if (shouldUpdate) {
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            total_contacts: newTotalContacts,
            emails_sent: newEmailsSent
          })
          .eq('id', campaign.id)

        if (updateError) {
          console.error(`Error updating campaign ${campaign.id}:`, updateError)
        }
      }

      const oldPercentage = campaign.total_contacts > 0 ? Math.round((campaign.emails_sent / campaign.total_contacts) * 100) : 0
      const newPercentage = newTotalContacts > 0 ? Math.round((newEmailsSent / newTotalContacts) * 100) : 0

      fixResults.push({
        campaign_name: campaign.name,
        campaign_id: campaign.id,
        old_stats: {
          total_contacts: campaign.total_contacts,
          emails_sent: campaign.emails_sent,
          percentage: oldPercentage
        },
        new_stats: {
          total_contacts: newTotalContacts,
          emails_sent: newEmailsSent,
          percentage: newPercentage
        },
        updated: shouldUpdate,
        real_data: {
          contact_count_from_lists: realContactCount,
          emails_sent_from_tracking: realEmailsSent
        }
      })
    }

    return NextResponse.json({
      success: true,
      fix_results: fixResults,
      summary: {
        total_campaigns_checked: campaigns?.length || 0,
        campaigns_updated: fixResults.filter(r => r.updated).length,
        campaigns_with_issues: fixResults.filter(r => r.old_stats.percentage !== r.new_stats.percentage).length
      }
    })

  } catch (error) {
    console.error('Error fixing campaign stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})