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

    // Get or create domain auth record
    let domainAuth = await domainAuthService.getDomain(user.id, domain)
    
    if (!domainAuth) {
      domainAuth = await domainAuthService.createDomain(user.id, {
        domain,
        dns_provider: 'manual',
        auto_configure: false
      })
    }

    // For now, we'll do a simplified verification that just checks if records exist
    // In production, you would implement actual DNS lookups
    
    // Simulate verification results (replace with actual DNS verification)
    const mockVerification = {
      spf: { verified: false, error: 'SPF record not found or invalid' },
      dkim: { verified: false, error: 'DKIM record not found or invalid' },
      dmarc: { verified: false, error: 'DMARC record not found or invalid' }
    }

    // Update verification status in database
    await domainAuthService.updateVerificationStatus(user.id, domain, 'spf', mockVerification.spf.verified, undefined, mockVerification.spf.error)
    await domainAuthService.updateVerificationStatus(user.id, domain, 'dkim', mockVerification.dkim.verified, undefined, mockVerification.dkim.error)
    await domainAuthService.updateVerificationStatus(user.id, domain, 'dmarc', mockVerification.dmarc.verified, undefined, mockVerification.dmarc.error)

    // Format response to match the expected structure
    const status = {
      domain,
      spf: {
        verified: mockVerification.spf.verified,
        error: mockVerification.spf.error
      },
      dkim: {
        verified: mockVerification.dkim.verified,
        selector: domainAuth.dkim_selector || 'coldreach2024',
        error: mockVerification.dkim.error
      },
      dmarc: {
        verified: mockVerification.dmarc.verified,
        error: mockVerification.dmarc.error
      },
      overallStatus: 'unverified',
      lastChecked: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      status,
      message: 'Domain verification completed (Note: This is currently a simplified verification. In production, this would perform actual DNS lookups.)'
    })
  } catch (error) {
    console.error('Error verifying domain:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}