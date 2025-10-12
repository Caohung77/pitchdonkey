import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { improveDraftWithAgent } from '@/lib/outreach-agent-compose'

const improveSchema = z.object({
  subject: z.string().optional().default(''),
  body: z.string().min(1, 'Body is required'),
})

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    const { agentId } = await params
    await withRateLimit(user, 20, 60000)

    const payload = improveSchema.parse(await request.json())
    const result = await improveDraftWithAgent(supabase, user.id, agentId, payload)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: result,
      })
    )
  } catch (error) {
    console.error('Improve draft failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: error.flatten(),
        },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      const message = error.message || 'Failed to improve draft'
      const status = determineStatusCode(message)
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error improving draft',
      },
      { status: 500 }
    )
  }
})

function determineStatusCode(message: string): number {
  if (message.includes('not found')) return 404
  if (message.includes('not active')) return 400
  if (message.includes('rate')) return 429
  return 500
}
