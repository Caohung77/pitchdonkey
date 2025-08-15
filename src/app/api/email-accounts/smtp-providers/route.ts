import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, handleApiError } from '@/lib/api-auth'

const SMTP_PROVIDERS = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Google Gmail SMTP configuration',
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false
    },
    authType: 'app_password',
    setupInstructions: [
      'Enable 2-factor authentication on your Google account',
      'Generate an App Password in Google Account settings',
      'Use your Gmail address as username',
      'Use the App Password (not your regular password)'
    ]
  },
  {
    id: 'outlook',
    name: 'Outlook/Hotmail',
    description: 'Microsoft Outlook SMTP configuration',
    smtp: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false
    },
    authType: 'password',
    setupInstructions: [
      'Use your full Outlook email address as username',
      'Use your regular Outlook password',
      'Ensure SMTP is enabled in your Outlook settings'
    ]
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    description: 'Yahoo Mail SMTP configuration',
    smtp: {
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false
    },
    authType: 'app_password',
    setupInstructions: [
      'Enable 2-step verification in Yahoo Account Security',
      'Generate an App Password for Mail',
      'Use your Yahoo email address as username',
      'Use the App Password for authentication'
    ]
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'SendGrid SMTP relay service',
    smtp: {
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false
    },
    authType: 'api_key',
    setupInstructions: [
      'Create a SendGrid account and verify your domain',
      'Generate an API key with Mail Send permissions',
      'Use "apikey" as the username',
      'Use your API key as the password'
    ]
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'Mailgun SMTP service',
    smtp: {
      host: 'smtp.mailgun.org',
      port: 587,
      secure: false
    },
    authType: 'api_key',
    setupInstructions: [
      'Create a Mailgun account and add your domain',
      'Get your SMTP credentials from the Mailgun dashboard',
      'Use the provided SMTP username',
      'Use the provided SMTP password'
    ]
  },
  {
    id: 'amazon_ses',
    name: 'Amazon SES',
    description: 'Amazon Simple Email Service',
    smtp: {
      host: 'email-smtp.us-east-1.amazonaws.com',
      port: 587,
      secure: false
    },
    authType: 'access_key',
    setupInstructions: [
      'Set up Amazon SES and verify your domain',
      'Create SMTP credentials in the SES console',
      'Use the SMTP username from AWS',
      'Use the SMTP password from AWS'
    ]
  }
]

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    return createSuccessResponse(SMTP_PROVIDERS)
  } catch (error) {
    return handleApiError(error)
  }
})