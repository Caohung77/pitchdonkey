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
    // Map to UI shape
    const mapped = {
      domain,
      spf: { verified: !!status.spf?.success, record: status.spf?.record?.raw, error: status.spf?.validation.errors.join('; ') || undefined },
      dkim: { verified: !!status.dkim?.success, record: status.dkim?.record?.raw, selector: status.dkim?.record?.selector, error: status.dkim?.validation.errors.join('; ') || undefined },
      dmarc: { verified: !!status.dmarc?.success, record: status.dmarc?.record?.raw, error: status.dmarc?.validation.errors.join('; ') || undefined },
      overallStatus: status.overallStatus,
      lastChecked: status.lastChecked
    }

    return NextResponse.json({ success: true, status: mapped })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to verify domain' }, { status: 500 })
  }
})

