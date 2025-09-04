import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/debug/imap-status - Check IMAP connection status in database
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get all IMAP connections with details
    const { data: connections, error } = await supabase
      .from('imap_connections')
      .select(`
        *,
        email_accounts (
          id,
          user_id,
          email,
          provider,
          imap_host,
          imap_port,
          imap_username,
          imap_secure
        )
      `)
    
    if (error) {
      console.error('❌ Error fetching IMAP connections:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    // Also get email accounts without IMAP connections
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select(`
        id,
        email,
        provider,
        status,
        imap_host,
        imap_port,
        imap_username,
        imap_secure
      `)

    console.log('🔍 IMAP Connections Debug:')
    console.log('📧 Email Accounts:', emailAccounts?.length || 0)
    console.log('🔗 IMAP Connections:', connections?.length || 0)
    
    if (connections?.length) {
      connections.forEach((conn, i) => {
        console.log(`🔗 Connection ${i+1}:`)
        console.log(`   Status: ${conn.status}`)
        console.log(`   Email: ${conn.email_accounts?.email}`)
        console.log(`   Next Sync: ${conn.next_sync_at}`)
        console.log(`   Last Error: ${conn.last_error}`)
        console.log(`   Failures: ${conn.consecutive_failures}`)
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        imap_connections: connections || [],
        email_accounts: emailAccounts || [],
        summary: {
          total_email_accounts: emailAccounts?.length || 0,
          total_imap_connections: connections?.length || 0,
          active_connections: connections?.filter(c => c.status === 'active').length || 0,
          error_connections: connections?.filter(c => c.status === 'error').length || 0
        }
      }
    })

  } catch (error) {
    console.error('❌ Error in IMAP status debug:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}