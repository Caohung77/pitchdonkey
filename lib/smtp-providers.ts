import nodemailer from 'nodemailer'
import { createConnection } from 'net'
import { encryptSMTPConfig, decryptSMTPConfig } from './encryption'

export interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  auth?: {
    user: string
    pass: string
  }
}

export interface IMAPConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
}

export interface SMTPProvider {
  id: string
  name: string
  description: string
  smtp: {
    host: string
    port: number
    secure: boolean
  }
  imap?: {
    host: string
    port: number
    secure: boolean
  }
  authType: 'password' | 'oauth'
  setupInstructions: string[]
}

// Common SMTP provider configurations
export const SMTP_PROVIDERS: SMTPProvider[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Google Gmail SMTP configuration',
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS
    },
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
    },
    authType: 'password',
    setupInstructions: [
      'Enable 2-factor authentication on your Google account',
      'Generate an App Password for this application',
      'Use your Gmail address as username',
      'Use the App Password (not your regular password)',
    ],
  },
  {
    id: 'outlook',
    name: 'Outlook/Hotmail',
    description: 'Microsoft Outlook SMTP configuration',
    smtp: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false, // STARTTLS
    },
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
    },
    authType: 'password',
    setupInstructions: [
      'Enable 2-factor authentication on your Microsoft account',
      'Generate an App Password for this application',
      'Use your Outlook email address as username',
      'Use the App Password (not your regular password)',
    ],
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    description: 'Yahoo Mail SMTP configuration',
    smtp: {
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false, // STARTTLS
    },
    imap: {
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true,
    },
    authType: 'password',
    setupInstructions: [
      'Enable 2-factor authentication on your Yahoo account',
      'Generate an App Password for this application',
      'Use your Yahoo email address as username',
      'Use the App Password (not your regular password)',
    ],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'SendGrid SMTP relay service',
    smtp: {
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
    },
    authType: 'password',
    setupInstructions: [
      'Create a SendGrid account and verify your domain',
      'Generate an API key with Mail Send permissions',
      'Use "apikey" as the username',
      'Use your API key as the password',
    ],
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'Mailgun SMTP relay service',
    smtp: {
      host: 'smtp.mailgun.org',
      port: 587,
      secure: false,
    },
    authType: 'password',
    setupInstructions: [
      'Create a Mailgun account and add your domain',
      'Find your SMTP credentials in the Mailgun dashboard',
      'Use the provided SMTP username',
      'Use the provided SMTP password',
    ],
  },
  {
    id: 'custom',
    name: 'Custom SMTP',
    description: 'Custom SMTP server configuration',
    smtp: {
      host: '',
      port: 587,
      secure: false,
    },
    authType: 'password',
    setupInstructions: [
      'Get SMTP settings from your email provider',
      'Enter the SMTP host and port',
      'Choose the correct security setting (SSL/TLS)',
      'Use your email credentials for authentication',
    ],
  },
]

// Export alias for backward compatibility
export const SMTP_PROVIDER_TEMPLATES = SMTP_PROVIDERS

// Helper function to get recommended settings for a provider
export function getRecommendedSettings(providerId: string): {
  smtp: SMTPConfig | null
  imap: IMAPConfig | null
  instructions: string[]
} {
  const provider = SMTP_PROVIDERS.find(p => p.id === providerId)
  
  if (!provider) {
    return {
      smtp: null,
      imap: null,
      instructions: []
    }
  }

  const smtp: SMTPConfig = {
    host: provider.smtp.host,
    port: provider.smtp.port,
    secure: provider.smtp.secure,
    username: '', // To be filled by user
    password: '', // To be filled by user
  }

  const imap: IMAPConfig | null = provider.imap ? {
    host: provider.imap.host,
    port: provider.imap.port,
    secure: provider.imap.secure,
    username: '', // To be filled by user
    password: '', // To be filled by user
  } : null

  return {
    smtp,
    imap,
    instructions: provider.setupInstructions
  }
}

