import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { duplicateAIPersona } from '@/lib/ai-personas'

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase, params }: { user: any; supabase: any; params: { personaId: string } }
) => {
  try {
    await withRateLimit(user, 10, 60000)

    const persona = await duplicateAIPersona(supabase, user.id, params.personaId)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: persona }, { status: 201 })
    )
  } catch (error) {
    console.error('POST /api/ai-personas/[personaId]/duplicate error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to duplicate AI persona',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
