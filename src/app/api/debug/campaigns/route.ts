import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Debug endpoint to check campaign status without authentication
 * Helps diagnose campaign processing issues
 */
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'Server configuration error'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get campaigns that might need processing
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_date, total_contacts, emails_sent, contact_list_ids, user_id, created_at')
      .in('status', ['sending', 'scheduled', 'active'])
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      return NextResponse.json({
        error: 'Database error',
        details: error.message
      }, { status: 500 })
    }
    
    // For each campaign, get some diagnostic info
    const campaignDiagnostics = await Promise.all((campaigns || []).map(async (campaign) => {
      // Check email accounts
      const { data: emailAccounts } = await supabase
        .from('email_accounts')
        .select('id, email, provider, status')
        .eq('user_id', campaign.user_id)
        .eq('status', 'active')
      
      // Check contacts
      let contactCount = 0
      if (campaign.contact_list_ids && campaign.contact_list_ids.length > 0) {
        const { data: contactLists } = await supabase
          .from('contact_lists')
          .select('contact_ids')
          .in('id', campaign.contact_list_ids)
        
        contactLists?.forEach(list => {
          if (list.contact_ids && Array.isArray(list.contact_ids)) {
            contactCount += list.contact_ids.length
          }
        })
      }
      
      // Check email tracking
      const { data: emailTracking } = await supabase
        .from('email_tracking')
        .select('sent_at, bounced_at')
        .eq('campaign_id', campaign.id)
      
      const sentEmails = emailTracking?.filter(e => e.sent_at).length || 0
      const bouncedEmails = emailTracking?.filter(e => e.bounced_at).length || 0
      
      return {
        ...campaign,
        contactCount,
        actualSentEmails: sentEmails,
        bouncedEmails,
        emailAccountsCount: emailAccounts?.length || 0,
        emailAccounts: emailAccounts?.map(acc => ({
          email: acc.email,
          provider: acc.provider,
          status: acc.status
        }))
      }
    }))
    
    return NextResponse.json({
      success: true,
      campaignsFound: campaigns?.length || 0,
      campaigns: campaignDiagnostics,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Debug endpoint error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}