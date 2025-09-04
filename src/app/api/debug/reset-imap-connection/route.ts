import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/debug/reset-imap-connection - Reset IMAP connection error state
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { emailAccountId } = body || {}
    
    let query = supabase
      .from('imap_connections')
      .update({
        status: 'active',
        next_sync_at: new Date().toISOString(), // Allow immediate retry
        consecutive_failures: 0,
        last_error: null,
        last_successful_connection: null
      })
    
    if (emailAccountId) {
      query = query.eq('email_account_id', emailAccountId)
    } else {
      // Default to hung@theaiwhisperer.de account
      const { data: account } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('email', 'hung@theaiwhisperer.de')
        .single()
        
      if (account) {
        query = query.eq('email_account_id', account.id)
      }
    }
    
    const { data, error } = await query.select()

    if (error) {
      console.error('❌ Error resetting IMAP connection:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    console.log('✅ Reset IMAP connection status to active for retry')

    return NextResponse.json({
      success: true,
      message: 'IMAP connection reset successfully',
      data: data
    })

  } catch (error) {
    console.error('❌ Error in reset IMAP connection:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}