import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generatePersonaAvatar, uploadAvatarToStorage } from '@/lib/imagen-generator'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'

const generateHeadshotSchema = z.object({
  prompt: z.string().optional(),
  gender: z.enum(['male', 'female', 'non-binary']).optional(),
  personaType: z.enum([
    'customer_support',
    'sales_rep',
    'sales_development',
    'account_manager',
    'consultant',
    'technical_specialist',
    'success_manager',
    'marketing_specialist',
    'custom'
  ]).optional()
})

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json()
    const { prompt, gender, personaType } = generateHeadshotSchema.parse(body)

    console.log('🎨 Generating headshot for user:', user.id)

    // Generate avatar using custom prompt or default options
    const result = await generatePersonaAvatar(
      'Persona', // Generic name since this is during creation
      personaType || 'custom',
      {
        gender,
        customPrompt: prompt
      }
    )

    if (!result.success || !result.imageUrl) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate headshot' },
        { status: 500 }
      )
    }

    // Upload to Supabase storage
    // Generate a temporary persona ID for storage (will be replaced when persona is created)
    const tempPersonaId = `temp-${Date.now()}`
    const uploadResult = await uploadAvatarToStorage(
      result.imageUrl,
      tempPersonaId,
      user.id
    )

    if (!uploadResult) {
      return NextResponse.json(
        { error: 'Failed to upload avatar to storage' },
        { status: 500 }
      )
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          avatar_url: uploadResult.url,
          storage_path: uploadResult.path,
          prompt: result.prompt
        }
      })
    )
  } catch (error: any) {
    console.error('Error generating headshot:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate headshot' },
      { status: 500 }
    )
  }
})
