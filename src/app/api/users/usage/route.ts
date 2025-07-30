import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserUsage } from '@/lib/auth'
import { handleApiError, AuthenticationError } from '@/lib/errors'
import { cacheHelpers, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

// GET /api/users/usage - Get current user's usage statistics
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      throw new AuthenticationError()
    }

    // Try to get usage from cache first
    const cacheKey = `${CACHE_KEYS.USER(session.user.id)}:usage`
    
    const usage = await cacheHelpers.getOrSet(
      cacheKey,
      () => getUserUsage(session.user.id),
      CACHE_TTL.SHORT // 5 minutes cache for usage stats
    )

    return NextResponse.json({
      success: true,
      data: usage,
    })
  } catch (error) {
    const errorResponse = handleApiError(error)
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode })
  }
}