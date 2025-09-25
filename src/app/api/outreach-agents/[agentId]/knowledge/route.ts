import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import {
  getOutreachAgent,
  addKnowledgeItem,
} from '@/lib/outreach-agents'
import { knowledgeItemSchema } from '../../schemas'

// GET /api/outreach-agents/[agentId]/knowledge
export const GET = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 80, 60000)

    const { agentId } = await params
    const agent = await getOutreachAgent(supabase, user.id, agentId)

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Outreach agent not found' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from('outreach_agent_knowledge')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true, data })
    )
  } catch (error) {
    console.error('GET /api/outreach-agents/[agentId]/knowledge error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load knowledge base',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

// POST /api/outreach-agents/[agentId]/knowledge
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 20, 60000)

    const { agentId } = await params
    const body = await request.json()
    const parsed = knowledgeItemSchema.parse(body)

    const created = await addKnowledgeItem(supabase, user.id, agentId, parsed)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: created }, { status: 201 })
    )
  } catch (error) {
    console.error('POST /api/outreach-agents/[agentId]/knowledge error:', error)

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
        error: 'Failed to add knowledge item',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
