import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { DomainAuthService } from '@/lib/domain-auth'

// POST /api/domains/[domain]/verify - Verify domain authentication records
export async function POST(
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

    // Verify the domain
    const verificationStatus = await domainAuthService.verifyDomain(user.id, domain)

    // Format response to match the expected structure
    const status = {
      domain,
      spf: {
        verified: verificationStatus.spf?.success || false,
        record: verificationStatus.spf?.record?.raw,
        error: verificationStatus.spf?.success ? undefined : 
               verificationStatus.spf?.validation.errors.join('; ') || 'Verification failed'
      },
      dkim: {
        verified: verificationStatus.dkim?.success || false,
        record: verificationStatus.dkim?.record?.raw,
        selector: verificationStatus.dkim?.record?.selector,
        error: verificationStatus.dkim?.success ? undefined : 
               verificationStatus.dkim?.validation.errors.join('; ') || 'Verification failed'
      },
      dmarc: {
        verified: verificationStatus.dmarc?.success || false,
        record: verificationStatus.dmarc?.record?.raw,
        error: verificationStatus.dmarc?.success ? undefined : 
               verificationStatus.dmarc?.validation.errors.join('; ') || 'Verification failed'
      },
      overallStatus: verificationStatus.overallStatus,
      lastChecked: verificationStatus.lastChecked
    }

    return NextResponse.json({
      success: true,
      status,
      verificationDetails: verificationStatus
    })
  } catch (error) {
    console.error('Error verifying domain:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}