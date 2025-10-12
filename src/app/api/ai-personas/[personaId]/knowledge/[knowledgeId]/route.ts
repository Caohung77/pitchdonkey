import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

export const DELETE = withAuth(async (request: NextRequest, { user, supabase, params }) => {
  try {
    const { personaId, knowledgeId } = params

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

    // Delete knowledge item
    const { error } = await supabase
      .from('ai_persona_knowledge')
      .delete()
      .eq('id', knowledgeId)
      .eq('persona_id', personaId)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    // Update persona's knowledge summary
    const { count } = await supabase
      .from('ai_persona_knowledge')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', personaId)

    await supabase
      .from('ai_personas')
      .update({
        knowledge_summary: {
          total_items: count || 0,
          last_updated: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', personaId)

    return addSecurityHeaders(
      NextResponse.json({ success: true })
    )
  } catch (error) {
    console.error('DELETE /api/ai-personas/[personaId]/knowledge/[knowledgeId] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete knowledge item',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
