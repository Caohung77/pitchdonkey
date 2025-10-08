export interface EmailClassificationResult {
  type: 'bounce' | 'auto_reply' | 'human_reply' | 'unsubscribe' | 'spam'
  subtype?: string
  confidence: number
  sentiment?: 'positive' | 'negative' | 'neutral'
  intent?: string
  keywords: string[]
  bounceInfo?: {
    bounceType: 'hard' | 'soft' | 'complaint'
    bounceCode?: string
    bounceReason?: string
  }
  autoReplyInfo?: {
    autoReplyUntil?: Date
    forwardedTo?: string
  }
  requiresHumanReview: boolean
}

export interface IncomingEmail {
  id: string
  messageId: string
  inReplyTo?: string
  emailReferences?: string
  fromAddress: string
  toAddress: string
  subject?: string
  textContent?: string
  htmlContent?: string
  dateReceived: string
}

/**
 * Email classification service using pattern matching and heuristics
 */
export class EmailClassifier {
  
  /**
   * Classify an incoming email
   */
  async classifyEmail(email: IncomingEmail): Promise<EmailClassificationResult> {
    console.log(`🔍 Classifying email from ${email.fromAddress}: ${email.subject}`)

    // Try different classification methods in order of confidence
    let result = this.classifyBounce(email)
    if (result.confidence > 0.8) return result

    result = this.classifyAutoReply(email)
    if (result.confidence > 0.7) return result

    result = this.classifyUnsubscribe(email)
    if (result.confidence > 0.8) return result

    result = this.classifySpam(email)
    if (result.confidence > 0.7) return result

    // Default to human reply if none of the above match strongly
    return this.classifyHumanReply(email)
  }

  /**
   * Classify bounce emails (delivery failures)
   */
  private classifyBounce(email: IncomingEmail): EmailClassificationResult {
    const subject = (email.subject || '').toLowerCase()
    const content = ((email.textContent || '') + (email.htmlContent || '')).toLowerCase()
    const fromAddress = email.fromAddress.toLowerCase()

    // Hard bounce patterns
    const hardBouncePatterns = [
      /user unknown/i,
      /mailbox unavailable/i,
      /no such user/i,
      /recipient address rejected/i,
      /user not found/i,
      /invalid recipient/i,
      /does not exist/i,
      /550.*5\.1\.1/,
      /550.*5\.7\.1/,
      /permanent failure/i,
      /address rejected/i
    ]

    // Soft bounce patterns
    const softBouncePatterns = [
      /mailbox full/i,
      /quota exceeded/i,
      /temporary failure/i,
      /try again later/i,
      /4\d{2}.*\d\.\d\.\d/,
      /service unavailable/i,
      /server too busy/i
    ]

    // Bounce sender patterns
    const bounceSenderPatterns = [
      /mailer-daemon/i,
      /postmaster/i,
      /noreply/i,
      /no-reply/i,
      /bounce/i,
      /delivery.*status.*notification/i
    ]

    // Subject bounce patterns
    const bounceSubjectPatterns = [
      /undelivered mail/i,
      /delivery.*fail/i,
      /return.*receipt/i,
      /mail delivery fail/i,
      /bounce/i,
      /message not delivered/i,
      /delivery status notification/i
    ]

    let confidence = 0
    let bounceType: 'hard' | 'soft' | 'complaint' = 'soft'
    let bounceCode = ''
    let bounceReason = ''

    // Check sender
    if (bounceSenderPatterns.some(pattern => pattern.test(fromAddress))) {
      confidence += 0.4
    }

    // Check subject
    if (bounceSubjectPatterns.some(pattern => pattern.test(subject))) {
      confidence += 0.3
    }

    // Check content for bounce patterns
    for (const pattern of hardBouncePatterns) {
      if (pattern.test(content)) {
        confidence += 0.5
        bounceType = 'hard'
        bounceReason = this.extractBounceReason(content, pattern)
        break
      }
    }

    if (bounceType === 'soft') {
      for (const pattern of softBouncePatterns) {
        if (pattern.test(content)) {
          confidence += 0.3
          bounceReason = this.extractBounceReason(content, pattern)
          break
        }
      }
    }

    // Extract SMTP error code if present
    const errorCodeMatch = content.match(/(\d{3})\s+(\d\.\d\.\d)/);
    if (errorCodeMatch) {
      bounceCode = errorCodeMatch[0]
      confidence += 0.2
    }

    return {
      type: 'bounce',
      subtype: bounceType,
      confidence: Math.min(confidence, 1.0),
      keywords: this.extractKeywords(content, ['bounce', 'delivery', 'failed', 'rejected']),
      bounceInfo: {
        bounceType,
        bounceCode: bounceCode || undefined,
        bounceReason: bounceReason || 'Delivery failure'
      },
      requiresHumanReview: confidence < 0.8
    }
  }

