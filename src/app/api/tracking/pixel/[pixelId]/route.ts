import { NextRequest, NextResponse } from 'next/server'
import { emailTracker } from '@/lib/email-tracking'

// 1x1 transparent pixel image data
const PIXEL_DATA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==',
  'base64'
)

export async function GET(
  request: NextRequest,
  { params }: { params: { pixelId: string } }
) {
  try {
    const { pixelId } = params
    
    // Get user agent and IP address
    const userAgent = request.headers.get('user-agent') || undefined
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 
                     request.headers.get('x-real-ip') || 
                     request.ip || 
                     undefined

    // Track the open event
    await emailTracker.trackOpen(pixelId, userAgent, ipAddress)

    // Return 1x1 transparent pixel
    return new NextResponse(PIXEL_DATA, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': PIXEL_DATA.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error tracking pixel:', error)
    
    // Still return pixel even if tracking fails
    return new NextResponse(PIXEL_DATA, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': PIXEL_DATA.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}