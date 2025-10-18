'use server'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SequenceService } from '@/lib/sequences'

export const GET = withAuth(async (_request: NextRequest, { user, supabase }) => {
  try {
    const service = new SequenceService(supabase, user.id)
    const sequences = await service.listSequences()

    return NextResponse.json({
      success: true,
      data: sequences,
    })
  } catch (error: any) {
    console.error('Failed to fetch sequences:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch sequences' },
      { status: 500 },
    )
  }
})

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    const payload = await request.json()
    if (!payload?.name || typeof payload.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Sequence name is required' },
        { status: 400 },
      )
    }

    const service = new SequenceService(supabase, user.id)
    const sequence = await service.createSequence({
      name: payload.name.trim(),
      description: payload.description,
      entryCampaignId: payload.entryCampaignId,
      status: payload.status,
    })

    return NextResponse.json({
      success: true,
      data: sequence,
    })
  } catch (error: any) {
    console.error('Failed to create sequence:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create sequence' },
      { status: 500 },
    )
  }
})
