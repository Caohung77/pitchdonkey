import { z } from 'zod'

// Spam checking interfaces
export interface SpamCheckResult {
  score: number // 0-100, higher is more likely spam
  isSpam: boolean
  confidence: number // 0-1
  issues: SpamIssue[]
  suggestions: string[]
  details: {
    contentScore: number
    subjectScore: number
    structureScore: number
    linkScore: number
    imageScore: number
  }
}

export interface SpamIssue {
  type: 'content' | 'subject' | 'structure' | 'links' | 'images'
  severity: 'low' | 'medium' | 'high'
  message: string
  suggestion: string
  score: number
}

export interface ContentAnalysis {
  wordCount: number
  characterCount: number
  htmlToTextRatio: number
  linkCount: number
  imageCount: number
  linkToTextRatio: number
  imageToTextRatio: number
  hasUnsubscribeLink: boolean
  hasPhysicalAddress: boolean
  spamTriggerWords: string[]
  suspiciousPatterns: string[]
}

export interface SubjectLineAnalysis {
  length: number
  hasSpamWords: boolean
  hasExcessivePunctuation: boolean
  hasAllCaps: boolean
  hasNumbers: boolean
  hasEmojis: boolean
  spamScore: number
  suggestions: string[]
}

// Validation schemas
const emailContentSchema = z.object({
  subject: z.string().min(1),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  fromEmail: z.string().email(),
  fromName: z.string().optional()
}).refine(data => data.htmlContent || data.textContent, {
  message: 'Either htmlContent or textContent must be provided'
})

/**
 * Spam score checker and content optimizer
 */
export class SpamChecker {
  private spamWords: Set<string>
  private suspiciousPatterns: RegExp[]
  private subjectSpamWords: Set<string>

  constructor() {
    this.initializeSpamWords()
    this.initializeSuspiciousPatterns()
    this.initializeSubjectSpamWords()
  }

  /**
   * Check email content for spam score
   */
  async checkSpamScore(
    subject: string,
    htmlContent?: string,
    textContent?: string,
    fromEmail?: string,
    fromName?: string
  ): Promise<SpamCheckResult> {
    try {
      // Validate input
      const validatedData = emailContentSchema.parse({
        subject,
        htmlContent,
        textContent,
        fromEmail: fromEmail || 'test@example.com',
        fromName
      })

      // Analyze different components
      const contentAnalysis = this.analyzeContent(htmlContent, textContent)
      const subjectAnalysis = this.analyzeSubjectLine(subject)
      
      // Calculate individual scores
      const contentScore = this.calculateContentScore(contentAnalysis)
      const subjectScore = this.calculateSubjectScore(subjectAnalysis)
      const structureScore = this.calculateStructureScore(contentAnalysis)
      const linkScore = this.calculateLinkScore(contentAnalysis)
      const imageScore = this.calculateImageScore(contentAnalysis)

      // Calculate overall spam score (weighted average)
      const overallScore = Math.round(
        contentScore * 0.3 +
        subjectScore * 0.25 +
        structureScore * 0.2 +
        linkScore * 0.15 +
        imageScore * 0.1
      )

      // Collect issues and suggestions
      const issues: SpamIssue[] = []
      const suggestions: string[] = []

      this.collectContentIssues(contentAnalysis, contentScore, issues, suggestions)
      this.collectSubjectIssues(subjectAnalysis, subjectScore, issues, suggestions)
      this.collectStructureIssues(contentAnalysis, structureScore, issues, suggestions)
      this.collectLinkIssues(contentAnalysis, linkScore, issues, suggestions)
      this.collectImageIssues(contentAnalysis, imageScore, issues, suggestions)

      // Determine if spam
      const isSpam = overallScore >= 50
      const confidence = this.calculateConfidence(overallScore, issues.length)

      return {
        score: overallScore,
        isSpam,
        confidence,
        issues,
        suggestions: Array.from(new Set(suggestions)), // Remove duplicates
        details: {
          contentScore,
          subjectScore,
          structureScore,
          linkScore,
          imageScore
        }
      }

    } catch (error) {
      console.error('Error checking spam score:', error)
      throw error
    }
  }

