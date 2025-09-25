import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import {
  getOutreachAgent,
  updateKnowledgeItem,
  removeKnowledgeItem,
} from '@/lib/outreach-agents'
import { knowledgeItemSchema } from '../../../schemas'

const knowledgeUpdateSchema = knowledgeItemSchema.partial()

// PUT /api/outreach-agents/[agentId]/knowledge/[knowledgeId]
export const PUT = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string; knowledgeId: string }> }
) => {
  try {
    await withRateLimit(user, 20, 60000)

    const { agentId, knowledgeId } = await params
    const body = await request.json()
    const parsed = knowledgeUpdateSchema.parse(body)

    const agent = await getOutreachAgent(supabase, user.id, agentId)
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Outreach agent not found' },
        { status: 404 }
      )
    }

    const updated = await updateKnowledgeItem(supabase, user.id, agentId, knowledgeId, parsed)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: updated })
    )
  } catch (error) {
    console.error('PUT /api/outreach-agents/[agentId]/knowledge/[knowledgeId] error:', error)

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

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update knowledge item',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

// DELETE /api/outreach-agents/[agentId]/knowledge/[knowledgeId]
export const DELETE = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string; knowledgeId: string }> }
) => {
  try {
    await withRateLimit(user, 15, 60000)

    const { agentId, knowledgeId } = await params
    const agent = await getOutreachAgent(supabase, user.id, agentId)

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Outreach agent not found' },
        { status: 404 }
      )
    }

    await removeKnowledgeItem(supabase, user.id, agentId, knowledgeId)

    return addSecurityHeaders(
      NextResponse.json({ success: true })
    )
  } catch (error) {
    console.error('DELETE /api/outreach-agents/[agentId]/knowledge/[knowledgeId] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete knowledge item',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
