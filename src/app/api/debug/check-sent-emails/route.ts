import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check outgoing_emails table
    const { data: outgoingEmails, error: outgoingError } = await supabase
      .from('outgoing_emails')
      .select(`
        id,
        subject,
        to_address,
        from_address,
        date_sent,
        created_at,
        email_account_id,
        archived_at,
        email_accounts!left (
          id,
          email,
          provider
        )
      `)
      .eq('user_id', user.id)
      .order('date_sent', { ascending: false })
      .limit(10)

    // Check email_sends table  
    const { data: campaignEmails, error: campaignError } = await supabase
      .from('email_sends')
      .select(`
        id,
        subject,
        sent_at,
        created_at,
        email_account_id,
        send_status
      `)
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false, nullsLast: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      user_id: user.id,
      outgoing_emails: {
        count: outgoingEmails?.length || 0,
        data: outgoingEmails,
        error: outgoingError?.message
      },
      campaign_emails: {
        count: campaignEmails?.length || 0,
        data: campaignEmails,
        error: campaignError?.message
      }
    })
  } catch (error) {
    console.error('Debug check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}