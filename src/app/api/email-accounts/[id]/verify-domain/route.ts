import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { DomainAuthService, extractDomainFromEmail } from '@/lib/domain-auth'
import { SPFGenerator } from '@/lib/dns-record-generators/spf-generator'
import { DKIMGenerator } from '@/lib/dns-record-generators/dkim-generator'
import { DMARCGenerator } from '@/lib/dns-record-generators/dmarc-generator'

// GET /api/email-accounts/[id]/verify-domain - Get domain authentication status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get email account to extract domain
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('email, domain')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    const domain = account.domain || extractDomainFromEmail(account.email)
    const domainAuthService = new DomainAuthService()

    // Get or create domain auth record
    let domainAuth = await domainAuthService.getDomain(user.id, domain)
    if (!domainAuth) {
      domainAuth = await domainAuthService.createDomain(user.id, {
        domain,
        dns_provider: 'manual',
        auto_configure: false
      })
    }

    // Generate DNS records
    const spfRecord = SPFGenerator.generateForSMTP(domain, account.email.split('@')[1])
    const dkimResult = DKIMGenerator.generateForDomain(domain)
    const dmarcRecord = DMARCGenerator.generateBasicRecord(domain, `reports@${domain}`)

    // Prepare status response
    const status = {
      spf: {
        verified: domainAuth.spf_verified,
        record: domainAuth.spf_record,
        error: domainAuth.spf_error_message,
        dnsRecord: spfRecord.record
      },
      dkim: {
        verified: domainAuth.dkim_verified,
        record: domainAuth.dkim_public_key,
        error: domainAuth.dkim_error_message,
        selector: domainAuth.dkim_selector,
        dnsRecord: dkimResult.record
      },
      dmarc: {
        verified: domainAuth.dmarc_verified,
        record: domainAuth.dmarc_record,
        error: domainAuth.dmarc_error_message,
        dnsRecord: dmarcRecord.record
      },
      overallStatus: domainAuth.spf_verified && domainAuth.dkim_verified && domainAuth.dmarc_verified 
        ? 'verified' 
        : (domainAuth.spf_verified || domainAuth.dkim_verified || domainAuth.dmarc_verified)
        ? 'partial'
        : 'unverified',
      lastChecked: domainAuth.spf_last_checked || domainAuth.dkim_last_checked || domainAuth.dmarc_last_checked
    }

    const records = {
      spf: spfRecord.record,
      dkim: dkimResult.record,
      dmarc: dmarcRecord.record
    }

    return NextResponse.json({
      success: true,
      domain,
      status,
      records
    })
  } catch (error) {
    console.error('Error getting domain auth status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/email-accounts/[id]/verify-domain - Verify domain authentication
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get email account to extract domain
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('email, domain')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    const domain = account.domain || extractDomainFromEmail(account.email)
    const domainAuthService = new DomainAuthService()

    // Perform verification
    const verificationStatus = await domainAuthService.verifyDomain(user.id, domain)

    // Convert to response format
    const status = {
      spf: {
        verified: verificationStatus.spf?.success || false,
        record: verificationStatus.spf?.record?.raw,
        error: verificationStatus.spf?.success ? undefined : verificationStatus.spf?.validation.errors.join('; ')
      },
      dkim: {
        verified: verificationStatus.dkim?.success || false,
        record: verificationStatus.dkim?.record?.raw,
        error: verificationStatus.dkim?.success ? undefined : verificationStatus.dkim?.validation.errors.join('; '),
        selector: verificationStatus.dkim?.record?.selector
      },
      dmarc: {
        verified: verificationStatus.dmarc?.success || false,
        record: verificationStatus.dmarc?.record?.raw,
        error: verificationStatus.dmarc?.success ? undefined : verificationStatus.dmarc?.validation.errors.join('; ')
      },
      overallStatus: verificationStatus.overallStatus,
      lastChecked: verificationStatus.lastChecked
    }

    return NextResponse.json({
      success: true,
      domain,
      status,
      message: 'Domain verification completed'
    })
  } catch (error) {
    console.error('Error verifying domain:', error)
    return NextResponse.json({ error: 'Failed to verify domain' }, { status: 500 })
  }
}