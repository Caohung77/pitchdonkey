'use server'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SequenceService } from '@/lib/sequences'

interface RouteParams {
  sequenceId: string
  linkId: string
}

export const PUT = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: RouteParams }) => {
  try {
    const body = await request.json()
    const service = new SequenceService(supabase, user.id)
    const updated = await service.updateLink(params.linkId, {
      parentCampaignId: body.parentCampaignId,
      nextCampaignId: body.nextCampaignId,
      delayDays: body.delayDays,
      delayHours: body.delayHours,
      conditionType: body.conditionType,
      minOpens: body.minOpens,
      minClicks: body.minClicks,
      engagementRequired: body.engagementRequired,
      personaOverrideId: body.personaOverrideId,
      deliveryWindow: body.deliveryWindow,
      metadata: body.metadata,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Failed to update sequence link:', error)
    const status = error?.message === 'Sequence link not found' ? 404 : 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update sequence link' },
      { status },
    )
  }
})

export const DELETE = withAuth(async (_request: NextRequest, { user, supabase }, { params }: { params: RouteParams }) => {
  try {
    const service = new SequenceService(supabase, user.id)
    await service.deleteLink(params.linkId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete sequence link:', error)
    const status = error?.message === 'Sequence link not found' ? 404 : 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete sequence link' },
      { status },
    )
  }
})
