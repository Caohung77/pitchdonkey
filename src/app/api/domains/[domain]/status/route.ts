import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { DomainAuthService } from '@/lib/domain-auth'

// GET /api/domains/[domain]/status - Get domain authentication status
export async function GET(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const domain = decodeURIComponent(params.domain)
    const domainAuthService = new DomainAuthService()

    // Get domain authentication record
    const domainAuth = await domainAuthService.getDomain(user.id, domain)

    if (!domainAuth) {
      // Create domain auth record if it doesn't exist
      await domainAuthService.createDomain(user.id, {
        domain,
        dns_provider: 'manual',
        auto_configure: false
      })

      // Return default status
      return NextResponse.json({
        success: true,
        status: {
          domain,
          spf: {
            verified: false,
            error: 'Not configured'
          },
          dkim: {
            verified: false,
            error: 'Not configured'
          },
          dmarc: {
            verified: false,
            error: 'Not configured'
          },
          overallStatus: 'unverified',
          lastChecked: null
        }
      })
    }

    // Format response
    const status = {
      domain,
      spf: {
        verified: domainAuth.spf_verified,
        record: domainAuth.spf_record,
        error: domainAuth.spf_error_message
      },
      dkim: {
        verified: domainAuth.dkim_verified,
        record: domainAuth.dkim_public_key ? `v=DKIM1; k=rsa; p=${domainAuth.dkim_public_key}` : undefined,
        selector: domainAuth.dkim_selector,
        error: domainAuth.dkim_error_message
      },
      dmarc: {
        verified: domainAuth.dmarc_verified,
        record: domainAuth.dmarc_record,
        error: domainAuth.dmarc_error_message
      },
      overallStatus: domainAuth.spf_verified && domainAuth.dkim_verified && domainAuth.dmarc_verified 
        ? 'verified' 
        : (domainAuth.spf_verified || domainAuth.dkim_verified || domainAuth.dmarc_verified)
          ? 'partial'
          : 'unverified',
      lastChecked: domainAuth.spf_last_checked || domainAuth.dkim_last_checked || domainAuth.dmarc_last_checked
    }

    return NextResponse.json({
      success: true,
      status
    })
  } catch (error) {
    console.error('Error fetching domain status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}