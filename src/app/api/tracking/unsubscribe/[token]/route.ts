import { NextRequest, NextResponse } from 'next/server'
import { emailTracker } from '@/lib/email-tracking'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const resolvedParams = await params
    const { token } = resolvedParams
    
    // Get user agent and IP address
    const userAgent = request.headers.get('user-agent') || undefined
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 
                     request.headers.get('x-real-ip') || 
                     request.ip || 
                     undefined

    // Process unsubscribe
    const result = await emailTracker.processUnsubscribe(token, ipAddress, userAgent)

    if (result.success) {
      // Return unsubscribe confirmation page
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribed Successfully</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              padding: 40px 20px;
              background-color: #f8fafc;
              color: #334155;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              text-align: center;
            }
            .success-icon {
              width: 64px;
              height: 64px;
              background: #10b981;
              border-radius: 50%;
              margin: 0 auto 24px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .success-icon svg {
              width: 32px;
              height: 32px;
              color: white;
            }
            h1 {
              color: #1e293b;
              margin-bottom: 16px;
            }
            p {
              line-height: 1.6;
              margin-bottom: 16px;
            }
            .email {
              background: #f1f5f9;
              padding: 8px 16px;
              border-radius: 4px;
              font-family: monospace;
              display: inline-block;
              margin: 8px 0;
            }
            .footer {
              margin-top: 32px;
              padding-top: 24px;
              border-top: 1px solid #e2e8f0;
              font-size: 14px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            
            <h1>${result.alreadyUnsubscribed ? 'Already Unsubscribed' : 'Successfully Unsubscribed'}</h1>
            
            ${result.alreadyUnsubscribed ? 
              '<p>You have already been unsubscribed from our mailing list.</p>' :
              '<p>You have been successfully unsubscribed from our mailing list.</p>'
            }
            
            ${result.email ? `<div class="email">${result.email}</div>` : ''}
            
            <p>You will no longer receive emails from us. If you believe this was done in error, please contact our support team.</p>
            
            <div class="footer">
              <p>This action was completed on ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
        </html>
      `

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } else {
      // Return error page
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribe Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              padding: 40px 20px;
              background-color: #f8fafc;
              color: #334155;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              text-align: center;
            }
            .error-icon {
              width: 64px;
              height: 64px;
              background: #ef4444;
              border-radius: 50%;
              margin: 0 auto 24px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .error-icon svg {
              width: 32px;
              height: 32px;
              color: white;
            }
            h1 {
              color: #1e293b;
              margin-bottom: 16px;
            }
            p {
              line-height: 1.6;
              margin-bottom: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            
            <h1>Unsubscribe Error</h1>
            <p>We were unable to process your unsubscribe request. The link may be invalid or expired.</p>
            <p>Please contact our support team if you continue to have issues.</p>
          </div>
        </body>
        </html>
      `

      return new NextResponse(html, {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      })
    }

  } catch (error) {
    console.error('Error processing unsubscribe:', error)
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #f8fafc;
            color: #334155;
            text-align: center;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Server Error</h1>
          <p>An unexpected error occurred. Please try again later or contact support.</p>
        </div>
      </body>
      </html>
    `

    return new NextResponse(html, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Handle one-click unsubscribe (List-Unsubscribe-Post header)
  return GET(request, { params })
}