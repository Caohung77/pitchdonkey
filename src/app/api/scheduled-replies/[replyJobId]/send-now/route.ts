import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createReplyJobProcessor } from '@/lib/reply-job-processor'

export const POST = withAuth(async (
  _request: NextRequest,
  { user },
  { params }: { params: Promise<{ replyJobId: string }> }
) => {
  try {
    const { replyJobId } = await params
    const supabase = createServerSupabaseClient()
    const processor = createReplyJobProcessor(supabase)

    await processor.processReplyJobById(replyJobId, user.id)

    const response = NextResponse.json({
      success: true,
      message: 'Reply sent successfully',
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error sending reply job immediately:', error)
    return NextResponse.json({
      error: 'Failed to send reply job',
      code: 'SEND_FAILED',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})
