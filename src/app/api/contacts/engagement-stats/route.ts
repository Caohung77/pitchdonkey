import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()

    // Get engagement statistics for the user's contacts
    const { data: stats, error } = await supabase
      .from('contacts')
      .select('engagement_status, engagement_score')
      .eq('user_id', user.id)
      .not('status', 'eq', 'deleted')

    if (error) throw error

    // Calculate engagement distribution
    const engagementStats = {
      total: stats.length,
      not_contacted: 0,
      pending: 0,
      engaged: 0,
      bad: 0,
      score_distribution: {
        '0-25': 0,
        '26-50': 0,
        '51-75': 0,
        '76-100': 0
      },
      average_score: 0
    }

    let totalScore = 0

    stats.forEach(contact => {
      const status = contact.engagement_status || 'not_contacted'
      const score = contact.engagement_score || 0

      // Count by status
      switch (status) {
        case 'not_contacted':
          engagementStats.not_contacted++
          break
        case 'pending':
          engagementStats.pending++
          break
        case 'engaged':
          engagementStats.engaged++
          break
        case 'bad':
          engagementStats.bad++
          break
      }

      // Count by score range
      if (score >= 0 && score <= 25) {
        engagementStats.score_distribution['0-25']++
      } else if (score <= 50) {
        engagementStats.score_distribution['26-50']++
      } else if (score <= 75) {
        engagementStats.score_distribution['51-75']++
      } else {
        engagementStats.score_distribution['76-100']++
      }

      totalScore += score
    })

    // Calculate average score
    engagementStats.average_score = stats.length > 0
      ? Math.round(totalScore / stats.length)
      : 0

    return createSuccessResponse(engagementStats)

  } catch (error) {
    console.error('Get engagement stats error:', error)
    return handleApiError(error)
  }
})