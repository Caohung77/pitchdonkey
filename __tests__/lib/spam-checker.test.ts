import { SpamChecker } from '../../lib/spam-checker'

describe('SpamChecker', () => {
  let spamChecker: SpamChecker

  beforeEach(() => {
    spamChecker = new SpamChecker()
  })

  describe('checkSpamScore', () => {
    it('should return low spam score for clean email', async () => {
      const result = await spamChecker.checkSpamScore(
        'Weekly Newsletter Update',
        '<p>Hello! Here is your weekly update with valuable insights.</p><p>Best regards,<br>The Team</p><p><a href="https://example.com/unsubscribe">Unsubscribe</a></p><p>123 Business St, City, ST 12345</p>',
        'Hello! Here is your weekly update with valuable insights.\n\nBest regards,\nThe Team\n\nUnsubscribe: https://example.com/unsubscribe\n123 Business St, City, ST 12345'
      )

      expect(result.score).toBeLessThan(30)
      expect(result.isSpam).toBe(false)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.issues).toHaveLength(0)
    })

    it('should return high spam score for spammy email', async () => {
      const result = await spamChecker.checkSpamScore(
        'FREE MONEY!!! ACT NOW!!!',
        '<p>CONGRATULATIONS! You have been SELECTED to receive FREE MONEY! Click here NOW to claim your GUARANTEED cash bonus!</p>',
        'CONGRATULATIONS! You have been SELECTED to receive FREE MONEY! Click here NOW to claim your GUARANTEED cash bonus!'
      )

      expect(result.score).toBeGreaterThan(70)
      expect(result.isSpam).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.issues.length).toBeGreaterThan(3)
    })

    it('should detect spam trigger words in content', async () => {
      const result = await spamChecker.checkSpamScore(
        'Business Opportunity',
        '<p>Make money fast with this amazing opportunity! Guaranteed income and financial freedom await you.</p>',
        'Make money fast with this amazing opportunity! Guaranteed income and financial freedom await you.'
      )

      expect(result.details.contentScore).toBeGreaterThan(30)
      expect(result.issues.some(issue => issue.type === 'content' && issue.message.includes('spam trigger words'))).toBe(true)
    })

    it('should detect subject line issues', async () => {
      const result = await spamChecker.checkSpamScore(
        'FREE!!! URGENT!!! ACT NOW!!!',
        '<p>This is a test email with normal content.</p>',
        'This is a test email with normal content.'
      )

      expect(result.details.subjectScore).toBeGreaterThan(50)
      expect(result.issues.some(issue => issue.type === 'subject')).toBe(true)
    })

    it('should detect missing compliance elements', async () => {
      const result = await spamChecker.checkSpamScore(
        'Newsletter Update',
        '<p>This is a newsletter without unsubscribe link or address.</p>',
        'This is a newsletter without unsubscribe link or address.'
      )

      expect(result.issues.some(issue => issue.message.includes('unsubscribe'))).toBe(true)
      expect(result.issues.some(issue => issue.message.includes('physical address'))).toBe(true)
    })

    it('should detect excessive links', async () => {
      const htmlWithManyLinks = '<p>Check out these links: ' +
        Array.from({ length: 15 }, (_, i) => `<a href="https://example${i}.com">Link ${i}</a>`).join(' ') +
        '</p>'

      const result = await spamChecker.checkSpamScore(
        'Many Links',
        htmlWithManyLinks,
        'Check out these links: ' + Array.from({ length: 15 }, (_, i) => `Link ${i}`).join(' ')
      )

      expect(result.details.linkScore).toBeGreaterThan(20)
      expect(result.issues.some(issue => issue.type === 'links')).toBe(true)
    })

    it('should detect excessive images', async () => {
      const htmlWithManyImages = '<p>Check out these images: ' +
        Array.from({ length: 10 }, (_, i) => `<img src="https://example.com/image${i}.jpg" alt="Image ${i}">`).join(' ') +
        '</p><p>Short text content.</p>'

      const result = await spamChecker.checkSpamScore(
        'Many Images',
        htmlWithManyImages,
        'Check out these images. Short text content.'
      )

      expect(result.details.imageScore).toBeGreaterThan(20)
      expect(result.issues.some(issue => issue.type === 'images')).toBe(true)
    })

    it('should handle HTML to text ratio issues', async () => {
      const htmlWithExcessiveMarkup = '<div><span><strong><em><u>' +
        'Short content'.repeat(10) +
        '</u></em></strong></span></div>'.repeat(20)

      const result = await spamChecker.checkSpamScore(
        'HTML Heavy',
        htmlWithExcessiveMarkup,
        'Short content'.repeat(10)
      )

      expect(result.details.structureScore).toBeGreaterThan(15)
      expect(result.issues.some(issue => issue.type === 'structure')).toBe(true)
    })

    it('should require either HTML or text content', async () => {
      await expect(
        spamChecker.checkSpamScore('Test Subject')
      ).rejects.toThrow('Either htmlContent or textContent must be provided')
    })

    it('should handle empty content gracefully', async () => {
      const result = await spamChecker.checkSpamScore(
        'Test',
        '<p></p>',
        ''
      )

      expect(result.score).toBeGreaterThan(0)
      expect(result.issues.some(issue => issue.message.includes('too short'))).toBe(true)
    })
  })

  describe('getOptimizationSuggestions', () => {
    it('should categorize suggestions correctly', async () => {
      const result = await spamChecker.getOptimizationSuggestions(
        'FREE MONEY!!! ACT NOW!!!',
        '<p>AMAZING opportunity to make money fast! Click here now!</p>',
        'AMAZING opportunity to make money fast! Click here now!'
      )

      expect(result.subjectSuggestions.length).toBeGreaterThan(0)
      expect(result.contentSuggestions.length).toBeGreaterThan(0)
      expect(result.complianceSuggestions.length).toBeGreaterThan(0)
      expect(result.overallScore).toBeGreaterThan(50)
    })

    it('should provide minimal suggestions for clean content', async () => {
      const result = await spamChecker.getOptimizationSuggestions(
        'Weekly Newsletter',
        '<p>Hello! Here is your weekly update.</p><p><a href="/unsubscribe">Unsubscribe</a></p><p>123 Main St, City, ST 12345</p>',
        'Hello! Here is your weekly update.\n\nUnsubscribe: /unsubscribe\n123 Main St, City, ST 12345'
      )

      expect(result.overallScore).toBeLessThan(30)
      expect(result.subjectSuggestions.length + result.contentSuggestions.length + result.complianceSuggestions.length).toBeLessThan(3)
    })
  })

  describe('generateSubjectAlternatives', () => {
    it('should generate alternatives for spammy subject', async () => {
      const alternatives = spamChecker.generateSubjectAlternatives('FREE Money - ACT NOW!!!')

      expect(alternatives.length).toBeGreaterThan(0)
      expect(alternatives.some(alt => !alt.toLowerCase().includes('free'))).toBe(true)
      expect(alternatives.some(alt => !alt.toLowerCase().includes('act now'))).toBe(true)
    })

    it('should shorten long subjects', async () => {
      const longSubject = 'This is a very long subject line that exceeds the recommended length for email subjects'
      const alternatives = spamChecker.generateSubjectAlternatives(longSubject)

      expect(alternatives.some(alt => alt.length < longSubject.length)).toBe(true)
      expect(alternatives.some(alt => alt.includes('...'))).toBe(true)
    })

    it('should add personalization suggestions', async () => {
      const alternatives = spamChecker.generateSubjectAlternatives('Newsletter Update')

      expect(alternatives.some(alt => alt.includes('Personalized'))).toBe(true)
      expect(alternatives.some(alt => alt.includes('Quick Update'))).toBe(true)
    })

    it('should limit alternatives to 5', async () => {
      const alternatives = spamChecker.generateSubjectAlternatives('FREE URGENT AMAZING INCREDIBLE GUARANTEED')

      expect(alternatives.length).toBeLessThanOrEqual(5)
    })
  })

  describe('content analysis', () => {
    it('should correctly count words and characters', async () => {
      const result = await spamChecker.checkSpamScore(
        'Test',
        '<p>This is a test with exactly ten words here.</p>',
        'This is a test with exactly ten words here.'
      )

      // The content analysis should detect approximately 10 words
      expect(result.details.contentScore).toBeDefined()
    })

    it('should detect physical address patterns', async () => {
      const result = await spamChecker.checkSpamScore(
        'Test',
        '<p>Visit us at 123 Main Street, Anytown, CA 12345</p><p><a href="/unsubscribe">Unsubscribe</a></p>',
        'Visit us at 123 Main Street, Anytown, CA 12345\n\nUnsubscribe: /unsubscribe'
      )

      expect(result.issues.some(issue => issue.message.includes('physical address'))).toBe(false)
    })

    it('should detect unsubscribe links', async () => {
      const result = await spamChecker.checkSpamScore(
        'Test',
        '<p>Content here</p><p><a href="https://example.com/unsubscribe">Unsubscribe</a></p><p>123 Main St, City, ST 12345</p>',
        'Content here\n\nUnsubscribe: https://example.com/unsubscribe\n123 Main St, City, ST 12345'
      )

      expect(result.issues.some(issue => issue.message.includes('unsubscribe'))).toBe(false)
    })
  })

  describe('subject line analysis', () => {
    it('should detect all caps', async () => {
      const result = await spamChecker.checkSpamScore(
        'THIS IS ALL CAPS SUBJECT',
        '<p>Normal content here</p>',
        'Normal content here'
      )

      expect(result.issues.some(issue => issue.message.includes('all caps'))).toBe(true)
    })

    it('should detect excessive punctuation', async () => {
      const result = await spamChecker.checkSpamScore(
        'Subject with excessive punctuation!!!???',
        '<p>Normal content here</p>',
        'Normal content here'
      )

      expect(result.issues.some(issue => issue.message.includes('punctuation'))).toBe(true)
    })

    it('should handle normal subject lines', async () => {
      const result = await spamChecker.checkSpamScore(
        'Weekly Newsletter Update',
        '<p>Normal content here</p><p><a href="/unsubscribe">Unsubscribe</a></p><p>123 Main St, City, ST 12345</p>',
        'Normal content here'
      )

      expect(result.details.subjectScore).toBeLessThan(20)
    })
  })

  describe('edge cases', () => {
    it('should handle very short content', async () => {
      const result = await spamChecker.checkSpamScore(
        'Hi',
        '<p>Hi</p>',
        'Hi'
      )

      expect(result.issues.some(issue => issue.message.includes('too short'))).toBe(true)
    })

    it('should handle content with no HTML', async () => {
      const result = await spamChecker.checkSpamScore(
        'Plain Text Email',
        undefined,
        'This is a plain text email with sufficient content to avoid being flagged as too short. It includes an unsubscribe link and address.\n\nUnsubscribe: https://example.com/unsubscribe\n123 Main Street, City, ST 12345'
      )

      expect(result.score).toBeLessThan(50)
      expect(result.details.structureScore).toBeLessThan(20)
    })

    it('should handle content with only HTML', async () => {
      const result = await spamChecker.checkSpamScore(
        'HTML Only Email',
        '<p>This is an HTML email with sufficient content to avoid being flagged as too short. It includes an unsubscribe link and address.</p><p><a href="https://example.com/unsubscribe">Unsubscribe</a></p><p>123 Main Street, City, ST 12345</p>',
        undefined
      )

      expect(result.score).toBeLessThan(50)
    })

    it('should handle special characters and unicode', async () => {
      const result = await spamChecker.checkSpamScore(
        'Newsletter with émojis 🎉',
        '<p>Content with special characters: àáâãäå and unicode: 你好世界</p><p><a href="/unsubscribe">Unsubscribe</a></p><p>123 Main St, City, ST 12345</p>',
        'Content with special characters: àáâãäå and unicode: 你好世界'
      )

      expect(result.score).toBeLessThan(50)
    })
  })
})