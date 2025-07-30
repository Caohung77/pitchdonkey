import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AITemplateService } from '@/lib/ai-templates'
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors'
import { z } from 'zod'

const previewSchema = z.object({
  variables: z.record(z.string()).default({}),
})

// POST /api/ai/templates/[id]/preview - Preview template with variables
export async function POST(
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
    const { variables } = previewSchema.parse(body)

    const templateService = new AITemplateService()
    const template = await templateService.getTemplate(params.id, user.id)

    if (!template) {
      throw new NotFoundError('Template not found')
    }

    const preview = templateService.previewTemplate(template.content, variables)

    return NextResponse.json({
      success: true,
      data: {
        preview,
        variables_used: template.variables,
        missing_variables: template.variables.filter(v => !variables[v]),
      },
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}