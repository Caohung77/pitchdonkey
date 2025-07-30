import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AITemplateService } from '@/lib/ai-templates'
import { handleApiError, AuthenticationError } from '@/lib/errors'

// GET /api/ai/templates/stats - Get template usage statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new AuthenticationError()
    }

    const templateService = new AITemplateService()
    const stats = await templateService.getTemplateStats(user.id)

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}