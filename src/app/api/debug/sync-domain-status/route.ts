import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService } from '@/lib/domain-auth'

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('🔄 Syncing domain verification status for all email accounts...')
    
    const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()
    const service = new DomainAuthService()
    
    // Get all email accounts for this user
    const { data: emailAccounts, error } = await supabase
      .from('email_accounts')
      .select('id, email')
      .eq('user_id', user.id)
    
    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch email accounts',
        details: error.message
      }, { status: 500 })
    }
    
    let updated = 0
    const results = []
    
    for (const account of emailAccounts || []) {
      try {
        // Extract domain from email
        const domain = account.email.split('@')[1]?.toLowerCase()
        if (!domain) continue
        
        console.log(`📧 Checking domain verification for ${account.email} (${domain})`)
        
        // Get current domain verification status
        const status = await service.verifyDomain(user.id, domain)
        
        const spfVerified = !!status.spf?.success
        const dkimVerified = !!status.dkim?.success
        const dmarcVerified = !!status.dmarc?.success
        
        // Update email account with current verification status
        const { error: updateError } = await supabase
          .from('email_accounts')
          .update({
            spf_verified: spfVerified,
            dkim_verified: dkimVerified,
            dmarc_verified: dmarcVerified,
            domain_verified_at: new Date().toISOString()
          })
          .eq('id', account.id)
        
        if (updateError) {
          console.error(`❌ Failed to update ${account.email}:`, updateError)
          results.push({
            email: account.email,
            success: false,
            error: updateError.message
          })
        } else {
          updated++
          console.log(`✅ Updated ${account.email}: SPF=${spfVerified}, DKIM=${dkimVerified}, DMARC=${dmarcVerified}`)
          results.push({
            email: account.email,
            success: true,
            spf_verified: spfVerified,
            dkim_verified: dkimVerified,
            dmarc_verified: dmarcVerified
          })
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${account.email}:`, error)
        results.push({
          email: account.email,
          success: false,
          error: error.message
        })
      }
    }
    
    console.log(`✅ Domain verification sync complete: ${updated}/${emailAccounts?.length || 0} accounts updated`)
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updated} email account(s) with domain verification status`,
      results
    })

  } catch (error) {
    console.error('Error syncing domain status:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
})