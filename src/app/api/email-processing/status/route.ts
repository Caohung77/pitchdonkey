import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get IMAP connection status for user's email accounts
    const { data: connections } = await supabase
      .from('imap_connections')
      .select(`
        *,
        email_accounts (
          email,
          provider,
          status
        )
      `)
      .eq('user_id', user.id)

    // Get processing statistics
    const { data: processingJobs } = await supabase
      .from('email_processing_jobs')
      .select('status, job_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    // Get recent email classification stats
    const { data: recentEmails } = await supabase
      .from('incoming_emails')
      .select('classification_status, processing_status')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    // Calculate statistics
    const stats = {
      connections: {
        total: connections?.length || 0,
        active: connections?.filter(c => c.status === 'active').length || 0,
        inactive: connections?.filter(c => c.status === 'inactive').length || 0,
        errors: connections?.filter(c => c.status === 'error').length || 0
      },
      processing: {
        totalJobs: processingJobs?.length || 0,
        pending: processingJobs?.filter(j => j.status === 'pending').length || 0,
        running: processingJobs?.filter(j => j.status === 'running').length || 0,
        completed: processingJobs?.filter(j => j.status === 'completed').length || 0,
        failed: processingJobs?.filter(j => j.status === 'failed').length || 0
      },
      emails: {
        total: recentEmails?.length || 0,
        classified: recentEmails?.filter(e => e.classification_status !== 'unclassified').length || 0,
        unclassified: recentEmails?.filter(e => e.classification_status === 'unclassified').length || 0,
        processing: recentEmails?.filter(e => e.processing_status === 'processing').length || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        connections,
        stats,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error getting email processing status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}