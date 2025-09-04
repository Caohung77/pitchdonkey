import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    console.log('📊 Checking synced emails...')

    // Get recent synced emails
    const { data: emails, error } = await supabase
      .from('incoming_emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('❌ Error fetching emails:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch emails'
      }, { status: 500 })
    }

    // Get classification stats
    const { data: stats, error: statsError } = await supabase
      .from('incoming_emails')
      .select('classification_status, processing_status')

    if (statsError) {
      console.error('❌ Error fetching stats:', statsError)
    }

    const classificationStats = stats?.reduce((acc, email) => {
      acc[email.classification_status] = (acc[email.classification_status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const processingStats = stats?.reduce((acc, email) => {
      acc[email.processing_status] = (acc[email.processing_status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    console.log(`📈 Found ${emails?.length || 0} recent emails`)
    console.log('📊 Classification stats:', classificationStats)
    console.log('🔄 Processing stats:', processingStats)

    return NextResponse.json({
      success: true,
      data: {
        recentEmails: emails?.map(email => ({
          id: email.id,
          from: email.from_address,
          subject: email.subject,
          dateReceived: email.date_received,
          classificationStatus: email.classification_status,
          processingStatus: email.processing_status,
          confidence: email.classification_confidence
        })) || [],
        totalEmails: stats?.length || 0,
        classificationStats,
        processingStats
      }
    })

  } catch (error) {
    console.error('❌ Error checking synced emails:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to check synced emails' 
      },
      { status: 500 }
    )
  }
}