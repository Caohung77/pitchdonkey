import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import {
  getOutreachAgent,
  updateOutreachAgent,
  deleteOutreachAgent,
} from '@/lib/outreach-agents'
import { agentUpdateSchema } from '../schemas'

// GET /api/outreach-agents/[agentId]
export const GET = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 60, 60000)

    const { agentId } = await params
    const agent = await getOutreachAgent(supabase, user.id, agentId)

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Outreach agent not found' },
        { status: 404 }
      )
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: agent })
    )
  } catch (error) {
    console.error('GET /api/outreach-agents/[agentId] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load outreach agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

// PUT /api/outreach-agents/[agentId]
export const PUT = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 20, 60000)

    const { agentId } = await params
    const body = await request.json()
    const parsed = agentUpdateSchema.parse(body)

    const updated = await updateOutreachAgent(supabase, user.id, agentId, parsed)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: updated })
    )
  } catch (error) {
    console.error('PUT /api/outreach-agents/[agentId] error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.flatten(),
        },
        { status: 422 }
      )
    }

    if (error instanceof Error && error.message === 'Outreach agent not found') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update outreach agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

// DELETE /api/outreach-agents/[agentId]
export const DELETE = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 10, 60000)

    const { agentId } = await params
    const agent = await getOutreachAgent(supabase, user.id, agentId)

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Outreach agent not found' },
        { status: 404 }
      )
    }

    await deleteOutreachAgent(supabase, user.id, agentId)

    return addSecurityHeaders(
      NextResponse.json({ success: true })
    )
  } catch (error) {
    console.error('DELETE /api/outreach-agents/[agentId] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete outreach agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
