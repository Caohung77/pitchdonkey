import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    console.log('📧 Checking actual email content from recent campaigns...')

    // Get recent email sends to examine their content
    const { data: emailSends, error: sendsError } = await supabase
      .from('email_sends')
      .select(`
        id,
        message_id,
        subject,
        recipient_email,
        campaign_id,
        created_at,
        campaigns:campaign_id (
          id,
          name,
          email_sequence
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (sendsError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch email sends',
        details: sendsError.message
      }, { status: 500 })
    }

    const results = {
      totalEmailsSent: emailSends?.length || 0,
      emailAnalysis: [],
      linkAnalysis: {
        totalLinksFound: 0,
        trackingLinksFound: 0,
        originalLinksFound: 0,
        linkTypes: {}
      }
    }

    // Analyze each email's content
    for (const email of emailSends || []) {
      const campaign = email.campaigns
      if (!campaign?.email_sequence) continue

      // Get the email content from the campaign sequence
      const emailSequence = campaign.email_sequence
      let emailContent = ''

      // Find the first step's content (assuming it's what was sent)
      if (Array.isArray(emailSequence) && emailSequence.length > 0) {
        emailContent = emailSequence[0]?.content_template || ''
      }

      // Analyze links in the content
      const linkMatches = emailContent.match(/<a[^>]+href\s*=\s*['"]([^'"]+)['"][^>]*>/gi) || []
      const trackingLinks = linkMatches.filter(link => link.includes('/api/tracking/click/'))
      const originalLinks = linkMatches.filter(link => !link.includes('/api/tracking/click/') &&
                                                        !link.includes('mailto:') &&
                                                        !link.includes('tel:'))

      const emailAnalysis = {
        emailId: email.id,
        messageId: email.message_id,
        campaignId: email.campaign_id,
        campaignName: campaign.name,
        recipient: email.recipient_email,
        subject: email.subject,
        sentAt: email.created_at,
        contentLength: emailContent.length,
        totalLinks: linkMatches.length,
        trackingLinks: trackingLinks.length,
        originalLinks: originalLinks.length,
        linkDetails: linkMatches.map(link => {
          const hrefMatch = link.match(/href\s*=\s*['"]([^'"]+)['"]/i)
          const href = hrefMatch ? hrefMatch[1] : 'unknown'
          return {
            fullTag: link,
            href: href,
            isTrackingLink: href.includes('/api/tracking/click/'),
            linkType: href.includes('mailto:') ? 'mailto' :
                     href.includes('tel:') ? 'tel' :
                     href.includes('/api/tracking/click/') ? 'tracking' :
                     href.startsWith('http') ? 'external' : 'other'
          }
        }),
        hasTrackingLinks: trackingLinks.length > 0,
        sampleContent: emailContent.substring(0, 500) + (emailContent.length > 500 ? '...' : '')
      }

      results.emailAnalysis.push(emailAnalysis)
      results.linkAnalysis.totalLinksFound += linkMatches.length
      results.linkAnalysis.trackingLinksFound += trackingLinks.length
      results.linkAnalysis.originalLinksFound += originalLinks.length
    }

    // Categorize link types
    const allLinkTypes = results.emailAnalysis.flatMap(email =>
      email.linkDetails.map(link => link.linkType)
    )

    results.linkAnalysis.linkTypes = allLinkTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    // Analysis summary
    const hasAnyTrackingLinks = results.linkAnalysis.trackingLinksFound > 0
    const hasOnlyOriginalLinks = results.linkAnalysis.originalLinksFound > 0 && results.linkAnalysis.trackingLinksFound === 0

    let diagnosis = 'Unknown issue'
    if (hasAnyTrackingLinks) {
      diagnosis = 'Link rewriting appears to be working - tracking links found in email content'
    } else if (hasOnlyOriginalLinks) {
      diagnosis = 'Link rewriting is NOT working - only original links found, no tracking links'
    } else if (results.linkAnalysis.totalLinksFound === 0) {
      diagnosis = 'No links found in email content'
    }

    return NextResponse.json({
      success: true,
      message: 'Email content analysis completed',
      timestamp: new Date().toISOString(),
      diagnosis,
      results,
      recommendations: hasAnyTrackingLinks ? [
        'Link rewriting appears to be working',
        'Check if click tracking API endpoint is working',
        'Verify database permissions for recording clicks',
        'Test the /api/tracking/click/[clickId] endpoint directly'
      ] : [
        'Link rewriting is not working properly',
        'Check if EmailLinkRewriter is being called in campaign execution',
        'Verify email sending pipeline includes link processing',
        'Check for errors in email content processing'
      ]
    })

  } catch (error) {
    console.error('💥 Email content check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Email content check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}