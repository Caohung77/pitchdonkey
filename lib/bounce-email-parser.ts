/**
 * Bounce Email Parser
 *
 * Parses bounce/NDR (Non-Delivery Report) / DSN (Delivery Status Notification) emails
 * to extract bounce information and correlate with sent emails.
 *
 * Based on RFC 3464 (DSN format) and RFC 3463 (Enhanced Status Codes)
 */

export interface BounceInfo {
  // Bounce classification
  bounceType: 'hard' | 'soft' | 'complaint' | 'transient' | 'unknown'
  bounceCategory: 'invalid_recipient' | 'mailbox_full' | 'message_too_large' | 'content_rejected' | 'network_error' | 'policy_violation' | 'spam_complaint' | 'unknown'

  // Diagnostic information
  diagnosticCode: string | null // Full error message from mail server
  statusCode: string | null // SMTP status code (e.g., "550 5.1.1")
  enhancedStatusCode: string | null // Enhanced status code (e.g., "5.1.1")

  // Correlation fields
  originalRecipient: string | null // The email address that bounced
  originalMessageId: string | null // Message-ID from original email
  returnPath: string | null // Return-Path header (for VERP matching)

  // Metadata
  reportingMTA: string | null // Mail server that generated the bounce
  remoteMTA: string | null // Remote mail server that rejected the email
  action: string | null // Action taken (e.g., "failed", "delayed")

  // Parsed details
  parsedDetails: {
    subject?: string
    dateReceived?: string
    rawBounceHeaders?: Record<string, string>
  }
}

export interface ParseResult {
  isBounce: boolean
  bounceInfo: BounceInfo | null
  confidence: number // 0-1 confidence score
  rawDiagnostic: string
}

/**
 * Parse an email to detect if it's a bounce and extract bounce information
 */
export async function parseBounceEmail(email: {
  subject: string | null
  from_address: string
  text_content: string | null
  html_content: string | null
  in_reply_to: string | null
  headers?: Record<string, string>
}): Promise<ParseResult> {
  const fullContent = [email.text_content, email.html_content].filter(Boolean).join('\n')

  // Initialize result
  const result: ParseResult = {
    isBounce: false,
    bounceInfo: null,
    confidence: 0,
    rawDiagnostic: fullContent.substring(0, 500)
  }

  // Check if this looks like a bounce email
  const bounceIndicators = detectBounceIndicators(email, fullContent)

  if (!bounceIndicators.isBounce) {
    return result
  }

  result.isBounce = true
  result.confidence = bounceIndicators.confidence

  // Extract bounce information
  const bounceInfo: BounceInfo = {
    bounceType: 'unknown',
    bounceCategory: 'unknown',
    diagnosticCode: null,
    statusCode: null,
    enhancedStatusCode: null,
    originalRecipient: null,
    originalMessageId: email.in_reply_to || null,
    returnPath: null,
    reportingMTA: null,
    remoteMTA: null,
    action: null,
    parsedDetails: {
      subject: email.subject || undefined,
      dateReceived: new Date().toISOString()
    }
  }

  // Extract original recipient email
  bounceInfo.originalRecipient = extractOriginalRecipient(fullContent, email)

  // Extract status codes
  const statusCodes = extractStatusCodes(fullContent)
  bounceInfo.statusCode = statusCodes.smtp
  bounceInfo.enhancedStatusCode = statusCodes.enhanced

  // Extract diagnostic code/error message
  bounceInfo.diagnosticCode = extractDiagnosticCode(fullContent)

  // Extract VERP information from Return-Path or envelope sender
  bounceInfo.returnPath = extractReturnPath(email, fullContent)

  // Extract reporting and remote MTAs
  const mtaInfo = extractMTAInfo(fullContent)
  bounceInfo.reportingMTA = mtaInfo.reporting
  bounceInfo.remoteMTA = mtaInfo.remote

  // Classify bounce type based on status code and error messages
  const classification = classifyBounce(bounceInfo.statusCode, bounceInfo.enhancedStatusCode, bounceInfo.diagnosticCode)
  bounceInfo.bounceType = classification.bounceType
  bounceInfo.bounceCategory = classification.category

  result.bounceInfo = bounceInfo

  return result
}

/**
 * Detect if an email is a bounce based on various indicators
 */
