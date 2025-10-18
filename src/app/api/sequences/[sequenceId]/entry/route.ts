'use server'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SequenceService } from '@/lib/sequences'

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: { sequenceId: string } }) => {
  try {
    const body = await request.json()
    if (!('campaignId' in body)) {
      return NextResponse.json(
        { success: false, error: 'campaignId field is required (use null to clear)' },
        { status: 400 },
      )
    }

    const campaignId =
      body.campaignId === null
        ? null
        : typeof body.campaignId === 'string'
          ? body.campaignId
          : undefined

    if (campaignId === undefined) {
      return NextResponse.json(
        { success: false, error: 'campaignId must be a string or null' },
        { status: 400 },
      )
    }

    const service = new SequenceService(supabase, user.id)
    const updated = await service.setEntryCampaign(params.sequenceId, campaignId)

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Failed to update sequence entry campaign:', error)
    const status = error?.message === 'Sequence not found or access denied' ? 404 : 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update entry campaign' },
      { status },
    )
  }
})
