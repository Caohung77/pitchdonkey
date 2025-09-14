import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()
    
    // Get email accounts to check current schema and data
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch email accounts',
        details: error.message
      }, { status: 500 })
    }

    // Check what columns exist
    const sampleAccount = accounts?.[0]
    const availableColumns = sampleAccount ? Object.keys(sampleAccount) : []

    return NextResponse.json({
      success: true,
      accountCount: accounts?.length || 0,
      availableColumns,
      sampleAccount: sampleAccount || null,
      hasVerificationColumns: {
        spf_verified: availableColumns.includes('spf_verified'),
        dkim_verified: availableColumns.includes('dkim_verified'), 
        dmarc_verified: availableColumns.includes('dmarc_verified'),
        domain_verified_at: availableColumns.includes('domain_verified_at')
      }
    })

  } catch (error) {
    console.error('Error checking email accounts:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
})