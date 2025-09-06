import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService } from '@/lib/domain-auth'

export const GET = withAuth(async (request: NextRequest, { user }, { params }: { params: { domain: string } }) => {
  try {
    const service = new DomainAuthService()
    const domain = decodeURIComponent(params.domain).toLowerCase()
    const record = await service.getDomain(user.id, domain)

    const status = {
      domain,
      spf: { verified: !!record?.spf_verified, record: record?.spf_record || undefined, error: record?.spf_error_message || undefined },
      dkim: { verified: !!record?.dkim_verified, record: record?.dkim_record || undefined, selector: record?.dkim_selector || undefined, error: record?.dkim_error_message || undefined },
      dmarc: { verified: !!record?.dmarc_verified, record: record?.dmarc_record || undefined, error: record?.dmarc_error_message || undefined },
      overallStatus: record ? (record.spf_verified && record.dkim_verified && record.dmarc_verified ? 'verified' : (record.spf_verified || record.dkim_verified || record.dmarc_verified ? 'partial' : 'unverified')) : 'unverified',
      lastChecked: record?.updated_at || undefined
    }

    return NextResponse.json({ success: true, status })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to get status' }, { status: 500 })
  }
})

