import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AITemplateService } from '@/lib/ai-templates'
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.enum(['cold_outreach', 'follow_up', 'introduction', 'meeting_request', 'custom']),
  content: z.string().min(1, 'Template content is required'),
  custom_prompt: z.string().optional(),
})

// GET /api/ai/templates - Get user's AI templates
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined

    const templateService = new AITemplateService()
    const templates = await templateService.getUserTemplates(user.id, category)

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}

// POST /api/ai/templates - Create new AI template
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const body = await request.json()
    const validatedData = createTemplateSchema.parse(body)

    const templateService = new AITemplateService()
    
    // Validate template content
    const validation = templateService.validateTemplate(validatedData.content)
    if (!validation.isValid) {
      throw new ValidationError(`Template validation failed: ${validation.errors.join(', ')}`)
    }

    const template = await templateService.createTemplate(user.id, validatedData)

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template created successfully',
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}