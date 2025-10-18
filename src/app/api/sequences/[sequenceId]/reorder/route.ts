'use server'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SequenceService } from '@/lib/sequences'

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: { sequenceId: string } }) => {
  try {
    const body = await request.json()
    const orderedCampaignIds: string[] = Array.isArray(body?.orderedCampaignIds) ? body.orderedCampaignIds : []

    if (!Array.isArray(orderedCampaignIds) || orderedCampaignIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderedCampaignIds array is required' },
        { status: 400 },
      )
    }

    const service = new SequenceService(supabase, user.id)
    await service.reorderSequence(params.sequenceId, orderedCampaignIds)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to reorder sequence campaigns:', error)
    const status = error?.message === 'Sequence not found or access denied' ? 404 : 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reorder sequence' },
      { status },
    )
  }
})
