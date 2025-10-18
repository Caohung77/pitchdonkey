'use server'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SequenceService } from '@/lib/sequences'

interface CampaignAssignmentPayload {
  campaignId: string
  sequenceId?: string | null
  position?: number | null
}

export const POST = withAuth(async (request: NextRequest, { user, supabase }, { params }: { params: { sequenceId: string } }) => {
  try {
    const body = await request.json()
    const assignments: CampaignAssignmentPayload[] = Array.isArray(body?.assignments) ? body.assignments : body

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignments payload is required' },
        { status: 400 },
      )
    }

    const normalized = assignments.map((assignment) => {
      if (!assignment?.campaignId || typeof assignment.campaignId !== 'string') {
        throw new Error('Each assignment must include a campaignId')
      }

      const explicitNull = Object.prototype.hasOwnProperty.call(assignment, 'sequenceId') && assignment.sequenceId === null

      return {
        campaignId: assignment.campaignId,
        sequenceId: explicitNull ? null : assignment.sequenceId ?? params.sequenceId,
        position: assignment.position ?? null,
      }
    })

    const service = new SequenceService(supabase, user.id)
    await service.updateCampaignAssignments(normalized)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to update campaign assignments:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update campaign assignments' },
      { status: 500 },
    )
  }
})
