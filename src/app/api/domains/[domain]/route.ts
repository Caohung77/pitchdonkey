import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { DomainAuthService } from '@/lib/domain-auth'

export const PATCH = withAuth(async (request: NextRequest, { user }, { params }: { params: { domain: string } }) => {
  try {
    const service = new DomainAuthService()
    const domain = decodeURIComponent(params.domain).toLowerCase()
    const body = await request.json()

    // Update domain configuration
    await service.updateDomain(user.id, domain, body)

    return NextResponse.json({ success: true, message: 'Domain updated successfully' })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to update domain' }, { status: 500 })
  }
})