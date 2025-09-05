import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

// GET /api/debug/campaign-contact-counts - Debug campaign contact counting
export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    // Get the first few completed campaigns for this user
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        total_contacts,
        contact_list_ids
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .limit(3)

    const debug = []

    for (const campaign of campaigns || []) {
      // Method 1: Current contact lists count
      let currentListCount = 0
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
          currentListCount = [...new Set(allContactIds)].length
        }
      }

      // Method 2: Email tracking records count
      const { count: trackingCount } = await supabase
        .from('email_tracking')
        .select('contact_id', { count: 'exact' })
        .eq('campaign_id', campaign.id)

      // Method 3: Stored total_contacts
      const storedCount = campaign.total_contacts

      debug.push({
        campaign_name: campaign.name,
        campaign_status: campaign.status,
        current_contact_lists_count: currentListCount,
        email_tracking_count: trackingCount,
        stored_total_contacts: storedCount,
        which_should_be_used: 'tracking_count for completed campaigns',
        issue: currentListCount !== trackingCount ? 'Contact was likely deleted from list' : 'No issue detected'
      })
    }

    return NextResponse.json({
      success: true,
      debug_data: debug
    })

  } catch (error) {
    console.error('Error debugging contact counts:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
})