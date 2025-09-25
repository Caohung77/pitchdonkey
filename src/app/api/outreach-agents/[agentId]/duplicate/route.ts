import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { duplicateOutreachAgent } from '@/lib/outreach-agents'

// POST /api/outreach-agents/[agentId]/duplicate
export const POST = withAuth(async (
  _request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    await withRateLimit(user, 10, 60000)

    const { agentId } = await params
    const cloned = await duplicateOutreachAgent(supabase, user.id, agentId)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: cloned }, { status: 201 })
    )
  } catch (error) {
    console.error('POST /api/outreach-agents/[agentId]/duplicate error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to duplicate outreach agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
