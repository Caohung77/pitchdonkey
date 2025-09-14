import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService } from '@/lib/domain-auth'

export const POST = withAuth(async (request: NextRequest, { user }, { params }: { params: { domain: string } }) => {
  try {
    const service = new DomainAuthService()
    const domain = decodeURIComponent(params.domain).toLowerCase()

    // Ensure a domain_auth record exists
    const existing = await service.getDomain(user.id, domain)
    if (!existing) {
      await service.createDomain(user.id, { domain, dns_provider: 'manual', auto_configure: false } as any)
    }

    const status = await service.verifyDomain(user.id, domain)
    
    // Extract verification status
    const spfVerified = !!status.spf?.success
    const dkimVerified = !!status.dkim?.success
    const dmarcVerified = !!status.dmarc?.success
    
    // Update email accounts table with verification status
    const supabase = (await import('@/lib/supabase-server')).createServerSupabaseClient()
    
    // Find all email accounts for this domain and update their verification status
    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('id, email')
      .eq('user_id', user.id)
    
    if (emailAccounts) {
      for (const account of emailAccounts) {
        // Extract domain from email account
        const accountDomain = account.email.split('@')[1]?.toLowerCase()
        if (accountDomain === domain) {
          // Update this email account with verification status
          await supabase
            .from('email_accounts')
            .update({
              spf_verified: spfVerified,
              dkim_verified: dkimVerified,
              dmarc_verified: dmarcVerified,
              domain_verified_at: new Date().toISOString()
            })
            .eq('id', account.id)
          
          console.log(`Updated email account ${account.email} verification status:`, {
            spf_verified: spfVerified,
            dkim_verified: dkimVerified,
            dmarc_verified: dmarcVerified
          })
        }
      }
    }
    
    // Map to UI shape
    const mapped = {
      domain,
      spf: { verified: spfVerified, record: status.spf?.record?.raw, error: status.spf?.validation.errors.join('; ') || undefined },
      dkim: { verified: dkimVerified, record: status.dkim?.record?.raw, selector: status.dkim?.record?.selector, error: status.dkim?.validation.errors.join('; ') || undefined },
      dmarc: { verified: dmarcVerified, record: status.dmarc?.record?.raw, error: status.dmarc?.validation.errors.join('; ') || undefined },
      overallStatus: status.overallStatus,
      lastChecked: status.lastChecked
    }

    return NextResponse.json({ success: true, status: mapped })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to verify domain' }, { status: 500 })
  }
})