function detectBounceIndicators(
  email: { subject: string | null; from_address: string },
  content: string
): { isBounce: boolean; confidence: number } {
  let confidence = 0
  const indicators: string[] = []

  // Check From address for typical bounce senders
  const bounceSenders = [
    'mailer-daemon',
    'postmaster',
    'mail delivery',
    'delivery status',
    'noreply',
    'no-reply',
    'bounce',
    'return',
    'automated'
  ]

  const fromLower = email.from_address.toLowerCase()
  if (bounceSenders.some(sender => fromLower.includes(sender))) {
    confidence += 0.4
    indicators.push('bounce_sender')
  }

  // Check subject line for bounce keywords
  const subject = (email.subject || '').toLowerCase()
  const bounceSubjects = [
    'delivery status notification',
    'returned mail',
    'undelivered',
    'failure notice',
    'delivery failure',
    'mail delivery failed',
    'undeliverable',
    'not delivered',
    'bounce',
    'rejected',
    'permanent error'
  ]

  if (bounceSubjects.some(keyword => subject.includes(keyword))) {
    confidence += 0.4
    indicators.push('bounce_subject')
  }

  // Check content for bounce patterns
  const bouncePatterns = [
    /delivery.*failed/i,
    /message.*could not be delivered/i,
    /recipient address rejected/i,
    /user.*unknown/i,
    /mailbox.*full/i,
    /permanent.*error/i,
    /status:\s*5\.\d+\.\d+/i, // Enhanced status codes starting with 5 (permanent failure)
    /status:\s*4\.\d+\.\d+/i, // Enhanced status codes starting with 4 (transient failure)
    /smtp.*error/i,
    /550.*5\.1\.1/i, // Classic "user unknown" error
    /diagnostic-code:/i, // DSN format indicator
    /action:\s*failed/i,
    /final-recipient:/i
  ]

  const matchedPatterns = bouncePatterns.filter(pattern => pattern.test(content))
  if (matchedPatterns.length > 0) {
    confidence += Math.min(0.3, matchedPatterns.length * 0.1)
    indicators.push(`${matchedPatterns.length}_bounce_patterns`)
  }

  // If confidence is high enough, it's likely a bounce
  const isBounce = confidence >= 0.5

  return { isBounce, confidence: Math.min(1, confidence) }
}

/**
 * Extract the original recipient email address from bounce content
 */
function extractOriginalRecipient(content: string, email: any): string | null {
  // Try multiple extraction methods

  // 1. RFC 3464 Final-Recipient field
  const finalRecipientMatch = content.match(/Final-Recipient:\s*(?:rfc822;)?\s*([^\s<>]+@[^\s<>]+)/i)
  if (finalRecipientMatch) {
    return finalRecipientMatch[1].trim()
  }

  // 2. Original-Recipient field
  const originalRecipientMatch = content.match(/Original-Recipient:\s*(?:rfc822;)?\s*([^\s<>]+@[^\s<>]+)/i)
  if (originalRecipientMatch) {
    return originalRecipientMatch[1].trim()
  }

  // 3. Look for "to: email@domain.com" pattern
  const toMatch = content.match(/(?:to|recipient|rcpt to):\s*<?([^\s<>]+@[^\s<>]+)>?/i)
  if (toMatch) {
    return toMatch[1].trim()
  }

  // 4. Extract from VERP-encoded Return-Path (e.g., bounce+campaign_id+contact_email@domain.com)
  if (email.to_address) {
    const verpMatch = email.to_address.match(/bounce\+[^+]+\+([^@]+)@/)
    if (verpMatch) {
      // Decode the email from VERP format
      const encodedEmail = verpMatch[1].replace(/=/g, '@')
      return encodedEmail
    }
  }

  // 5. Look for email addresses in error messages
  const emailMatches = content.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/g)
  if (emailMatches && emailMatches.length > 0) {
    // Filter out common system addresses
    const filtered = emailMatches
      .map(e => e.replace(/[<>]/g, ''))
      .filter(e => !e.includes('mailer-daemon') && !e.includes('postmaster') && !e.includes('noreply'))

    if (filtered.length > 0) {
      return filtered[0]
    }
  }

  return null
}

/**
 * Extract SMTP and enhanced status codes
 */
