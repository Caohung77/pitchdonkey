import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, addSecurityHeaders, withRateLimit } from '@/lib/auth-middleware'
import { getAIPersona } from '@/lib/ai-personas'
import {
  generatePersonaAvatar,
  validateAvatarOptions,
  type AvatarGenerationOptions
} from '@/lib/imagen-generator'

const avatarGenerationSchema = z.object({
  age: z.enum(['young_adult', 'mid_career', 'senior', 'executive']).optional(),
  gender: z.enum(['male', 'female', 'non_binary']).optional(),
  ethnicity: z.string().optional(),
  attire: z.enum(['business_formal', 'business_casual', 'smart_casual', 'casual']).optional(),
  customPrompt: z.string().optional()
})

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase, params }: { user: any; supabase: any; params: { personaId: string } }
) => {
  try {
    await withRateLimit(user, 5, 60000) // 5 generations per minute

    const body = await request.json()
    const parsed = avatarGenerationSchema.parse(body)

    // Get persona
    const persona = await getAIPersona(supabase, user.id, params.personaId)
    if (!persona) {
      return NextResponse.json(
        { success: false, error: 'AI persona not found' },
        { status: 404 }
      )
    }

    // Build avatar options
    const options: AvatarGenerationOptions = {
      personaName: persona.name,
      personaType: persona.persona_type,
      age: parsed.age,
      gender: parsed.gender,
      ethnicity: parsed.ethnicity,
      attire: parsed.attire,
      personality: {
        communication_style: persona.personality_traits.communication_style,
        formality: persona.personality_traits.formality,
        empathy_level: persona.personality_traits.empathy_level
      },
      customPrompt: parsed.customPrompt
    }

    // Validate options
    const validation = validateAvatarOptions(options)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid avatar options',
          details: validation.errors
        },
        { status: 422 }
      )
    }

    // Update status to generating
    await supabase
      .from('ai_personas')
      .update({
        avatar_generation_status: 'generating',
        avatar_prompt: options.customPrompt || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.personaId)

    // Generate avatar
    const result = await generatePersonaAvatar(options)

    if (!result.success) {
      // Update status to failed
      await supabase
        .from('ai_personas')
        .update({
          avatar_generation_status: 'failed',
          avatar_metadata: { error: result.error },
          updated_at: new Date().toISOString()
        })
        .eq('id', params.personaId)

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Avatar generation failed',
          details: result
        },
        { status: 500 }
      )
    }

    // Update persona with avatar
    await supabase
      .from('ai_personas')
      .update({
        avatar_url: result.imageUrl,
        avatar_prompt: result.prompt,
        avatar_generation_status: 'completed',
        avatar_metadata: result.metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.personaId)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          imageUrl: result.imageUrl,
          prompt: result.prompt,
          metadata: result.metadata
        }
      })
    )
  } catch (error) {
    console.error('POST /api/ai-personas/[personaId]/generate-avatar error:', error)

    // Update status to failed
    await supabase
      .from('ai_personas')
      .update({
        avatar_generation_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', params.personaId)
      .catch(() => {}) // Ignore update errors

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
        error: 'Failed to generate avatar',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
