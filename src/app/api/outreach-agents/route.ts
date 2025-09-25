import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import {
  createOutreachAgent,
  listOutreachAgents,
} from '@/lib/outreach-agents'
import {
  agentCreateSchema,
} from './schemas'

export const GET = withAuth(async (_request: NextRequest, { user, supabase }) => {
  try {
    await withRateLimit(user, 60, 60000)
    const agents = await listOutreachAgents(supabase, user.id)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: agents })
    )
  } catch (error) {
    console.error('GET /api/outreach-agents error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load outreach agents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    await withRateLimit(user, 15, 60000)

    const body = await request.json()
    const parsed = agentCreateSchema.parse(body)
    const agent = await createOutreachAgent(supabase, user.id, parsed)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: agent }, { status: 201 })
    )
  } catch (error) {
    console.error('POST /api/outreach-agents error:', error)

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
        error: 'Failed to create outreach agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
