import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AITemplateService } from '@/lib/ai-templates'
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(['cold_outreach', 'follow_up', 'introduction', 'meeting_request', 'custom']).optional(),
  content: z.string().min(1).optional(),
  custom_prompt: z.string().optional(),
})

// GET /api/ai/templates/[id] - Get specific template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const templateService = new AITemplateService()
    const template = await templateService.getTemplate(params.id, user.id)

    if (!template) {
      throw new NotFoundError('Template not found')
    }

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}

// PUT /api/ai/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const body = await request.json()
    const validatedData = updateTemplateSchema.parse(body)

    const templateService = new AITemplateService()
    
    // Validate template content if provided
    if (validatedData.content) {
      const validation = templateService.validateTemplate(validatedData.content)
      if (!validation.isValid) {
        throw new ValidationError(`Template validation failed: ${validation.errors.join(', ')}`)
      }
    }

    const template = await templateService.updateTemplate(params.id, user.id, validatedData)

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}

// DELETE /api/ai/templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const templateService = new AITemplateService()
    await templateService.deleteTemplate(params.id, user.id)

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}