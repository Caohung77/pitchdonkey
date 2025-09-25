import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import {
  getOutreachAgent,
  buildAgentPreview,
  previewSegment,
} from '@/lib/outreach-agents'
import { segmentPreviewSchema } from '../../../schemas'

// POST /api/outreach-agents/[agentId]/segment/preview
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 30, 60000)

    const { agentId } = await params
    const agent = await getOutreachAgent(supabase, user.id, agentId)

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Outreach agent not found' },
        { status: 404 }
      )
    }

    const body = request.body ? await request.json() : {}
    const parsed = segmentPreviewSchema.parse(body ?? {})

    const previewAgent = buildAgentPreview(agent, {
      segment_config: parsed.segment_config ?? undefined,
      quality_weights: parsed.quality_weights ?? undefined,
    })

    const preview = await previewSegment(supabase, user.id, previewAgent, {
      persist: parsed.persist ?? false,
      limit: parsed.limit,
      threshold: parsed.threshold,
    })

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: preview })
    )
  } catch (error) {
    console.error('POST /api/outreach-agents/[agentId]/segment/preview error:', error)

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
        error: 'Failed to generate segment preview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