function extractStatusCodes(content: string): {
  smtp: string | null
  enhanced: string | null
} {
  const result = { smtp: null as string | null, enhanced: null as string | null }

  // Extract enhanced status code (e.g., "5.1.1", "4.2.2")
  const enhancedMatch = content.match(/(?:status|Status):\s*(\d+\.\d+\.\d+)/i)
  if (enhancedMatch) {
    result.enhanced = enhancedMatch[1]
  }

  // Extract SMTP status code (e.g., "550", "421")
  const smtpMatch = content.match(/\b(4\d{2}|5\d{2})\s+(\d+\.\d+\.\d+)?/i)
  if (smtpMatch) {
    result.smtp = smtpMatch[0]
  }

  // If we found enhanced code but not SMTP, try to derive it
  if (result.enhanced && !result.smtp) {
    const firstDigit = result.enhanced.charAt(0)
    if (firstDigit === '5') {
      result.smtp = '550' // Permanent failure
    } else if (firstDigit === '4') {
      result.smtp = '450' // Transient failure
    }
  }

  return result
}

/**
 * Extract diagnostic code/error message
 */
function extractDiagnosticCode(content: string): string | null {
  // Try RFC 3464 Diagnostic-Code field
  const diagnosticMatch = content.match(/Diagnostic-Code:\s*(?:smtp;)?\s*(.+?)(?:\n|$)/i)
  if (diagnosticMatch) {
    return diagnosticMatch[1].trim()
  }

  // Try to find error messages with SMTP codes
  const errorMatch = content.match(/((?:4|5)\d{2}\s+(?:\d+\.\d+\.\d+\s+)?[^\n]+)/i)
  if (errorMatch) {
    return errorMatch[1].trim()
  }

  // Look for common error patterns
  const errorPatterns = [
    /user.*unknown/i,
    /recipient.*rejected/i,
    /mailbox.*full/i,
    /message.*too large/i,
    /content.*rejected/i,
    /spam.*detected/i,
    /blocked/i
  ]

  for (const pattern of errorPatterns) {
    const match = content.match(pattern)
    if (match) {
      // Extract surrounding context (up to 100 chars)
      const index = content.indexOf(match[0])
      const start = Math.max(0, index - 50)
      const end = Math.min(content.length, index + match[0].length + 50)
      return content.substring(start, end).trim()
    }
  }

  return null
}

/**
 * Extract Return-Path for VERP matching
 */
function extractReturnPath(email: any, content: string): string | null {
  // Check email headers if available
  if (email.headers && email.headers['Return-Path']) {
    return email.headers['Return-Path']
  }

  // Try to extract from content
  const returnPathMatch = content.match(/Return-Path:\s*<?([^\s<>]+)>?/i)
  if (returnPathMatch) {
    return returnPathMatch[1].trim()
  }

  // Use the to_address if it's a bounce address
  if (email.to_address && email.to_address.includes('bounce')) {
    return email.to_address
  }

  return null
}

/**
 * Extract MTA (Mail Transfer Agent) information
 */
function extractMTAInfo(content: string): {
  reporting: string | null
  remote: string | null
} {
  const result = { reporting: null as string | null, remote: null as string | null }

  // Extract Reporting-MTA
  const reportingMatch = content.match(/Reporting-MTA:\s*(?:dns;)?\s*([^\s]+)/i)
  if (reportingMatch) {
    result.reporting = reportingMatch[1].trim()
  }

  // Extract Remote-MTA
  const remoteMatch = content.match(/Remote-MTA:\s*(?:dns;)?\s*([^\s]+)/i)
  if (remoteMatch) {
    result.remote = remoteMatch[1].trim()
  }

  return result
}

/**
 * Classify bounce type based on status codes and error messages
 */
