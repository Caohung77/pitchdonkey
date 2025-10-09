import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import {
  approveReplyJob,
  cancelReplyJob,
  updateReplyJobContent,
} from '@/lib/scheduled-replies'
import { z } from 'zod'

const updateContentSchema = z.object({
  draft_subject: z.string().min(1, 'Subject is required'),
  draft_body: z.string().min(1, 'Body is required'),
  scheduled_at: z.string().datetime().optional(),
})

const actionSchema = z.object({
  action: z.enum(['approve', 'cancel']),
})

/**
 * PUT /api/scheduled-replies/[replyJobId]
 * Update reply job content
 */
export const PUT = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ replyJobId: string }> }
) => {
  try {
    const { replyJobId } = await params
    console.log(`PUT /api/scheduled-replies/${replyJobId} called for user:`, user.id)

    const body = await request.json()
    const validationResult = updateContentSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
        code: 'VALIDATION_ERROR',
      }, { status: 400 })
    }

    const { draft_subject, draft_body, scheduled_at } = validationResult.data

    await updateReplyJobContent(
      supabase,
      user.id,
      replyJobId,
      draft_subject,
      draft_body,
      scheduled_at
    )

    const response = NextResponse.json({
      success: true,
      message: 'Reply updated successfully',
    })

    return addSecurityHeaders(response)

  } catch (error) {
    console.error('Error updating reply job:', error)

    if (error instanceof Error) {
      if (error.message.includes('no longer editable')) {
        return NextResponse.json({
          error: error.message,
          code: 'NOT_EDITABLE',
        }, { status: 403 })
      }
      if (error.message.includes('Cannot edit reply')) {
        return NextResponse.json({
          error: error.message,
          code: 'INVALID_STATUS',
        }, { status: 400 })
      }
    }

    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})

/**
 * POST /api/scheduled-replies/[replyJobId]
 * Perform actions (approve, cancel) on reply job
 */
export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ replyJobId: string }> }
) => {
  try {
    const { replyJobId } = await params
    console.log(`POST /api/scheduled-replies/${replyJobId} called for user:`, user.id)

    const body = await request.json()
    const validationResult = actionSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.errors,
        code: 'VALIDATION_ERROR',
      }, { status: 400 })
    }

    const { action } = validationResult.data

    if (action === 'approve') {
      await approveReplyJob(supabase, user.id, replyJobId)

      const response = NextResponse.json({
        success: true,
        message: 'Reply approved successfully',
      })
      return addSecurityHeaders(response)
    }

    if (action === 'cancel') {
      await cancelReplyJob(supabase, user.id, replyJobId)

      const response = NextResponse.json({
        success: true,
        message: 'Reply cancelled successfully',
      })
      return addSecurityHeaders(response)
    }

    return NextResponse.json({
      error: 'Invalid action',
      code: 'INVALID_ACTION',
    }, { status: 400 })

  } catch (error) {
    console.error('Error performing action on reply job:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})
