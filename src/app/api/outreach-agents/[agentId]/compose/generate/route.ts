import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { generateDraftWithAgent } from '@/lib/outreach-agent-compose'

const generateSchema = z.object({
  prompt: z.string().min(3, 'Prompt is required'),
  hints: z
    .object({
      length: z.enum(['short', 'medium', 'long']).optional(),
    })
    .optional(),
})

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    const { agentId } = await params
    await withRateLimit(user, 15, 60000)

    const payload = generateSchema.parse(await request.json())
    const result = await generateDraftWithAgent(supabase, user.id, agentId, payload)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: result,
      })
    )
  } catch (error) {
    console.error('Generate draft failed:', error)

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
      const message = error.message || 'Failed to generate draft'
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
        error: 'Unexpected error generating draft',
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
