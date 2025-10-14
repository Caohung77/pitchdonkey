import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

const knowledgeCreateSchema = z.object({
  type: z.enum(['text', 'link', 'pdf', 'doc', 'html']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  storage_path: z.string().optional()
})

export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }: { user: any; supabase: any },
  { params }: { params: Promise<{ personaId: string }> }
) => {
  try {
    const { personaId } = await params

    // Verify persona belongs to user
    const { data: persona, error: personaError } = await supabase
      .from('ai_personas')
      .select('id')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .single()

    if (personaError || !persona) {
      return NextResponse.json(
        { success: false, error: 'Persona not found' },
        { status: 404 }
      )
    }

    // Get knowledge items
    const { data: knowledge, error } = await supabase
      .from('ai_persona_knowledge')
      .select('*')
      .eq('persona_id', personaId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: knowledge || [] })
    )
  } catch (error) {
    console.error('GET /api/ai-personas/[personaId]/knowledge error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load knowledge items',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase }: { user: any; supabase: any },
  { params }: { params: Promise<{ personaId: string }> }
) => {
  try {
    const { personaId } = await params

    // Verify persona belongs to user
    const { data: persona, error: personaError } = await supabase
      .from('ai_personas')
      .select('id')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .single()

    if (personaError || !persona) {
      return NextResponse.json(
        { success: false, error: 'Persona not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = knowledgeCreateSchema.parse(body)

    // Create knowledge item
    const { data: knowledge, error } = await supabase
      .from('ai_persona_knowledge')
      .insert({
        persona_id: personaId,
        user_id: user.id,
        type: parsed.type,
        title: parsed.title,
        description: parsed.description,
        content: parsed.content,
        url: parsed.url,
        storage_path: parsed.storage_path,
        embedding_status: 'pending',
        embedding_metadata: {}
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: knowledge }, { status: 201 })
    )
  } catch (error) {
    console.error('POST /api/ai-personas/[personaId]/knowledge error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.flatten()
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create knowledge item',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
