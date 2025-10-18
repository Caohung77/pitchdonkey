'use server'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SequenceService } from '@/lib/sequences'

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: { sequenceId: string } }) => {
  try {
    const body = await request.json()

    if (!body?.nextCampaignId || typeof body.nextCampaignId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'nextCampaignId is required' },
        { status: 400 },
      )
    }

    const delayDays = body.delayDays ?? 3
    const delayHours = body.delayHours ?? 0

    if (delayDays < 0 || delayHours < 0) {
      return NextResponse.json(
        { success: false, error: 'Delay values cannot be negative' },
        { status: 400 },
      )
    }

    const service = new SequenceService(supabase, user.id)
    const link = await service.createLink(params.sequenceId, {
      parentCampaignId: body.parentCampaignId,
      nextCampaignId: body.nextCampaignId,
      delayDays,
      delayHours,
      conditionType: body.conditionType,
      minOpens: body.minOpens,
      minClicks: body.minClicks,
      engagementRequired: body.engagementRequired,
      personaOverrideId: body.personaOverrideId,
      deliveryWindow: body.deliveryWindow,
      metadata: body.metadata,
    })

    return NextResponse.json({ success: true, data: link })
  } catch (error: any) {
    console.error('Failed to create sequence link:', error)
    const status = error?.message?.includes('access denied') ? 403 : 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create sequence link' },
      { status },
    )
  }
})
