import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'

// GET /api/contacts/[id]/campaigns - Campaigns for a contact with simple stats
export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const resolvedParams = await params
    const contactId = resolvedParams?.id as string
    if (!contactId) {
      return NextResponse.json({ success: false, error: 'Missing contact id' }, { status: 400 })
    }

    // Extract pagination parameters
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '5')
    const offset = (page - 1) * limit

    // Fetch campaigns linked to the contact with pagination
    // We'll fetch limit + 1 to determine if there are more pages
    const { data: cc, error: ccErr } = await supabase
      .from('campaign_contacts')
      .select(`
        id,
        campaign_id,
        status,
        current_sequence,
        created_at,
        updated_at,
        campaigns!inner (
          id,
          name,
          status,
          created_at
        )
      `)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit)

    // Check if we have more items than limit (indicates more pages)
    const hasMoreItems = (cc?.length || 0) > limit
    const actualCampaigns = hasMoreItems ? cc?.slice(0, limit) : cc

    if (ccErr) {
      console.error('Campaign contacts query error:', ccErr)
      return NextResponse.json({ success: false, error: ccErr.message }, { status: 500 })
    }

    console.log(`Found ${actualCampaigns?.length || 0} campaign_contacts records for contact ${contactId}`)

    const campaigns = (actualCampaigns || []).map((row: any) => ({
      id: row.campaigns?.id,
      name: row.campaigns?.name,
      status: row.campaigns?.status,
      contact_status: row.status,
      current_step: row.current_sequence || 0,
      emails_sent: 0, // Will be calculated from email_sends
      emails_opened: 0, // Will be calculated from email_sends
      emails_clicked: 0, // Will be calculated from email_sends
      emails_replied: 0, // Will be calculated from email_sends
      joined_at: row.created_at
    }))

    // Collect activity and statistics from email_sends for this contact across these campaigns
    const campaignIds = campaigns.map(c => c.id).filter(Boolean)
    let lastActivity: Record<string, { 
      last_sent_at?: string; 
      last_open_at?: string; 
      last_reply_at?: string; 
      last_click_at?: string;
      emails_sent: number;
      emails_opened: number;
      emails_clicked: number;
      emails_replied: number;
    }> = {}

    // Initialize stats for each campaign
    for (const campaign of campaigns) {
      if (campaign.id) {
        lastActivity[campaign.id] = {
          emails_sent: 0,
          emails_opened: 0,
          emails_clicked: 0,
          emails_replied: 0,
        }
      }
    }

    if (campaignIds.length > 0) {
      const { data: sends } = await supabase
        .from('email_sends')
        .select('campaign_id, sent_at, opened_at, clicked_at, replied_at')
        .eq('contact_id', contactId)
        .in('campaign_id', campaignIds)

      for (const s of sends || []) {
        const k = s.campaign_id as string
        const entry = lastActivity[k] || { emails_sent: 0, emails_opened: 0, emails_clicked: 0, emails_replied: 0 }
        
        // Count statistics
        if (s.sent_at) {
          entry.emails_sent = (entry.emails_sent || 0) + 1
          if (!entry.last_sent_at || s.sent_at > entry.last_sent_at) {
            entry.last_sent_at = s.sent_at
          }
        }
        if (s.opened_at) {
          entry.emails_opened = (entry.emails_opened || 0) + 1
          if (!entry.last_open_at || s.opened_at > entry.last_open_at) {
            entry.last_open_at = s.opened_at
          }
        }
        if (s.clicked_at) {
          entry.emails_clicked = (entry.emails_clicked || 0) + 1
          if (!entry.last_click_at || s.clicked_at > entry.last_click_at) {
            entry.last_click_at = s.clicked_at
          }
        }
        if (s.replied_at) {
          entry.emails_replied = (entry.emails_replied || 0) + 1
          if (!entry.last_reply_at || s.replied_at > entry.last_reply_at) {
            entry.last_reply_at = s.replied_at
          }
        }
        
        lastActivity[k] = entry
      }
    }

    const enriched = campaigns.map(c => {
      const activity = lastActivity[c.id || ''] || { emails_sent: 0, emails_opened: 0, emails_clicked: 0, emails_replied: 0 }
      return {
        ...c,
        emails_sent: activity.emails_sent,
        emails_opened: activity.emails_opened,
        emails_clicked: activity.emails_clicked,
        emails_replied: activity.emails_replied,
        last_sent_at: activity.last_sent_at,
        last_open_at: activity.last_open_at,
        last_click_at: activity.last_click_at,
        last_reply_at: activity.last_reply_at,
      }
    })

    console.log(`Returning ${enriched.length} campaigns (page ${page}) for contact ${contactId}:`, enriched.map(c => ({ id: c.id, name: c.name })))

    // Calculate pagination metadata
    const hasNextPage = hasMoreItems
    const hasPrevPage = page > 1

    const res = NextResponse.json({ 
      success: true, 
      campaigns: enriched,
      pagination: {
        page,
        limit,
        hasNextPage,
        hasPrevPage
      }
    })
    return addSecurityHeaders(res)
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
})

