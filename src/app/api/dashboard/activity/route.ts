import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {

    // For now, we'll return mock activity data
    // In a real implementation, you'd have an activity log table
    const mockActivity = [
      {
        id: '1',
        type: 'campaign_started',
        title: 'Campaign "Q1 Outreach" started',
        description: 'Campaign launched with 150 contacts',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        status: 'success'
      },
      {
        id: '2',
        type: 'reply_received',
        title: 'New reply received',
        description: 'Positive reply from john@example.com',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        status: 'success'
      },
      {
        id: '3',
        type: 'email_sent',
        title: '25 emails sent',
        description: 'Daily batch completed successfully',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        status: 'success'
      },
      {
        id: '4',
        type: 'contact_added',
        title: '50 contacts imported',
        description: 'CSV import completed from "prospects.csv"',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: 'success'
      },
      {
        id: '5',
        type: 'account_connected',
        title: 'Email account connected',
        description: 'Gmail account sales@company.com connected successfully',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        status: 'success'
      }
    ]

    // In a real implementation, you might query actual activity data like:
    /*
    const { data: activities, error } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    */

    return createSuccessResponse(mockActivity)

  } catch (error) {
    return handleApiError(error)
  }
})