function classifyBounce(
  smtpCode: string | null,
  enhancedCode: string | null,
  diagnostic: string | null
): {
  bounceType: 'hard' | 'soft' | 'complaint' | 'transient' | 'unknown'
  category: BounceInfo['bounceCategory']
} {
  const diagnosticLower = (diagnostic || '').toLowerCase()

  // Check for spam complaints first
  if (diagnosticLower.includes('spam') || diagnosticLower.includes('blocked') || diagnosticLower.includes('blacklist')) {
    return { bounceType: 'complaint', category: 'spam_complaint' }
  }

  // Determine bounce type based on enhanced status code
  if (enhancedCode) {
    const firstDigit = enhancedCode.charAt(0)

    // Permanent failures (5.x.x)
    if (firstDigit === '5') {
      const category = categorizePermanentBounce(enhancedCode, diagnosticLower)
      return { bounceType: 'hard', category }
    }

    // Transient failures (4.x.x)
    if (firstDigit === '4') {
      const category = categorizeTransientBounce(enhancedCode, diagnosticLower)
      return { bounceType: 'soft', category }
    }
  }

  // Fall back to SMTP code
  if (smtpCode) {
    const code = parseInt(smtpCode.substring(0, 3))

    if (code >= 500 && code < 600) {
      // Permanent failure
      const category = categorizePermanentBounce(smtpCode, diagnosticLower)
      return { bounceType: 'hard', category }
    }

    if (code >= 400 && code < 500) {
      // Transient failure
      const category = categorizeTransientBounce(smtpCode, diagnosticLower)
      return { bounceType: 'soft', category }
    }
  }

  // Analyze diagnostic message
  if (diagnostic) {
    if (diagnosticLower.includes('user') || diagnosticLower.includes('unknown') || diagnosticLower.includes('not exist')) {
      return { bounceType: 'hard', category: 'invalid_recipient' }
    }

    if (diagnosticLower.includes('full') || diagnosticLower.includes('quota')) {
      return { bounceType: 'soft', category: 'mailbox_full' }
    }

    if (diagnosticLower.includes('too large') || diagnosticLower.includes('size')) {
      return { bounceType: 'soft', category: 'message_too_large' }
    }

    if (diagnosticLower.includes('content') || diagnosticLower.includes('rejected')) {
      return { bounceType: 'hard', category: 'content_rejected' }
    }
  }

  return { bounceType: 'unknown', category: 'unknown' }
}

/**
 * Categorize permanent bounce based on enhanced status code
 */
function categorizePermanentBounce(code: string, diagnostic: string): BounceInfo['bounceCategory'] {
  // 5.1.x - Addressing Status
  if (code.startsWith('5.1.')) {
    if (code === '5.1.1') return 'invalid_recipient' // User unknown
    if (code === '5.1.2') return 'invalid_recipient' // Domain not found
    return 'invalid_recipient'
  }

  // 5.2.x - Mailbox Status
  if (code.startsWith('5.2.')) {
    if (code === '5.2.2') return 'mailbox_full'
    if (code === '5.2.3') return 'message_too_large'
    return 'mailbox_full'
  }

  // 5.7.x - Security or Policy Status
  if (code.startsWith('5.7.')) {
    return 'policy_violation'
  }

  // Check diagnostic message
  if (diagnostic.includes('spam') || diagnostic.includes('blocked')) {
    return 'spam_complaint'
  }

  return 'unknown'
}

/**
 * Categorize transient bounce based on enhanced status code
 */
function categorizeTransientBounce(code: string, diagnostic: string): BounceInfo['bounceCategory'] {
  // 4.2.x - Mailbox Status
  if (code.startsWith('4.2.')) {
    if (code === '4.2.2') return 'mailbox_full'
    if (code === '4.2.3') return 'message_too_large'
  }

  // 4.4.x - Network and Routing Status
  if (code.startsWith('4.4.')) {
    return 'network_error'
  }

  // Check diagnostic message
  if (diagnostic.includes('full') || diagnostic.includes('quota')) {
    return 'mailbox_full'
  }

  if (diagnostic.includes('too large') || diagnostic.includes('size')) {
    return 'message_too_large'
  }

  return 'network_error'
}

/**
 * Generate VERP (Variable Envelope Return Path) address for bounce tracking
 */
export function generateVERPAddress(
  baseAddress: string, // e.g., "bounce@example.com"
  campaignId: string,
  contactEmail: string
): string {
  // Extract domain from base address
  const [localPart, domain] = baseAddress.split('@')

  // Encode the contact email (replace @ with =)
  const encodedEmail = contactEmail.replace('@', '=')

  // Generate VERP address: bounce+campaign_id+encoded_email@domain.com
  return `${localPart}+${campaignId}+${encodedEmail}@${domain}`
}

/**
 * Parse VERP address to extract campaign and contact information
 */
export function parseVERPAddress(verpAddress: string): {
  campaignId: string | null
  contactEmail: string | null
} {
  const result = { campaignId: null as string | null, contactEmail: null as string | null }

  // Match pattern: bounce+campaign_id+encoded_email@domain.com
  const match = verpAddress.match(/bounce\+([^+]+)\+([^@]+)@/)

  if (match) {
    result.campaignId = match[1]
    // Decode email (replace = back to @)
    result.contactEmail = match[2].replace(/=/g, '@')
  }

  return result
}
