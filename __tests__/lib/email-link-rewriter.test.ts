import { EmailLinkRewriter } from '../../lib/email-link-rewriter'
import { emailTracker } from '../../lib/email-tracking'

// Mock the emailTracker
jest.mock('../../lib/email-tracking', () => ({
  emailTracker: {
    generateClickTrackingUrl: jest.fn()
  }
}))

const mockEmailTracker = emailTracker as jest.Mocked<typeof emailTracker>

describe('EmailLinkRewriter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Setup default mock for tracking URL generation
    mockEmailTracker.generateClickTrackingUrl.mockResolvedValue('https://app.example.com/api/tracking/click/track_123')
  })

  describe('rewriteLinksForTracking', () => {
    it('should rewrite simple HTTP links', async () => {
      const htmlContent = '<a href="https://example.com">Visit Example</a>'
      const messageId = 'msg_123'
      const recipientEmail = 'test@example.com'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        messageId,
        recipientEmail,
        'campaign_123',
        'contact_123'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).toHaveBeenCalledWith(
        messageId,
        recipientEmail,
        'https://example.com',
        'campaign_123',
        'contact_123'
      )
      expect(result).toBe('<a href="https://app.example.com/api/tracking/click/track_123">Visit Example</a>')
    })

    it('should rewrite multiple links', async () => {
      const htmlContent = `
        <p>Check out our <a href="https://example.com">website</a> and
        <a href="https://blog.example.com">blog</a>!</p>
      `

      mockEmailTracker.generateClickTrackingUrl
        .mockResolvedValueOnce('https://app.example.com/api/tracking/click/track_123')
        .mockResolvedValueOnce('https://app.example.com/api/tracking/click/track_456')

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).toHaveBeenCalledTimes(2)
      expect(result).toContain('href="https://app.example.com/api/tracking/click/track_123"')
      expect(result).toContain('href="https://app.example.com/api/tracking/click/track_456"')
    })

    it('should preserve link attributes', async () => {
      const htmlContent = '<a href="https://example.com" class="btn" target="_blank" data-test="link">Click Me</a>'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(result).toContain('class="btn"')
      expect(result).toContain('target="_blank"')
      expect(result).toContain('data-test="link"')
      expect(result).toContain('>Click Me</a>')
    })

    it('should skip mailto links', async () => {
      const htmlContent = '<a href="mailto:contact@example.com">Send Email</a>'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).not.toHaveBeenCalled()
      expect(result).toBe(htmlContent) // Should remain unchanged
    })

    it('should skip tel links', async () => {
      const htmlContent = '<a href="tel:+1234567890">Call Us</a>'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).not.toHaveBeenCalled()
      expect(result).toBe(htmlContent)
    })

    it('should skip anchor links', async () => {
      const htmlContent = '<a href="#section1">Go to Section 1</a>'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).not.toHaveBeenCalled()
      expect(result).toBe(htmlContent)
    })

    it('should skip unsubscribe links', async () => {
      const htmlContent = '<a href="https://example.com/unsubscribe?token=abc">Unsubscribe</a>'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).not.toHaveBeenCalled()
      expect(result).toBe(htmlContent)
    })

    it('should skip already tracked links', async () => {
      const htmlContent = '<a href="https://app.example.com/api/tracking/click/existing">Already Tracked</a>'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).not.toHaveBeenCalled()
      expect(result).toBe(htmlContent)
    })

    it('should handle malformed URLs gracefully', async () => {
      const htmlContent = '<a href="not-a-valid-url">Invalid Link</a>'

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(mockEmailTracker.generateClickTrackingUrl).not.toHaveBeenCalled()
      expect(result).toBe(htmlContent)
    })

    it('should return original content if tracking fails', async () => {
      const htmlContent = '<a href="https://example.com">Test Link</a>'
      mockEmailTracker.generateClickTrackingUrl.mockRejectedValue(new Error('Tracking failed'))

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      expect(result).toBe(htmlContent) // Should return original on error
    })

    it('should handle complex HTML with multiple elements', async () => {
      const htmlContent = `
        <html>
          <body>
            <div class="header">
              <a href="https://example.com/home">Home</a>
              <a href="mailto:info@example.com">Contact</a>
            </div>
            <p>Visit our <a href="https://example.com/products" class="product-link">products page</a></p>
            <footer>
              <a href="https://example.com/unsubscribe">Unsubscribe</a>
            </footer>
          </body>
        </html>
      `

      const result = await EmailLinkRewriter.rewriteLinksForTracking(
        htmlContent,
        'msg_123',
        'test@example.com'
      )

      // Should only track the home and products links (not mailto or unsubscribe)
      expect(mockEmailTracker.generateClickTrackingUrl).toHaveBeenCalledTimes(2)
      expect(mockEmailTracker.generateClickTrackingUrl).toHaveBeenCalledWith(
        'msg_123',
        'test@example.com',
        'https://example.com/home',
        undefined,
        undefined
      )
      expect(mockEmailTracker.generateClickTrackingUrl).toHaveBeenCalledWith(
        'msg_123',
        'test@example.com',
        'https://example.com/products',
        undefined,
        undefined
      )
    })
  })

  describe('extractLinks', () => {
    it('should extract all links from HTML content', () => {
      const htmlContent = `
        <p><a href="https://example.com" class="btn">Example</a></p>
        <div><a href="mailto:test@example.com">Email</a></div>
        <span><a href="https://blog.example.com" target="_blank">Blog</a></span>
      `

      const links = EmailLinkRewriter.extractLinks(htmlContent)

      expect(links).toHaveLength(3)
      expect(links[0]).toEqual({
        originalUrl: 'https://example.com',
        linkText: 'Example',
        attributes: 'class="btn"'
      })
      expect(links[1]).toEqual({
        originalUrl: 'mailto:test@example.com',
        linkText: 'Email',
        attributes: ''
      })
      expect(links[2]).toEqual({
        originalUrl: 'https://blog.example.com',
        linkText: 'Blog',
        attributes: 'target="_blank"'
      })
    })

    it('should handle links with nested HTML', () => {
      const htmlContent = '<a href="https://example.com"><strong>Bold</strong> Text</a>'

      const links = EmailLinkRewriter.extractLinks(htmlContent)

      expect(links).toHaveLength(1)
      expect(links[0].linkText).toBe('Bold Text') // Should strip HTML tags
      expect(links[0].originalUrl).toBe('https://example.com')
    })
  })

  describe('validateEmailLinks', () => {
    it('should validate good links', () => {
      const htmlContent = '<a href="https://example.com">Valid Link</a>'

      const validation = EmailLinkRewriter.validateEmailLinks(htmlContent)

      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
      expect(validation.linkCount).toBe(1)
      expect(validation.trackableLinks).toBe(1)
    })

    it('should detect invalid URLs', () => {
      const htmlContent = '<a href="not-a-url">Invalid Link</a>'

      const validation = EmailLinkRewriter.validateEmailLinks(htmlContent)

      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Invalid URL found: not-a-url')
      expect(validation.linkCount).toBe(1)
      expect(validation.trackableLinks).toBe(0)
    })

    it('should detect empty link text', () => {
      const htmlContent = '<a href="https://example.com"></a>'

      const validation = EmailLinkRewriter.validateEmailLinks(htmlContent)

      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Link with empty text: https://example.com')
    })

    it('should detect extremely long URLs', () => {
      const longUrl = 'https://example.com/' + 'x'.repeat(2000)
      const htmlContent = `<a href="${longUrl}">Long URL</a>`

      const validation = EmailLinkRewriter.validateEmailLinks(htmlContent)

      expect(validation.isValid).toBe(false)
      expect(validation.issues[0]).toContain('Extremely long URL')
    })

    it('should count trackable vs non-trackable links', () => {
      const htmlContent = `
        <a href="https://example.com">Trackable</a>
        <a href="mailto:test@example.com">Not Trackable</a>
        <a href="https://example.com/unsubscribe">Not Trackable</a>
        <a href="https://blog.example.com">Trackable</a>
      `

      const validation = EmailLinkRewriter.validateEmailLinks(htmlContent)

      expect(validation.linkCount).toBe(4)
      expect(validation.trackableLinks).toBe(2)
    })
  })

  describe('previewLinkRewriting', () => {
    it('should generate preview of link rewriting', async () => {
      const htmlContent = `
        <a href="https://example.com">Example</a>
        <a href="mailto:test@example.com">Email</a>
        <a href="https://blog.example.com">Blog</a>
      `

      mockEmailTracker.generateClickTrackingUrl
        .mockResolvedValueOnce('https://app.example.com/api/tracking/click/track_123')
        .mockResolvedValueOnce('https://app.example.com/api/tracking/click/track_456')

      const preview = await EmailLinkRewriter.previewLinkRewriting(htmlContent)

      expect(preview).toHaveLength(2) // Only trackable links
      expect(preview[0]).toEqual({
        originalUrl: 'https://example.com',
        trackingUrl: 'https://app.example.com/api/tracking/click/track_123',
        linkText: 'Example'
      })
      expect(preview[1]).toEqual({
        originalUrl: 'https://blog.example.com',
        trackingUrl: 'https://app.example.com/api/tracking/click/track_456',
        linkText: 'Blog'
      })
    })
  })
})