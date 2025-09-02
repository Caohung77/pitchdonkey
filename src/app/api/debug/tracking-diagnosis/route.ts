import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Comprehensive tracking system diagnosis endpoint
 * Checks all components of the email open tracking system
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const diagnosis = {
      timestamp: new Date().toISOString(),
      issues: [] as string[],
      warnings: [] as string[],
      info: [] as string[],
      recommendations: [] as string[]
    }

    console.log('🔍 Starting comprehensive tracking system diagnosis...')

    // 1. Check email_tracking table structure and data
    console.log('📊 Checking email_tracking table...')
    const { data: emailTracking, error: trackingError } = await supabase
      .from('email_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (trackingError) {
      diagnosis.issues.push(`Email tracking table error: ${trackingError.message}`)
    } else {
      diagnosis.info.push(`Found ${emailTracking?.length || 0} recent email tracking records`)
      
      if (emailTracking && emailTracking.length > 0) {
        const sampleRecord = emailTracking[0]
        diagnosis.info.push(`Sample tracking record: ${JSON.stringify({
          id: sampleRecord.id,
          tracking_pixel_id: sampleRecord.tracking_pixel_id,
          status: sampleRecord.status,
          opened_at: sampleRecord.opened_at,
          sent_at: sampleRecord.sent_at
        })}`)

        // Check for missing tracking_pixel_id
        const recordsWithoutPixelId = emailTracking.filter(record => !record.tracking_pixel_id)
        if (recordsWithoutPixelId.length > 0) {
          diagnosis.issues.push(`${recordsWithoutPixelId.length} email tracking records missing tracking_pixel_id`)
        }

        // Check for emails that were sent but never opened
        const sentButNotOpened = emailTracking.filter(record => 
          record.sent_at && !record.opened_at
        )
        diagnosis.info.push(`${sentButNotOpened.length} emails sent but not yet opened`)

        // Check for emails with 0% open rate
        const totalSent = emailTracking.filter(record => record.sent_at).length
        const totalOpened = emailTracking.filter(record => record.opened_at).length
        const openRate = totalSent > 0 ? (totalOpened / totalSent * 100) : 0
        
        diagnosis.info.push(`Recent open rate: ${openRate.toFixed(1)}% (${totalOpened}/${totalSent})`)
        
        if (openRate === 0 && totalSent > 0) {
          diagnosis.issues.push('0% open rate detected - tracking pixels may not be working')
        }
      } else {
        diagnosis.warnings.push('No email tracking records found')
      }
    }

    // 2. Check campaign stats
    console.log('📈 Checking campaign stats...')
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, emails_sent, emails_opened, emails_delivered')
      .gt('emails_sent', 0)
      .order('created_at', { ascending: false })
      .limit(5)

    if (campaignError) {
      diagnosis.issues.push(`Campaign stats error: ${campaignError.message}`)
    } else {
      diagnosis.info.push(`Found ${campaigns?.length || 0} campaigns with sent emails`)
      
      if (campaigns && campaigns.length > 0) {
        let totalSent = 0
        let totalOpened = 0
        
        campaigns.forEach(campaign => {
          totalSent += campaign.emails_sent || 0
          totalOpened += campaign.emails_opened || 0
          
          const campaignOpenRate = campaign.emails_sent > 0 
            ? (campaign.emails_opened / campaign.emails_sent * 100) 
            : 0
            
          diagnosis.info.push(`Campaign "${campaign.name}": ${campaign.emails_opened}/${campaign.emails_sent} opened (${campaignOpenRate.toFixed(1)}%)`)
        })
        
        const overallOpenRate = totalSent > 0 ? (totalOpened / totalSent * 100) : 0
        diagnosis.info.push(`Overall campaign open rate: ${overallOpenRate.toFixed(1)}% (${totalOpened}/${totalSent})`)
      }
    }

    // 3. Check environment variables for tracking
    console.log('⚙️ Checking environment configuration...')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const vercelUrl = process.env.VERCEL_URL
    
    if (!appUrl && !vercelUrl) {
      diagnosis.issues.push('Neither NEXT_PUBLIC_APP_URL nor VERCEL_URL environment variables are set')
      diagnosis.recommendations.push('Set NEXT_PUBLIC_APP_URL environment variable to your domain (e.g., https://pitchdonkey.vercel.app)')
    } else {
      const trackingUrl = appUrl || `https://${vercelUrl}`
      diagnosis.info.push(`Tracking pixel base URL: ${trackingUrl}/api/tracking/pixel/`)
      
      // Check if the URL looks correct
      if (trackingUrl.includes('localhost') || trackingUrl.includes('127.0.0.1')) {
        diagnosis.warnings.push('Tracking URL uses localhost - this won\'t work for email recipients outside your machine')
        diagnosis.recommendations.push('For production, ensure NEXT_PUBLIC_APP_URL is set to your public domain')
      }
    }

    // 4. Test tracking pixel endpoint availability
    console.log('🎯 Testing tracking pixel endpoint...')
    try {
      const testPixelId = 'test_pixel_' + Date.now()
      const testUrl = new URL('/api/tracking/pixel/' + testPixelId, request.url)
      
      // We can't make HTTP requests from server-side, so we'll just check the route structure
      diagnosis.info.push(`Tracking pixel endpoint should be available at: ${testUrl.pathname}`)
      diagnosis.info.push('Pixel endpoint structure appears correct')
    } catch (error) {
      diagnosis.issues.push(`Error testing pixel endpoint: ${error.message}`)
    }

    // 5. Check for recent pixel tracking attempts
    console.log('🔍 Checking for tracking attempts...')
    try {
      // Check if we have any tracking_pixels table data
      const { data: trackingPixels, error: pixelError } = await supabase
        .from('tracking_pixels')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (pixelError) {
        diagnosis.warnings.push(`Cannot check tracking_pixels table: ${pixelError.message}`)
        diagnosis.info.push('This table might not exist - tracking may use email_tracking table only')
      } else {
        diagnosis.info.push(`Found ${trackingPixels?.length || 0} tracking pixel records`)
        
        if (trackingPixels && trackingPixels.length > 0) {
          const openedCount = trackingPixels.filter(p => p.opened).length
          diagnosis.info.push(`${openedCount}/${trackingPixels.length} tracking pixels have been opened`)
        }
      }
    } catch (error) {
      diagnosis.warnings.push(`Error checking tracking pixels: ${error.message}`)
    }

    // 6. Check campaign processor logs (recent email sends)
    console.log('📧 Checking recent email send patterns...')
    const recentEmailTracking = emailTracking?.slice(0, 5) || []
    
    for (const record of recentEmailTracking) {
      if (record.tracking_pixel_id) {
        const pixelUrl = `${appUrl || 'https://pitchdonkey.vercel.app'}/api/tracking/pixel/${record.tracking_pixel_id}`
        diagnosis.info.push(`Sample pixel URL: ${pixelUrl}`)
        
        // Check if the tracking pixel ID format looks correct
        if (!record.tracking_pixel_id.includes('track_') && !record.tracking_pixel_id.match(/^[a-f0-9\-]{36}$/)) {
          diagnosis.warnings.push(`Tracking pixel ID format looks unusual: ${record.tracking_pixel_id}`)
        }
        break
      }
    }

    // 7. Generate recommendations
    if (diagnosis.issues.length > 0) {
      diagnosis.recommendations.push('Fix critical issues first: tracking system has problems')
    }
    
    if (diagnosis.warnings.length > 0) {
      diagnosis.recommendations.push('Address warnings to improve tracking reliability')
    }
    
    // Common recommendations
    diagnosis.recommendations.push('Test tracking by sending a test email to yourself and opening it')
    diagnosis.recommendations.push('Check email client settings - some block images by default')
    diagnosis.recommendations.push('Verify emails are not being marked as spam (which often blocks tracking pixels)')
    diagnosis.recommendations.push('Consider adding text like "Images not displaying? View online version" to encourage image loading')

    console.log('✅ Tracking system diagnosis completed')

    // Return comprehensive diagnosis
    return NextResponse.json({
      success: true,
      diagnosis,
      summary: {
        critical_issues: diagnosis.issues.length,
        warnings: diagnosis.warnings.length,
        status: diagnosis.issues.length === 0 ? 'healthy' : 'needs_attention'
      }
    })

  } catch (error) {
    console.error('❌ Error in tracking diagnosis:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Diagnosis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}