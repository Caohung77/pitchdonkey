/**
 * End-to-end integration test for click tracking workflow
 * This test verifies the complete click tracking implementation
 */

import { EmailLinkRewriter } from '../../lib/email-link-rewriter'
import { EmailTracker } from '../../lib/email-tracking'

// Mock Supabase client for this integration test
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      }))
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'click_123',
            original_url: 'https://example.com',
            clicked: false,
            click_count: 0
          },
          error: null
        })
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn().mockResolvedValue({ error: null })
    }))
  }))
}

describe('Click Tracking End-to-End', () => {
  let emailTracker: EmailTracker

  beforeEach(() => {
    jest.clearAllMocks()
    emailTracker = new EmailTracker(mockSupabase)

    // Mock environment variables for this test
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('should complete full click tracking workflow', async () => {
    // 1. Start with email content containing links
    const originalEmailContent = `
      <html>
        <body>
          <h1>Welcome to our newsletter!</h1>
          <p>Check out our <a href="https://example.com/products">latest products</a></p>
          <p>Read our <a href="https://blog.example.com/article">blog post</a></p>
          <p>Contact us at <a href="mailto:support@example.com">support@example.com</a></p>
          <footer>
            <a href="https://example.com/unsubscribe">Unsubscribe</a>
          </footer>
        </body>
      </html>
    `

    // 2. Process the email content through link rewriting
    const messageId = 'test_msg_123'
    const recipientEmail = 'user@example.com'
    const campaignId = 'campaign_123'
    const contactId = 'contact_123'

    console.log('📧 Processing email content for click tracking...')

    const processedContent = await EmailLinkRewriter.rewriteLinksForTracking(
      originalEmailContent,
      messageId,
      recipientEmail,
      campaignId,
      contactId
    )

    // 3. Verify that trackable links were rewritten
    expect(processedContent).toContain('/api/tracking/click/')
    expect(processedContent).toContain('https://app.example.com')

    // Should rewrite the products and blog links
    const trackableLinksCount = (processedContent.match(/\/api\/tracking\/click\//g) || []).length
    expect(trackableLinksCount).toBe(2) // products + blog, not mailto or unsubscribe

    // 4. Verify that non-trackable links remain unchanged
    expect(processedContent).toContain('mailto:support@example.com')
    expect(processedContent).toContain('https://example.com/unsubscribe')

    // 5. Extract one of the generated tracking URLs for testing
    const trackingUrlMatch = processedContent.match(/https:\/\/app\.example\.com\/api\/tracking\/click\/(track_[^"]+)/)
    expect(trackingUrlMatch).toBeTruthy()

    const clickId = trackingUrlMatch![1]
    console.log(`🔗 Generated click ID: ${clickId}`)

    // 6. Simulate a click event
    console.log('👆 Simulating click event...')
    const clickResult = await emailTracker.trackClick(
      clickId,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '192.168.1.100'
    )

    // 7. Verify click tracking worked
    expect(clickResult.success).toBe(true)
    expect(clickResult.redirectUrl).toBe('https://example.com')
    expect(clickResult.firstClick).toBe(true)

    // 8. Verify database interactions
    expect(mockSupabase.from).toHaveBeenCalledWith('click_tracking')
    expect(mockSupabase.from).toHaveBeenCalledWith('email_events')

    console.log('✅ Click tracking workflow completed successfully!')
  })

  it('should handle link validation correctly', () => {
    const testContent = `
      <div>
        <a href="https://valid-site.com">Valid Link</a>
        <a href="invalid-url">Invalid Link</a>
        <a href="">Empty Link</a>
        <a href="https://example.com">Valid Link 2</a>
      </div>
    `

    const validation = EmailLinkRewriter.validateEmailLinks(testContent)

    expect(validation.linkCount).toBe(4)
    expect(validation.trackableLinks).toBe(2) // Only the valid HTTPS links
    expect(validation.isValid).toBe(false) // Due to invalid and empty links
    expect(validation.issues.length).toBeGreaterThan(0)
  })

  it('should provide accurate link preview', async () => {
    const testContent = `
      <p><a href="https://example.com/page1">Page 1</a></p>
      <p><a href="https://example.com/page2">Page 2</a></p>
      <p><a href="mailto:test@example.com">Email</a></p>
    `

    const preview = await EmailLinkRewriter.previewLinkRewriting(testContent)

    expect(preview).toHaveLength(2) // Only trackable links
    expect(preview[0].originalUrl).toBe('https://example.com/page1')
    expect(preview[0].linkText).toBe('Page 1')
    expect(preview[0].trackingUrl).toContain('/api/tracking/click/')

    expect(preview[1].originalUrl).toBe('https://example.com/page2')
    expect(preview[1].linkText).toBe('Page 2')
    expect(preview[1].trackingUrl).toContain('/api/tracking/click/')
  })

  it('should handle edge cases gracefully', async () => {
    // Test with malformed HTML
    const malformedContent = '<a href="https://example.com">Unclosed link'

    const result = await EmailLinkRewriter.rewriteLinksForTracking(
      malformedContent,
      'test_msg',
      'test@example.com'
    )

    // Should still work or return original content safely
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should preserve email structure after link rewriting', async () => {
    const structuredContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Email</title>
          <style>
            .btn { background: blue; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Hello World</h1>
            <p>Click <a href="https://example.com" class="btn">here</a> to continue.</p>
          </div>
        </body>
      </html>
    `

    const processed = await EmailLinkRewriter.rewriteLinksForTracking(
      structuredContent,
      'test_msg',
      'test@example.com'
    )

    // Verify structure is preserved
    expect(processed).toContain('<!DOCTYPE html>')
    expect(processed).toContain('<head>')
    expect(processed).toContain('<style>')
    expect(processed).toContain('class="btn"')
    expect(processed).toContain('<div class="container">')

    // Verify link was rewritten
    expect(processed).toContain('/api/tracking/click/')
    expect(processed).not.toContain('href="https://example.com"')
  })
})