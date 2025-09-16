import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService } from '@/lib/domain-auth'

export const POST = withAuth(async (request: NextRequest, { user }, { params }: { params: { domain: string } }) => {
  try {
    const service = new DomainAuthService()
    const domain = decodeURIComponent(params.domain).toLowerCase()
    // Try to read selector from client payload when provided
    let selector: string | undefined
    try {
      const body = await request.json()
      selector = body?.dkim_selector || body?.selector
    } catch {}

    // Ensure a domain_auth record exists before verification
    let domainRecord = await service.getDomain(user.id, domain)
    if (!domainRecord) {
      console.log(`Creating domain record for ${domain}`)
      domainRecord = await service.createDomain(user.id, { domain, dns_provider: 'manual', auto_configure: false } as any)
    }

    console.log(`Verifying domain ${domain} for user ${user.id}`)
    const status = await service.verifyDomain(user.id, domain, selector)

    console.log(`Verification results for ${domain}:`, {
      spf: !!status.spf?.success,
      dkim: !!status.dkim?.success,
      dmarc: !!status.dmarc?.success
    })
    
    // Extract verification status
    const spfVerified = !!status.spf?.success
    const dkimVerified = !!status.dkim?.success
    const dmarcVerified = !!status.dmarc?.success
    
    // Wait a moment for database updates to propagate
    await new Promise(resolve => setTimeout(resolve, 100))

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

    // Fetch fresh status from database to ensure we return the latest data
    const freshRecord = await service.getDomain(user.id, domain)
    console.log('Fresh domain record after verification:', {
      spf_verified: freshRecord?.spf_verified,
      dkim_verified: freshRecord?.dkim_verified,
      dmarc_verified: freshRecord?.dmarc_verified
    })
    
    // Map to UI shape using fresh database data
    const mapped = {
      domain,
      spf: {
        verified: !!freshRecord?.spf_verified,
        record: freshRecord?.spf_record || status.spf?.record?.raw,
        error: freshRecord?.spf_error_message || (status.spf?.validation.errors.join('; ') || undefined)
      },
      dkim: {
        verified: !!freshRecord?.dkim_verified,
        record: freshRecord?.dkim_record || status.dkim?.record?.raw,
        selector: freshRecord?.dkim_selector || status.dkim?.record?.selector,
        error: freshRecord?.dkim_error_message || (status.dkim?.validation.errors.join('; ') || undefined)
      },
      dmarc: {
        verified: !!freshRecord?.dmarc_verified,
        record: freshRecord?.dmarc_record || status.dmarc?.record?.raw,
        error: freshRecord?.dmarc_error_message || (status.dmarc?.validation.errors.join('; ') || undefined)
      },
      overallStatus: freshRecord ? (freshRecord.spf_verified && freshRecord.dkim_verified && freshRecord.dmarc_verified ? 'verified' : (freshRecord.spf_verified || freshRecord.dkim_verified || freshRecord.dmarc_verified ? 'partial' : 'unverified')) : 'unverified',
      lastChecked: freshRecord?.updated_at || status.lastChecked
    }

    console.log('Final mapped response:', mapped)

    return NextResponse.json({ success: true, status: mapped })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to verify domain' }, { status: 500 })
  }
})
