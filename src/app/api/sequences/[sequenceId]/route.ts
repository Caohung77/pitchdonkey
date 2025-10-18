'use server'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SequenceService } from '@/lib/sequences'

export const GET = withAuth(async (_request: NextRequest, { user, supabase }, { params }: { params: { sequenceId: string } }) => {
  try {
    const service = new SequenceService(supabase, user.id)
    const sequence = await service.getSequence(params.sequenceId)

    if (!sequence) {
      return NextResponse.json(
        { success: false, error: 'Sequence not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: sequence })
  } catch (error: any) {
    console.error('Failed to fetch sequence:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch sequence' },
      { status: 500 },
    )
  }
})

export const PUT = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: { sequenceId: string } }) => {
  try {
    const payload = await request.json()
    const service = new SequenceService(supabase, user.id)

    const updated = await service.updateSequence(params.sequenceId, {
      name: payload?.name,
      description: payload?.description,
      status: payload?.status,
      entryCampaignId: payload?.entryCampaignId,
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    console.error('Failed to update sequence:', error)
    const status = error?.message === 'Sequence not found or access denied' ? 404 : 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update sequence' },
      { status },
    )
  }
})

export const DELETE = withAuth(async (_request: NextRequest, { user, supabase }, { params }: { params: { sequenceId: string } }) => {
  try {
    const service = new SequenceService(supabase, user.id)
    await service.deleteSequence(params.sequenceId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete sequence:', error)
    const status = error?.message === 'Sequence not found or access denied' ? 404 : 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete sequence' },
      { status },
    )
  }
})