  /**
   * Analyze email content
   */
  private analyzeContent(htmlContent?: string, textContent?: string): ContentAnalysis {
    const content = textContent || this.stripHtml(htmlContent || '')
    const html = htmlContent || ''

    // Basic metrics
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    const characterCount = content.length
    const htmlToTextRatio = html.length > 0 ? html.length / Math.max(content.length, 1) : 0

    // Link analysis
    const linkMatches = html.match(/<a[^>]+href=[\"'][^\"']+[\"'][^>]*>/gi) || []
    const linkCount = linkMatches.length
    const linkToTextRatio = wordCount > 0 ? linkCount / wordCount : 0

    // Image analysis
    const imageMatches = html.match(/<img[^>]+>/gi) || []
    const imageCount = imageMatches.length
    const imageToTextRatio = wordCount > 0 ? imageCount / wordCount : 0

    // Compliance checks
    const hasUnsubscribeLink = /unsubscribe/i.test(content) || /unsubscribe/i.test(html)
    const hasPhysicalAddress = this.hasPhysicalAddress(content)

    // Spam trigger words
    const spamTriggerWords = this.findSpamWords(content)
    const suspiciousPatterns = this.findSuspiciousPatterns(content)

    return {
      wordCount,
      characterCount,
      htmlToTextRatio,
      linkCount,
      imageCount,
      linkToTextRatio,
      imageToTextRatio,
      hasUnsubscribeLink,
      hasPhysicalAddress,
      spamTriggerWords,
      suspiciousPatterns
    }
  }

  /**
   * Analyze subject line
   */
  private analyzeSubjectLine(subject: string): SubjectLineAnalysis {
    const length = subject.length
    const hasSpamWords = this.subjectSpamWords.size > 0 && 
      Array.from(this.subjectSpamWords).some(word => 
        subject.toLowerCase().includes(word.toLowerCase())
      )
    
    const hasExcessivePunctuation = /[!?]{2,}/.test(subject)
    const hasAllCaps = subject === subject.toUpperCase() && subject.length > 5
    const hasNumbers = /\d/.test(subject)
    const hasEmojis = false // Emoji detection disabled for compatibility

    // Calculate subject spam score
    let spamScore = 0
    if (hasSpamWords) spamScore += 30
    if (hasExcessivePunctuation) spamScore += 15
    if (hasAllCaps) spamScore += 25
    if (length < 10) spamScore += 10
    if (length > 60) spamScore += 10

    const suggestions: string[] = []
    if (hasSpamWords) suggestions.push('Remove spam trigger words from subject line')
    if (hasExcessivePunctuation) suggestions.push('Reduce excessive punctuation')
    if (hasAllCaps) suggestions.push('Avoid using all capital letters')
    if (length < 10) suggestions.push('Make subject line more descriptive (10+ characters)')
    if (length > 60) suggestions.push('Shorten subject line to under 60 characters')

    return {
      length,
      hasSpamWords,
      hasExcessivePunctuation,
      hasAllCaps,
      hasNumbers,
      hasEmojis,
      spamScore,
      suggestions
    }
  }

  /**
   * Calculate content spam score
   */
  private calculateContentScore(analysis: ContentAnalysis): number {
    let score = 0

    // Spam trigger words (high impact)
    score += analysis.spamTriggerWords.length * 8

    // Suspicious patterns
    score += analysis.suspiciousPatterns.length * 5

    // Word count issues
    if (analysis.wordCount < 50) score += 15
    if (analysis.wordCount > 2000) score += 10

    // Compliance issues
    if (!analysis.hasUnsubscribeLink) score += 20
    if (!analysis.hasPhysicalAddress) score += 15

    return Math.min(score, 100)
  }

  /**
   * Calculate subject line spam score
   */
  private calculateSubjectScore(analysis: SubjectLineAnalysis): number {
    return Math.min(analysis.spamScore, 100)
  }

  /**
   * Calculate structure spam score
   */
  private calculateStructureScore(analysis: ContentAnalysis): number {
    let score = 0

    // HTML to text ratio issues
    if (analysis.htmlToTextRatio > 5) score += 20
    if (analysis.htmlToTextRatio > 10) score += 30

    // Very short content
    if (analysis.wordCount < 20) score += 25

    return Math.min(score, 100)
  }

  /**
   * Calculate link spam score
   */
  private calculateLinkScore(analysis: ContentAnalysis): number {
    let score = 0

    // Too many links
    if (analysis.linkToTextRatio > 0.1) score += 20
    if (analysis.linkToTextRatio > 0.2) score += 40

    // Absolute link count
    if (analysis.linkCount > 10) score += 15
    if (analysis.linkCount > 20) score += 30

    return Math.min(score, 100)
  }

  /**
   * Calculate image spam score
   */
  private calculateImageScore(analysis: ContentAnalysis): number {
    let score = 0

    // Too many images
    if (analysis.imageToTextRatio > 0.05) score += 15
    if (analysis.imageToTextRatio > 0.1) score += 30

    // Image-heavy emails with little text
    if (analysis.imageCount > 5 && analysis.wordCount < 100) score += 25

    return Math.min(score, 100)
  }

  /**
   * Collect content-related issues
   */
  private collectContentIssues(
    analysis: ContentAnalysis,
    score: number,
    issues: SpamIssue[],
    suggestions: string[]
  ): void {
    if (analysis.spamTriggerWords.length > 0) {
      issues.push({
        type: 'content',
        severity: 'high',
        message: `Contains ${analysis.spamTriggerWords.length} spam trigger words: ${analysis.spamTriggerWords.slice(0, 3).join(', ')}`,
        suggestion: 'Replace spam trigger words with more professional alternatives',
        score: analysis.spamTriggerWords.length * 8
      })
      suggestions.push('Replace spam trigger words with more professional alternatives')
    }

    if (!analysis.hasUnsubscribeLink) {
      issues.push({
        type: 'content',
        severity: 'high',
        message: 'Missing unsubscribe link',
        suggestion: 'Add a clear unsubscribe link to comply with CAN-SPAM regulations',
        score: 20
      })
      suggestions.push('Add a clear unsubscribe link')
    }

    if (!analysis.hasPhysicalAddress) {
      issues.push({
        type: 'content',
        severity: 'medium',
        message: 'Missing physical address',
        suggestion: 'Include your business physical address for compliance',
        score: 15
      })
      suggestions.push('Include your business physical address')
    }

    if (analysis.wordCount < 50) {
      issues.push({
        type: 'content',
        severity: 'medium',
        message: 'Content too short',
        suggestion: 'Add more valuable content to improve engagement',
        score: 15
      })
      suggestions.push('Add more valuable content')
    }
  }

  /**
   * Collect subject line issues
   */
  private collectSubjectIssues(
    analysis: SubjectLineAnalysis,
    score: number,
    issues: SpamIssue[],
    suggestions: string[]
  ): void {
    if (analysis.hasSpamWords) {
      issues.push({
        type: 'subject',
        severity: 'high',
        message: 'Subject line contains spam trigger words',
        suggestion: 'Rewrite subject line without spam trigger words',
        score: 30
      })
    }

    if (analysis.hasAllCaps) {
      issues.push({
        type: 'subject',
        severity: 'medium',
        message: 'Subject line is in all caps',
        suggestion: 'Use normal capitalization in subject line',
        score: 25
      })
    }

    if (analysis.hasExcessivePunctuation) {
      issues.push({
        type: 'subject',
        severity: 'medium',
        message: 'Excessive punctuation in subject line',
        suggestion: 'Reduce punctuation marks in subject line',
        score: 15
      })
    }

    suggestions.push(...analysis.suggestions)
  }

  /**
   * Collect structure issues
   */
  private collectStructureIssues(
    analysis: ContentAnalysis,
    score: number,
    issues: SpamIssue[],
    suggestions: string[]
  ): void {
    if (analysis.htmlToTextRatio > 5) {
      issues.push({
        type: 'structure',
        severity: 'medium',
        message: 'HTML to text ratio is too high',
        suggestion: 'Reduce HTML markup or add more text content',
        score: 20
      })
      suggestions.push('Balance HTML markup with text content')
    }
  }

  /**
   * Collect link issues
   */
  private collectLinkIssues(
    analysis: ContentAnalysis,
    score: number,
    issues: SpamIssue[],
    suggestions: string[]
  ): void {
    if (analysis.linkToTextRatio > 0.1) {
      issues.push({
        type: 'links',
        severity: 'medium',
        message: 'Too many links relative to text content',
        suggestion: 'Reduce number of links or add more text content',
        score: 20
      })
      suggestions.push('Reduce the number of links')
    }

    if (analysis.linkCount > 10) {
      issues.push({
        type: 'links',
        severity: 'low',
        message: `High number of links (${analysis.linkCount})`,
        suggestion: 'Consider consolidating links or removing unnecessary ones',
        score: 15
      })
      suggestions.push('Consolidate or remove unnecessary links')
    }
  }

  /**
   * Collect image issues
   */
  private collectImageIssues(
    analysis: ContentAnalysis,
    score: number,
    issues: SpamIssue[],
    suggestions: string[]
  ): void {
    if (analysis.imageToTextRatio > 0.05) {
      issues.push({
        type: 'images',
        severity: 'medium',
        message: 'Too many images relative to text content',
        suggestion: 'Reduce number of images or add more text content',
        score: 15
      })
      suggestions.push('Balance images with text content')
    }

    if (analysis.imageCount > 5 && analysis.wordCount < 100) {
      issues.push({
        type: 'images',
        severity: 'high',
        message: 'Image-heavy email with minimal text',
        suggestion: 'Add more text content to balance the email',
        score: 25
      })
      suggestions.push('Add more text content to balance images')
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(score: number, issueCount: number): number {
    // Higher confidence for extreme scores and more issues
    let confidence = 0.5

    if (score >= 80 || score <= 20) confidence += 0.3
    if (score >= 90 || score <= 10) confidence += 0.2

    confidence += Math.min(issueCount * 0.05, 0.3)

    return Math.min(confidence, 1.0)
  }

  /**
   * Initialize spam trigger words
   */
  private initializeSpamWords(): void {
    this.spamWords = new Set([
      // Financial/Money terms
      'free money', 'make money fast', 'get rich quick', 'cash bonus',
      'guaranteed income', 'financial freedom', 'easy money', 'instant cash',
      
      // Urgency/Pressure terms
      'act now', 'urgent', 'limited time', 'expires today', 'don\'t delay',
      'immediate', 'hurry', 'last chance', 'now only', 'today only',
      
      // Promotional terms
      'no cost', 'risk free', 'satisfaction guaranteed', 'money back',
      'no obligation', 'trial', 'sample', 'gift', 'bonus',
      
      // Suspicious terms
      'click here', 'click below', 'visit our website', 'order now',
      'buy now', 'sign up now', 'join now', 'register now',
      
      // Medical/Health
      'lose weight', 'weight loss', 'diet', 'viagra', 'pharmacy',
      'prescription', 'medicine', 'cure', 'treatment',
      
      // Business opportunity
      'work from home', 'home based business', 'be your own boss',
      'extra income', 'part time', 'full time', 'opportunity',
      
      // Excessive claims
      'amazing', 'incredible', 'unbelievable', 'fantastic', 'revolutionary',
      'breakthrough', 'miracle', 'secret', 'hidden', 'exclusive'
    ])
  }

  /**
   * Initialize suspicious patterns
   */
  private initializeSuspiciousPatterns(): void {
    this.suspiciousPatterns = [
      /\$\d+/g, // Dollar amounts
      /\d+%\s*(off|discount|savings)/gi, // Percentage discounts
      /call\s+now/gi, // Call now
      /\b(viagra|cialis|pharmacy)\b/gi, // Medical spam
      /\b(casino|gambling|poker)\b/gi, // Gambling
      /\b(loan|credit|debt)\b/gi, // Financial
      /\b(winner|congratulations|selected)\b/gi, // Prize/lottery
      /\b(mlm|pyramid|network marketing)\b/gi, // MLM schemes
    ]
  }

  /**
   * Initialize subject line spam words
   */
  private initializeSubjectSpamWords(): void {
    this.subjectSpamWords = new Set([
      'free', 'urgent', 'act now', 'limited time', 'expires',
      'congratulations', 'winner', 'selected', 'guaranteed',
      'money', 'cash', 'income', 'earn', 'profit', 'save',
      'discount', 'sale', 'offer', 'deal', 'bonus',
      'click here', 'order now', 'buy now', 'subscribe',
      'amazing', 'incredible', 'unbelievable', 'revolutionary'
    ])
  }

  /**
   * Find spam trigger words in content
   */
  private findSpamWords(content: string): string[] {
    const lowerContent = content.toLowerCase()
    const foundWords: string[] = []

    for (const word of Array.from(this.spamWords)) {
      if (lowerContent.includes(word.toLowerCase())) {
        foundWords.push(word)
      }
    }

    return foundWords
  }

  /**
   * Find suspicious patterns in content
   */
  private findSuspiciousPatterns(content: string): string[] {
    const foundPatterns: string[] = []

    for (const pattern of this.suspiciousPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        foundPatterns.push(...matches)
      }
    }

    return foundPatterns
  }

  /**
   * Check if content has physical address
   */
  private hasPhysicalAddress(content: string): boolean {
    // Simple heuristic: look for address-like patterns
    const addressPatterns = [
      /\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)/i,
      /\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/i, // US format
      /\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+\s+\d{5}/i, // Simplified US format
    ]

    return addressPatterns.some(pattern => pattern.test(content))
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
  }

  /**
   * Get optimization suggestions for email content
   */
  async getOptimizationSuggestions(
    subject: string,
    htmlContent?: string,
    textContent?: string
  ): Promise<{
    subjectSuggestions: string[]
    contentSuggestions: string[]
    structureSuggestions: string[]
    complianceSuggestions: string[]
    overallScore: number
  }> {
    const spamCheck = await this.checkSpamScore(subject, htmlContent, textContent)
    
    const subjectSuggestions: string[] = []
    const contentSuggestions: string[] = []
    const structureSuggestions: string[] = []
    const complianceSuggestions: string[] = []

    // Categorize suggestions
    for (const issue of spamCheck.issues) {
      switch (issue.type) {
        case 'subject':
          subjectSuggestions.push(issue.suggestion)
          break
        case 'content':
          if (issue.message.includes('unsubscribe') || issue.message.includes('address')) {
            complianceSuggestions.push(issue.suggestion)
          } else {
            contentSuggestions.push(issue.suggestion)
          }
          break
        case 'structure':
          structureSuggestions.push(issue.suggestion)
          break
        case 'links':
        case 'images':
          structureSuggestions.push(issue.suggestion)
          break
      }
    }

    return {
      subjectSuggestions: Array.from(new Set(subjectSuggestions)),
      contentSuggestions: Array.from(new Set(contentSuggestions)),
      structureSuggestions: Array.from(new Set(structureSuggestions)),
      complianceSuggestions: Array.from(new Set(complianceSuggestions)),
      overallScore: spamCheck.score
    }
  }

  /**
   * Generate alternative subject lines
   */
  generateSubjectAlternatives(originalSubject: string): string[] {
    const alternatives: string[] = []
    
    // Remove spam words and replace with alternatives
    let cleanSubject = originalSubject
    
    // Replace common spam words
    const replacements: Record<string, string[]> = {
      'free': ['complimentary', 'no-cost', 'included'],
      'urgent': ['important', 'time-sensitive', 'priority'],
      'act now': ['respond today', 'take action', 'get started'],
      'limited time': ['for a short time', 'temporarily available', 'while supplies last'],
      'guaranteed': ['assured', 'promised', 'committed'],
      'amazing': ['remarkable', 'impressive', 'noteworthy'],
      'incredible': ['outstanding', 'exceptional', 'remarkable'],
      'click here': ['learn more', 'see details', 'find out more']
    }

    for (const [spam, alts] of Object.entries(replacements)) {
      if (cleanSubject.toLowerCase().includes(spam)) {
        for (const alt of alts) {
          alternatives.push(cleanSubject.replace(new RegExp(spam, 'gi'), alt))
        }
      }
    }

    // Generate variations
    if (originalSubject.length > 50) {
      alternatives.push(originalSubject.substring(0, 47) + '...')
    }

    // Add personalization suggestions
    alternatives.push(`${originalSubject} - Personalized for You`)
    alternatives.push(`Quick Update: ${originalSubject}`)
    alternatives.push(`${originalSubject} | Important Information`)

    return alternatives.slice(0, 5) // Return top 5 alternatives
  }
}

// Export default instance
export const spamChecker = new SpamChecker()