  /**
   * Classify auto-reply emails (out of office, vacation, automated responses, transactional emails)
   */
  private classifyAutoReply(email: IncomingEmail): EmailClassificationResult {
    const subject = (email.subject || '').toLowerCase()
    const content = ((email.textContent || '') + (email.htmlContent || '')).toLowerCase()
    const fromAddress = email.fromAddress.toLowerCase()

    // Transactional/no-reply sender patterns (HIGH CONFIDENCE)
    const noReplySenderPatterns = [
      /no-reply/i,
      /noreply/i,
      /no_reply/i,
      /donotreply/i,
      /do-not-reply/i,
      /notifications?@/i,
      /auto-confirm/i,
      /mailer@/i,
      /automated@/i
    ]

    // Transactional content patterns (login links, verifications, receipts)
    const transactionalPatterns = [
      /verify.*email/i,
      /confirm.*email/i,
      /reset.*password/i,
      /login.*link/i,
      /sign.*in.*link/i,
      /verification.*code/i,
      /authentication.*code/i,
      /one.*time.*password/i,
      /security.*code/i,
      /receipt.*order/i,
      /order.*confirmation/i,
      /payment.*received/i,
      /subscription.*confirmation/i
    ]

    // Auto-reply patterns (out of office, etc.)
    const autoReplyPatterns = [
      /out of office/i,
      /vacation/i,
      /away from office/i,
      /automatic.*reply/i,
      /auto.*reply/i,
      /currently.*away/i,
      /temporarily.*unavailable/i,
      /on holiday/i,
      /on leave/i,
      /not.*available/i,
      /will.*return/i,
      /back.*on/i
    ]

    // Subject auto-reply patterns
    const autoReplySubjectPatterns = [
      /out of office/i,
      /away/i,
      /vacation/i,
      /automatic/i,
      /auto.*reply/i,
      /re:.*re:/i // Multiple "Re:" indicates automated forwarding
    ]

    let confidence = 0
    let subtype = 'out_of_office'

    // CRITICAL: Check for no-reply/transactional senders first (HIGH CONFIDENCE)
    if (noReplySenderPatterns.some(pattern => pattern.test(fromAddress))) {
      confidence += 0.9
      subtype = 'transactional'
      console.log(`🚫 Detected no-reply sender: ${fromAddress}`)
    }

    // Check for transactional content patterns
    if (transactionalPatterns.some(pattern => pattern.test(content) || pattern.test(subject))) {
      confidence += 0.8
      subtype = 'transactional'
      console.log(`🔐 Detected transactional content in email`)
    }
    let autoReplyUntil: Date | undefined
    let forwardedTo: string | undefined

    // Check subject
    if (autoReplySubjectPatterns.some(pattern => pattern.test(subject))) {
      confidence += 0.4
    }

    // Check content
    if (autoReplyPatterns.some(pattern => pattern.test(content))) {
      confidence += 0.5
    }

    // Look for return dates
    const dateMatches = content.match(/(?:return|back|available).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
    if (dateMatches) {
      confidence += 0.2
      try {
        autoReplyUntil = new Date(dateMatches[1])
      } catch (e) {
        // Invalid date format, ignore
      }
    }

    // Look for forwarding information
    const forwardMatch = content.match(/forward.*?to.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    if (forwardMatch) {
      confidence += 0.1
      forwardedTo = forwardMatch[1]
    }

    // Headers that indicate auto-replies
    if (email.subject?.toLowerCase().includes('automatic reply')) {
      confidence += 0.3
    }

    return {
      type: 'auto_reply',
      subtype,
      confidence: Math.min(confidence, 1.0),
      sentiment: 'neutral',
      keywords: this.extractKeywords(content, ['office', 'vacation', 'away', 'return', 'transactional', 'no-reply']),
      autoReplyInfo: {
        autoReplyUntil,
        forwardedTo
      },
      requiresHumanReview: confidence < 0.7 && subtype !== 'transactional' // Transactional emails don't need review
    }
  }

  /**
   * Classify unsubscribe requests
   */
  private classifyUnsubscribe(email: IncomingEmail): EmailClassificationResult {
    const subject = (email.subject || '').toLowerCase()
    const content = ((email.textContent || '') + (email.htmlContent || '')).toLowerCase()

    const unsubscribePatterns = [
      /unsubscribe/i,
      /remove.*me/i,
      /opt.*out/i,
      /stop.*email/i,
      /no.*more.*email/i,
      /don.*t.*email/i,
      /take.*me.*off/i,
      /remove.*from.*list/i,
      /cancel.*subscription/i,
      /stop.*sending/i
    ]

    let confidence = 0

    // Check subject
    if (unsubscribePatterns.some(pattern => pattern.test(subject))) {
      confidence += 0.6
    }

    // Check content
    if (unsubscribePatterns.some(pattern => pattern.test(content))) {
      confidence += 0.4
    }

    // Strong indicators in content
    const strongUnsubPatterns = [
      /please.*remove.*me/i,
      /unsubscribe.*me/i,
      /opt.*me.*out/i,
      /stop.*these.*email/i
    ]

    if (strongUnsubPatterns.some(pattern => pattern.test(content))) {
      confidence += 0.3
    }

    return {
      type: 'unsubscribe',
      confidence: Math.min(confidence, 1.0),
      sentiment: 'negative',
      intent: 'request_removal',
      keywords: this.extractKeywords(content, ['unsubscribe', 'remove', 'stop', 'opt-out']),
      requiresHumanReview: confidence < 0.8
    }
  }

  /**
   * Classify spam/junk emails
   */
  private classifySpam(email: IncomingEmail): EmailClassificationResult {
    const subject = (email.subject || '').toLowerCase()
    const content = ((email.textContent || '') + (email.htmlContent || '')).toLowerCase()

    const spamPatterns = [
      /viagra/i,
      /cialis/i,
      /casino/i,
      /lottery/i,
      /winner/i,
      /congratulations.*won/i,
      /urgent.*business/i,
      /nigerian.*prince/i,
      /million.*dollar/i,
      /click.*here.*now/i,
      /limited.*time.*offer/i,
      /act.*now/i,
      /free.*money/i
    ]

    let confidence = 0

    if (spamPatterns.some(pattern => pattern.test(subject + ' ' + content))) {
      confidence += 0.7
    }

    // Excessive use of caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length
    if (capsRatio > 0.3) {
      confidence += 0.2
    }

    // Multiple exclamation marks
    const exclamationCount = (content.match(/!/g) || []).length
    if (exclamationCount > 5) {
      confidence += 0.1
    }

    return {
      type: 'spam',
      confidence: Math.min(confidence, 1.0),
      keywords: this.extractKeywords(content, ['free', 'urgent', 'click', 'now']),
      requiresHumanReview: confidence < 0.8
    }
  }

  /**
   * Classify human replies
   */
  private classifyHumanReply(email: IncomingEmail): EmailClassificationResult {
    const content = ((email.textContent || '') + (email.htmlContent || '')).toLowerCase()
    
    // Determine sentiment
    const sentiment = this.analyzeSentiment(content)
    
    // Determine intent
    const intent = this.analyzeIntent(content)
    
    // Base confidence - human reply is the default
    let confidence = 0.6
    
    // Increase confidence if it looks like a genuine human response
    const humanIndicators = [
      /thank you/i,
      /thanks/i,
      /interested/i,
      /tell me more/i,
      /when can we/i,
      /i would like/i,
      /please.*call/i,
      /sounds good/i,
      /let.*schedule/i
    ]

    if (humanIndicators.some(pattern => pattern.test(content))) {
      confidence += 0.3
    }

    // Check if it's a reply (has in-reply-to)
    if (email.inReplyTo) {
      confidence += 0.2
    }

    return {
      type: 'human_reply',
      confidence: Math.min(confidence, 1.0),
      sentiment,
      intent,
      keywords: this.extractKeywords(content, ['interested', 'schedule', 'call', 'meeting']),
      requiresHumanReview: sentiment === 'positive' || intent === 'interested'
    }
  }

  /**
   * Analyze sentiment of email content
   */
  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['interested', 'yes', 'thank', 'great', 'good', 'excellent', 'perfect', 'sounds good']
    const negativeWords = ['not interested', 'no thank', 'stop', 'remove', 'unsubscribe', 'spam', 'annoying']

    let positiveScore = 0
    let negativeScore = 0

    for (const word of positiveWords) {
      if (content.includes(word)) positiveScore++
    }

    for (const word of negativeWords) {
      if (content.includes(word)) negativeScore++
    }

    if (positiveScore > negativeScore) return 'positive'
    if (negativeScore > positiveScore) return 'negative'
    return 'neutral'
  }

  /**
   * Analyze intent of email content
   */
  private analyzeIntent(content: string): string {
    if (/interested|tell me more|schedule|meeting/i.test(content)) {
      return 'interested'
    }
    
    if (/not interested|no thank|remove/i.test(content)) {
      return 'not_interested'
    }
    
    if (/question|help|clarify/i.test(content)) {
      return 'question'
    }
    
    return 'unknown'
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string, baseKeywords: string[]): string[] {
    const words = content.toLowerCase().match(/\b\w+\b/g) || []
    const keywords = new Set(baseKeywords)
    
    // Add relevant words that appear in content
    const relevantWords = ['interested', 'schedule', 'call', 'meeting', 'yes', 'no', 'thank', 'stop']
    
    for (const word of relevantWords) {
      if (words.includes(word)) {
        keywords.add(word)
      }
    }
    
    return Array.from(keywords)
  }

  /**
   * Extract bounce reason from content
   */
  private extractBounceReason(content: string, pattern: RegExp): string {
    const match = content.match(pattern)
    return match ? match[0] : 'Delivery failure'
  }

  /**
   * Determine auto-reply subtype
   */
  private determineAutoReplySubtype(content: string): string {
    if (/vacation|holiday/i.test(content)) return 'vacation'
    if (/out of office/i.test(content)) return 'out_of_office'
    if (/away|unavailable/i.test(content)) return 'temporary_away'
    return 'auto_reply'
  }
}

// Export singleton instance
export const emailClassifier = new EmailClassifier()