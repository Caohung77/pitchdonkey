import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { getAIPersona, updateAIPersona, deleteAIPersona } from '@/lib/ai-personas'

const personaUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  persona_type: z.enum([
    'customer_support',
    'sales_rep',
    'sales_development',
    'account_manager',
    'consultant',
    'technical_specialist',
    'success_manager',
    'marketing_specialist',
    'custom'
  ]).optional(),
  custom_persona_name: z.string().optional(),
  custom_persona_description: z.string().optional(),
  custom_role_definition: z.string().optional(),
  custom_responsibilities: z.array(z.string()).optional(),
  custom_communication_guidelines: z.string().optional(),
  custom_example_interactions: z.array(z.any()).optional(),
  purpose: z.string().optional(),
  tone: z.string().optional(),
  language: z.enum(['en', 'de']).optional(),
  sender_name: z.string().optional(),
  sender_role: z.string().optional(),
  company_name: z.string().optional(),
  product_one_liner: z.string().optional(),
  product_description: z.string().optional(),
  unique_selling_points: z.array(z.string()).optional(),
  target_persona: z.string().optional(),
  conversation_goal: z.string().optional(),
  preferred_cta: z.string().optional(),
  follow_up_strategy: z.string().optional(),
  custom_prompt: z.string().optional(),
  prompt_override: z.string().optional(),
  personality_traits: z.object({
    communication_style: z.enum(['formal', 'professional', 'friendly', 'casual', 'empathetic', 'direct', 'consultative']).optional(),
    response_length: z.enum(['concise', 'balanced', 'detailed', 'comprehensive']).optional(),
    empathy_level: z.enum(['low', 'moderate', 'high', 'very_high']).optional(),
    formality: z.enum(['very_formal', 'formal', 'professional', 'casual', 'very_casual']).optional(),
    expertise_depth: z.enum(['basic', 'intermediate', 'advanced', 'expert']).optional(),
    proactivity: z.enum(['reactive', 'balanced', 'proactive', 'very_proactive']).optional(),
    tone_modifiers: z.array(z.string()).optional(),
    behavioral_quirks: z.array(z.string()).optional()
  }).optional(),
  segment_config: z.any().optional(),
  quality_weights: z.any().optional(),
  chat_enabled: z.boolean().optional(),
  settings: z.record(z.any()).optional()
})

export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase }: { user: any; supabase: any },
  { params }: { params: Promise<{ personaId: string }> }
) => {
  try {
    await withRateLimit(user, 60, 60000)

    const { personaId } = await params
    const persona = await getAIPersona(supabase, user.id, personaId)

    if (!persona) {
      return NextResponse.json(
        { success: false, error: 'AI persona not found' },
        { status: 404 }
      )
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: persona })
    )
  } catch (error) {
    console.error('GET /api/ai-personas/[personaId] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load AI persona',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

export const PUT = withAuth(async (
  request: NextRequest,
  { user, supabase }: { user: any; supabase: any },
  { params }: { params: Promise<{ personaId: string }> }
) => {
  try {
    await withRateLimit(user, 30, 60000)

    const { personaId } = await params
    const body = await request.json()
    const parsed = personaUpdateSchema.parse(body)
    const persona = await updateAIPersona(supabase, user.id, personaId, parsed)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: persona })
    )
  } catch (error) {
    console.error('PUT /api/ai-personas/[personaId] error:', error)

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
        error: 'Failed to update AI persona',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (
  request: NextRequest,
  { user, supabase }: { user: any; supabase: any },
  { params }: { params: Promise<{ personaId: string }> }
) => {
  try {
    await withRateLimit(user, 15, 60000)

    const { personaId } = await params

    console.log('🔄 DELETE API route called:', {
      userId: user.id,
      personaId,
      timestamp: new Date().toISOString()
    })

    await deleteAIPersona(supabase, user.id, personaId)

    console.log('✅ DELETE API route success:', { personaId })

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'AI persona deleted successfully',
        data: { personaId }
      })
    )
  } catch (error) {
    console.error('❌ DELETE /api/ai-personas/[personaId] error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Determine appropriate status code based on error message
    let statusCode = 500
    if (errorMessage.includes('not found') || errorMessage.includes('do not have permission')) {
      statusCode = 404
    } else if (errorMessage.includes('permission')) {
      statusCode = 403
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete AI persona',
        details: errorMessage
      },
      { status: statusCode }
    )
  }
})
