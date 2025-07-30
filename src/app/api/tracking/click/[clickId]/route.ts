import { NextRequest, NextResponse } from 'next/server'
import { emailTracker } from '@/lib/email-tracking'

export async function GET(
  request: NextRequest,
  { params }: { params: { clickId: string } }
) {
  try {
    const { clickId } = params
    
    // Get user agent and IP address
    const userAgent = request.headers.get('user-agent') || undefined
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 
                     request.headers.get('x-real-ip') || 
                     request.ip || 
                     undefined

    // Track the click event
    const result = await emailTracker.trackClick(clickId, userAgent, ipAddress)

    if (result.success && result.redirectUrl) {
      // Redirect to original URL
      return NextResponse.redirect(result.redirectUrl, 302)
    } else {
      // Return error page if tracking fails
      return new NextResponse('Link not found', { status: 404 })
    }

  } catch (error) {
    console.error('Error tracking click:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}