export class SMTPService {
  static async testConnection(config: SMTPConfig): Promise<{
    success: boolean
    message: string
    details?: any
  }> {
    try {
      // First test basic connectivity
      const connectivityTest = await this.testConnectivity(config.host, config.port)
      if (!connectivityTest.success) {
        return connectivityTest
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.username,
          pass: config.password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      })

      // Verify connection
      await transporter.verify()

      return {
        success: true,
        message: 'SMTP connection successful',
        details: {
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: 'authenticated',
        },
      }
    } catch (error: any) {
      console.error('SMTP connection test failed:', error)
      
      let message = 'SMTP connection failed'
      if (error.code === 'EAUTH') {
        message = 'Authentication failed. Please check your username and password.'
      } else if (error.code === 'ECONNECTION') {
        message = 'Cannot connect to SMTP server. Please check host and port.'
      } else if (error.code === 'ETIMEDOUT') {
        message = 'Connection timed out. Please check your network connection.'
      } else if (error.message) {
        message = error.message
      }

      return {
        success: false,
        message,
        details: {
          error: error.code || 'UNKNOWN',
          host: config.host,
          port: config.port,
        },
      }
    }
  }

  static async testConnectivity(host: string, port: number): Promise<{
    success: boolean
    message: string
  }> {
    return new Promise((resolve) => {
      const socket = createConnection({ host, port, timeout: 5000 })
      
      socket.on('connect', () => {
        socket.destroy()
        resolve({
          success: true,
          message: 'Port is reachable',
        })
      })

      socket.on('timeout', () => {
        socket.destroy()
        resolve({
          success: false,
          message: 'Connection timed out',
        })
      })

      socket.on('error', (error: any) => {
        socket.destroy()
        resolve({
          success: false,
          message: `Connection failed: ${error.message}`,
        })
      })
    })
  }

  static async sendTestEmail(config: SMTPConfig, to: string): Promise<{
    success: boolean
    message: string
    messageId?: string
  }> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.username,
          pass: config.password,
        },
      })

      const info = await transporter.sendMail({
        from: config.username,
        to,
        subject: 'Eisbrief - SMTP Test Email',
        text: 'This is a test email to verify your SMTP configuration is working correctly.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">SMTP Configuration Test</h2>
            <p>Congratulations! Your SMTP configuration is working correctly.</p>
            <p>This test email was sent from Eisbrief to verify your email account setup.</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              If you didn't expect this email, you can safely ignore it.
            </p>
          </div>
        `,
      })

      return {
        success: true,
        message: 'Test email sent successfully',
        messageId: info.messageId,
      }
    } catch (error: any) {
      console.error('Test email send failed:', error)
      
      return {
        success: false,
        message: error.message || 'Failed to send test email',
      }
    }
  }

  static validateConfig(config: Partial<SMTPConfig>): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!config.host || config.host.trim() === '') {
      errors.push('SMTP host is required')
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Valid SMTP port (1-65535) is required')
    }

    if (config.secure === undefined) {
      errors.push('Security setting (SSL/TLS) is required')
    }

    if (!config.username || config.username.trim() === '') {
      errors.push('Username is required')
    }

    if (!config.password || config.password.trim() === '') {
      errors.push('Password is required')
    }

    // Validate email format for username (common case)
    if (config.username && config.username.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(config.username)) {
        errors.push('Username appears to be an email but format is invalid')
      }
    }

    // Validate common port/security combinations
    if (config.port && config.secure !== undefined) {
      if (config.port === 465 && !config.secure) {
        errors.push('Port 465 typically requires SSL/TLS to be enabled')
      }
      if (config.port === 587 && config.secure) {
        errors.push('Port 587 typically uses STARTTLS (SSL/TLS disabled)')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  static getProviderTemplate(providerId: string): SMTPProvider | null {
    return SMTP_PROVIDERS.find(p => p.id === providerId) || null
  }

  static detectProvider(host: string): SMTPProvider | null {
    const hostLower = host.toLowerCase()
    
    for (const provider of SMTP_PROVIDERS) {
      if (provider.smtp.host && hostLower.includes(provider.smtp.host.toLowerCase())) {
        return provider
      }
      
      // Check for common patterns
      if (hostLower.includes('gmail') && provider.id === 'gmail') return provider
      if (hostLower.includes('outlook') && provider.id === 'outlook') return provider
      if (hostLower.includes('yahoo') && provider.id === 'yahoo') return provider
      if (hostLower.includes('sendgrid') && provider.id === 'sendgrid') return provider
      if (hostLower.includes('mailgun') && provider.id === 'mailgun') return provider
    }

    return null
  }

  static encryptConfig(config: SMTPConfig): string {
    return encryptSMTPConfig(config)
  }

  static decryptConfig(encryptedConfig: string): SMTPConfig {
    return decryptSMTPConfig(encryptedConfig)
  }
}

export class IMAPService {
  static async testConnection(config: IMAPConfig): Promise<{
    success: boolean
    message: string
    details?: any
  }> {
    try {
      // For now, we'll do basic connectivity test
      // In a full implementation, you'd use an IMAP library like 'imap'
      const connectivityTest = await SMTPService.testConnectivity(config.host, config.port)
      
      if (!connectivityTest.success) {
        return {
          success: false,
          message: `IMAP ${connectivityTest.message}`,
        }
      }

      return {
        success: true,
        message: 'IMAP connection test passed (basic connectivity)',
        details: {
          host: config.host,
          port: config.port,
          secure: config.secure,
          note: 'Full IMAP authentication test not implemented',
        },
      }
    } catch (error: any) {
      return {
        success: false,
        message: `IMAP connection failed: ${error.message}`,
      }
    }
  }

  static validateConfig(config: Partial<IMAPConfig>): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!config.host || config.host.trim() === '') {
      errors.push('IMAP host is required')
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Valid IMAP port (1-65535) is required')
    }

    if (config.secure === undefined) {
      errors.push('Security setting (SSL/TLS) is required')
    }

    if (!config.username || config.username.trim() === '') {
      errors.push('Username is required')
    }

    if (!config.password || config.password.trim() === '') {
      errors.push('Password is required')
    }

    // Common IMAP port validation
    if (config.port) {
      if (config.port === 993 && !config.secure) {
        errors.push('Port 993 typically requires SSL/TLS to be enabled')
      }
      if (config.port === 143 && config.secure) {
        errors.push('Port 143 typically uses STARTTLS (SSL/TLS disabled)')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
