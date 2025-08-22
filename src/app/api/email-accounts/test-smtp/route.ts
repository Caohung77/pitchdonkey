import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'
import nodemailer from 'nodemailer'

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { host, port, secure, username, password, testEmail } = body

    // Validate required fields
    if (!host || !port || !username || !password) {
      return handleApiError(new Error('Missing required SMTP configuration'))
    }

    const result = {
      connection: { success: false, message: '', details: null },
      testEmail: null
    }

    try {
      // Test SMTP connection
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: secure === true,
        auth: {
          user: username,
          pass: password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      })

      // Verify connection
      await transporter.verify()
      
      result.connection = {
        success: true,
        message: 'SMTP connection successful',
        details: {
          host,
          port: parseInt(port),
          secure: secure === true,
          username
        }
      }

      // Send test email if requested
      if (testEmail) {
        try {
          const info = await transporter.sendMail({
            from: username,
            to: testEmail,
            subject: 'ColdReach Pro - SMTP Test Email',
            text: `This is a test email sent from ColdReach Pro to verify your SMTP configuration.

Configuration Details:
- Host: ${host}
- Port: ${port}
- Security: ${secure ? 'SSL/TLS' : 'STARTTLS'}
- Username: ${username}

If you received this email, your SMTP configuration is working correctly!

Best regards,
ColdReach Pro Team`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">ColdReach Pro - SMTP Test Email</h2>
                <p>This is a test email sent from ColdReach Pro to verify your SMTP configuration.</p>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Configuration Details:</h3>
                  <ul>
                    <li><strong>Host:</strong> ${host}</li>
                    <li><strong>Port:</strong> ${port}</li>
                    <li><strong>Security:</strong> ${secure ? 'SSL/TLS' : 'STARTTLS'}</li>
                    <li><strong>Username:</strong> ${username}</li>
                  </ul>
                </div>
                
                <p>If you received this email, your SMTP configuration is working correctly!</p>
                
                <p style="color: #6b7280;">
                  Best regards,<br>
                  ColdReach Pro Team
                </p>
              </div>
            `
          })

          result.testEmail = {
            success: true,
            message: 'Test email sent successfully',
            messageId: info.messageId,
            to: testEmail
          }
        } catch (emailError) {
          result.testEmail = {
            success: false,
            message: `Failed to send test email: ${emailError.message}`,
            to: testEmail
          }
        }
      }

    } catch (connectionError) {
      result.connection = {
        success: false,
        message: `SMTP connection failed: ${connectionError.message}`,
        details: {
          host,
          port: parseInt(port),
          secure: secure === true,
          username,
          error: connectionError.code || 'UNKNOWN_ERROR'
        }
      }
    }

    return createSuccessResponse(result)

  } catch (error) {
    return handleApiError(error)
  }
})