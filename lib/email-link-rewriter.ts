import { emailTracker } from './email-tracking'

/**
 * Email link rewriting service for click tracking
 * Converts all links in email HTML content to tracking URLs
 */
export class EmailLinkRewriter {
  /**
   * Rewrite all links in email HTML content to use tracking URLs
   */
  static async rewriteLinksForTracking(
    htmlContent: string,
    messageId: string,
    recipientEmail: string,
    campaignId?: string,
    contactId?: string
  ): Promise<string> {
    try {
      // Regular expression to match all <a> tags with href attributes
      const linkRegex = /<a\s+([^>]*\s+)?href\s*=\s*["']([^"']+)["']([^>]*)>/gi

      let processedContent = htmlContent
      const linkMatches = Array.from(htmlContent.matchAll(linkRegex))

      // Process each link found
      for (const match of linkMatches) {
        const fullMatch = match[0]
        const beforeHref = match[1] || ''
        const originalUrl = match[2]
        const afterHref = match[3] || ''

        // Skip if it's already a tracking URL, mailto, tel, or anchor link
        if (this.shouldSkipUrl(originalUrl)) {
          continue
        }

        // Generate tracking URL
        const trackingUrl = await emailTracker.generateClickTrackingUrl(
          messageId,
          recipientEmail,
          originalUrl,
          campaignId,
          contactId
        )

        // Replace the original URL with tracking URL
        const newLink = `<a ${beforeHref}href="${trackingUrl}"${afterHref}>`
        processedContent = processedContent.replace(fullMatch, newLink)
      }

      return processedContent

    } catch (error) {
      console.error('Error rewriting links for tracking:', error)
      // Return original content if rewriting fails to avoid breaking emails
      return htmlContent
    }
  }

  /**
   * Check if URL should be skipped for tracking
   */
  private static shouldSkipUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return true
    }

    const lowerUrl = url.toLowerCase().trim()

    // Skip empty URLs
    if (!lowerUrl) {
      return true
    }

    // Skip non-HTTP(S) URLs
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      return true
    }

    // Skip if already a tracking URL
    if (lowerUrl.includes('/api/tracking/click/') || lowerUrl.includes('/click/')) {
      return true
    }

    // Skip anchor links
    if (lowerUrl.startsWith('#')) {
      return true
    }

    // Skip mailto and tel links
    if (lowerUrl.startsWith('mailto:') || lowerUrl.startsWith('tel:')) {
      return true
    }

    // Skip unsubscribe links (preserve functionality)
    if (lowerUrl.includes('unsubscribe')) {
      return true
    }

    return false
  }

  /**
   * Extract all links from HTML content for analysis
   */
  static extractLinks(htmlContent: string): Array<{
    originalUrl: string
    linkText: string
    attributes: string
  }> {
    const links: Array<{ originalUrl: string; linkText: string; attributes: string }> = []
    const linkRegex = /<a\s+([^>]*\s+)?href\s*=\s*["']([^"']+)["']([^>]*)>(.*?)<\/a>/gi

    let match
    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const beforeHref = match[1] || ''
      const originalUrl = match[2]
      const afterHref = match[3] || ''
      const linkText = match[4] || ''

      links.push({
        originalUrl,
        linkText: linkText.replace(/<[^>]+>/g, ''), // Strip HTML tags from link text
        attributes: (beforeHref + afterHref).trim()
      })
    }

    return links
  }

  /**
   * Validate HTML content for common link issues
   */
  static validateEmailLinks(htmlContent: string): {
    isValid: boolean
    issues: string[]
    linkCount: number
    trackableLinks: number
  } {
    const issues: string[] = []
    const links = this.extractLinks(htmlContent)
    let trackableLinks = 0

    for (const link of links) {
      // Check for invalid URLs
      try {
        new URL(link.originalUrl)
        if (!this.shouldSkipUrl(link.originalUrl)) {
          trackableLinks++
        }
      } catch {
        issues.push(`Invalid URL found: ${link.originalUrl}`)
      }

      // Check for missing link text
      if (!link.linkText.trim()) {
        issues.push(`Link with empty text: ${link.originalUrl}`)
      }

      // Check for very long URLs (potential spam indicator)
      if (link.originalUrl.length > 2000) {
        issues.push(`Extremely long URL: ${link.originalUrl.substring(0, 100)}...`)
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      linkCount: links.length,
      trackableLinks
    }
  }

  /**
   * Generate preview of what links will look like after rewriting
   */
  static async previewLinkRewriting(
    htmlContent: string,
    sampleMessageId: string = 'preview_msg',
    sampleEmail: string = 'preview@example.com'
  ): Promise<Array<{
    originalUrl: string
    trackingUrl: string
    linkText: string
  }>> {
    const links = this.extractLinks(htmlContent)
    const preview: Array<{
      originalUrl: string
      trackingUrl: string
      linkText: string
    }> = []

    for (const link of links) {
      if (!this.shouldSkipUrl(link.originalUrl)) {
        const trackingUrl = await emailTracker.generateClickTrackingUrl(
          sampleMessageId,
          sampleEmail,
          link.originalUrl
        )

        preview.push({
          originalUrl: link.originalUrl,
          trackingUrl,
          linkText: link.linkText
        })
      }
    }

    return preview
  }
}

// Export default instance
export const emailLinkRewriter = EmailLinkRewriter