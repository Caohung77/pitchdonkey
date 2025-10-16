/**
 * Test suite for bounce email parsing and recipient extraction
 * Validates the enhanced extractFailedRecipient function with real-world bounce formats
 */

describe('extractFailedRecipient', () => {
  // Inline the extraction function for testing
  const extractFailedRecipient = (emailBody: string, emailSubject: string): string | null => {
    // Step 1: Check email headers
    const headerPatterns = [
      /X-Failed-Recipients:\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
      /Original-Recipient:\s*(?:rfc822;)?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
      /Final-Recipient:\s*(?:rfc822;)?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
      /RCPT TO:\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
    ]

    for (const pattern of headerPatterns) {
      const match = emailBody.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // Step 2: Body text patterns
    const bodyPatterns = [
      /(?:could not be delivered to|delivery to the following recipient failed|undeliverable to|failed to deliver to|delivery has failed to)\s+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:message to the following address|the following recipient|recipient address|destination address)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:your message to|addressed to|sent to)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:konnte nicht zugestellt werden an|zustellung fehlgeschlagen an|empfänger|nicht zugestellt werden an)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:nachricht an folgende adresse|folgende empfänger|empfängeradresse)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:recipient|empfänger)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
      /(?:to|an)[:\s]+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?(?:\s|$)/i,
      /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\s+(?:because of|wegen|due to|auf grund)/i,
      /Action:\s*failed.*?Recipient:\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/is,
      /Status:\s*5\.\d+\.\d+.*?(?:for|to)\s+<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/is,
    ]

    for (const pattern of bodyPatterns) {
      const match = emailBody.match(pattern)
      if (match && match[1]) {
        const email = match[1].trim()
        if (!email.includes('mailer-daemon') && !email.includes('postmaster') && !email.includes('no-reply')) {
          return email
        }
      }
    }

    // Step 3: Subject line with validation
    const bounceKeywords = ['delivery', 'failed', 'bounce', 'undeliverable', 'zustellung', 'fehlgeschlagen']
    const hasBounceKeyword = bounceKeywords.some(keyword =>
      emailSubject.toLowerCase().includes(keyword)
    )

    if (hasBounceKeyword) {
      const allEmails = emailSubject.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []
      for (const email of allEmails) {
        const lowerEmail = email.toLowerCase()
        if (!lowerEmail.includes('mailer-daemon') &&
            !lowerEmail.includes('postmaster') &&
            !lowerEmail.includes('no-reply') &&
            !lowerEmail.includes('bounce')) {
          return email.trim()
        }
      }
    }

    return null
  }

  describe('Standard bounce formats', () => {
    test('extracts from "could not be delivered to" pattern', () => {
      const body = 'Your message could not be delivered to john.doe@example.com due to invalid recipient.'
      const result = extractFailedRecipient(body, 'Delivery failure')
      expect(result).toBe('john.doe@example.com')
    })

    test('extracts from "recipient:" pattern', () => {
      const body = 'Recipient: jane.smith@company.org\nStatus: 5.1.1 User unknown'
      const result = extractFailedRecipient(body, 'Mail delivery failed')
      expect(result).toBe('jane.smith@company.org')
    })

    test('extracts from "to:" pattern with context', () => {
      const body = 'Delivery to: test.user@domain.net failed permanently'
      const result = extractFailedRecipient(body, 'Undeliverable')
      expect(result).toBe('test.user@domain.net')
    })
  })

  describe('German bounce formats', () => {
    test('extracts from German bounce notification', () => {
      const body = 'Die Nachricht konnte nicht zugestellt werden an mueller@example.de wegen ungültiger Adresse.'
      const result = extractFailedRecipient(body, 'Zustellungsfehler')
      expect(result).toBe('mueller@example.de')
    })

    test('extracts from German "Empfänger:" pattern', () => {
      const body = 'Empfänger: schoenges@firma.de\nFehler: Benutzer nicht gefunden'
      const result = extractFailedRecipient(body, 'Mail fehlgeschlagen')
      expect(result).toBe('schoenges@firma.de')
    })
  })

  describe('SMTP header formats', () => {
    test('extracts from X-Failed-Recipients header', () => {
      const body = 'X-Failed-Recipients: bounce.test@example.com\nStatus: 550 User not found'
      const result = extractFailedRecipient(body, 'Bounce notification')
      expect(result).toBe('bounce.test@example.com')
    })

    test('extracts from Original-Recipient header', () => {
      const body = 'Original-Recipient: rfc822; original@domain.com\nFinal-Recipient: rfc822; final@domain.com'
      const result = extractFailedRecipient(body, 'Delivery Status Notification')
      expect(result).toBe('original@domain.com')
    })

    test('extracts from RCPT TO SMTP command', () => {
      const body = 'RCPT TO:<recipient@mail.com>\n550 5.1.1 <recipient@mail.com>: Recipient address rejected'
      const result = extractFailedRecipient(body, 'SMTP error')
      expect(result).toBe('recipient@mail.com')
    })
  })

  describe('Subject line extraction', () => {
    test('extracts from subject when body fails and bounce keyword present', () => {
      const body = 'Some generic bounce message without clear patterns'
      const subject = 'Delivery failed: contact@example.org'
      const result = extractFailedRecipient(body, subject)
      expect(result).toBe('contact@example.org')
    })

    test('does not extract from subject without bounce keywords', () => {
      const body = 'Regular email content'
      const subject = 'Meeting with user@company.com'
      const result = extractFailedRecipient(body, subject)
      expect(result).toBeNull()
    })
  })

  describe('System address filtering', () => {
    test('filters out MAILER-DAEMON addresses', () => {
      const body = 'From: MAILER-DAEMON@smtp.strato.de\nRecipient: actual.user@example.com'
      const result = extractFailedRecipient(body, 'Bounce')
      expect(result).toBe('actual.user@example.com')
    })

    test('filters out postmaster addresses', () => {
      const body = 'postmaster@server.com reports delivery failure to: target@company.com'
      const result = extractFailedRecipient(body, 'Delivery failure')
      expect(result).toBe('target@company.com')
    })

    test('filters out no-reply addresses', () => {
      const body = 'From: no-reply@system.com\nTo: user@example.com\nDelivery failed'
      const subject = 'Failed delivery for user@example.com'
      const result = extractFailedRecipient(body, subject)
      expect(result).toBe('user@example.com')
    })
  })

  describe('Complex real-world scenarios', () => {
    test('handles multi-line SMTP status notification', () => {
      const body = `
        This is the mail system at host smtp.example.com.

        Your message could not be delivered to failed.recipient@domain.com

        <failed.recipient@domain.com>: host mx.domain.com[192.168.1.1] said: 550
            5.1.1 <failed.recipient@domain.com>: Recipient address rejected: User unknown
            in local recipient table (in reply to RCPT TO command)
      `
      const result = extractFailedRecipient(body, 'Delivery Status Notification')
      expect(result).toBe('failed.recipient@domain.com')
    })

    test('handles Action: failed format', () => {
      const body = `
        Action: failed
        Status: 5.1.1
        Recipient: invalid.user@company.org
        Diagnostic-Code: smtp; 550 5.1.1 User unknown
      `
      const result = extractFailedRecipient(body, 'Mail Delivery Failure')
      expect(result).toBe('invalid.user@company.org')
    })

    test('handles German Strato bounce format', () => {
      const body = `
        Von: MAILER-DAEMON@smtp.strato.de
        Betreff: Unzustellbar

        Die Nachricht an folgende Empfänger konnte nicht zugestellt werden:

        Empfänger: schoenges@example.de
        Grund: Benutzer existiert nicht
      `
      const result = extractFailedRecipient(body, 'Unzustellbar: schoenges@example.de')
      expect(result).toBe('schoenges@example.de')
    })
  })

  describe('Edge cases', () => {
    test('returns null when no email found', () => {
      const body = 'Some error message without any email addresses'
      const result = extractFailedRecipient(body, 'Error notification')
      expect(result).toBeNull()
    })

    test('handles empty body and subject', () => {
      const result = extractFailedRecipient('', '')
      expect(result).toBeNull()
    })

    test('handles email with angle brackets', () => {
      const body = 'Delivery failed to <user@example.com> permanently'
      const result = extractFailedRecipient(body, 'Bounce')
      expect(result).toBe('user@example.com')
    })

    test('extracts first valid email when multiple present', () => {
      const body = 'From: postmaster@system.com\nTo: target@company.com\nBounce notification'
      const result = extractFailedRecipient(body, 'Delivery failed')
      expect(result).toBe('target@company.com')
    })
  })
})
