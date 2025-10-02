import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Cancel all stuck enrichment jobs for the current user
 * This is useful for cleaning up jobs that got stuck in "running" or "pending" status
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Cancel all running/pending jobs for this user
    const { data: cancelledJobs, error } = await supabase
      .from('bulk_enrichment_jobs')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .in('status', ['running', 'pending'])
      .select('id, progress')

    if (error) {
      console.error('Failed to cancel jobs:', error)
      throw new Error('Failed to cancel enrichment jobs')
    }

    const cancelledCount = cancelledJobs?.length || 0

    console.log(`✅ Cancelled ${cancelledCount} stuck enrichment jobs for user ${user.id}`)

    return createSuccessResponse({
      success: true,
      cancelled_count: cancelledCount,
      cancelled_jobs: cancelledJobs,
      message: cancelledCount > 0
        ? `Cancelled ${cancelledCount} stuck enrichment job${cancelledCount > 1 ? 's' : ''}`
        : 'No stuck jobs found'
    })
  } catch (error) {
    console.error('Cancel enrichment jobs error:', error)
    return handleApiError(error)
  }
})
