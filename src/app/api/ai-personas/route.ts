import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { createAIPersona, listAIPersonas } from '@/lib/ai-personas'

const personaCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
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
  ]),
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

export const GET = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    await withRateLimit(user, 60, 60000)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'draft' | 'active' | 'inactive' | null
    const persona_type = searchParams.get('persona_type')
    const chat_enabled = searchParams.get('chat_enabled')

    const filters: any = {}
    if (status) filters.status = status
    if (persona_type) filters.persona_type = persona_type
    if (chat_enabled !== null) filters.chat_enabled = chat_enabled === 'true'

    const personas = await listAIPersonas(supabase, user.id, filters)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: personas })
    )
  } catch (error) {
    console.error('GET /api/ai-personas error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load AI personas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  try {
    await withRateLimit(user, 15, 60000)

    const body = await request.json()
    const parsed = personaCreateSchema.parse(body)
    const persona = await createAIPersona(supabase, user.id, parsed)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: persona }, { status: 201 })
    )
  } catch (error) {
    console.error('POST /api/ai-personas error:', error)

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
        error: 'Failed to create AI persona',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
