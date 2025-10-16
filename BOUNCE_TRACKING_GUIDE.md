# Bounce Tracking System - Implementation Guide

## Overview

This comprehensive bounce tracking system automatically detects bounce emails, correlates them with sent campaigns, updates contact engagement status, and displays bounce analytics in real-time.

## Architecture

### Components

1. **Bounce Email Parser** (`lib/bounce-email-parser.ts`)
   - RFC 3464 (DSN) and RFC 3463 (Enhanced Status Codes) compliant
   - Parses bounce/NDR (Non-Delivery Report) emails
   - Extracts diagnostic codes, status codes, and recipient information
   - Supports VERP (Variable Envelope Return Path) encoding/decoding

2. **Bounce Processor** (`lib/bounce-processor.ts`)
   - Orchestrates bounce detection and processing
   - Correlates bounces with sent emails using multiple methods
   - Updates contact engagement status automatically
   - Manages campaign statistics

3. **Integration with Reply Processor** (`lib/reply-processor.ts`)
   - Enhanced `handleBounce` method using comprehensive bounce parser
   - Automatic classification and action routing
   - Fallback handling for edge cases

4. **Campaign Processor Enhancement** (`lib/campaign-processor.ts`)
   - VERP return-path generation for all sent emails
   - Custom headers for tracking (X-Campaign-ID, X-Contact-ID, X-Tracking-ID)
   - Enhanced envelope sender configuration

5. **API Endpoints**
   - `POST /api/bounces/process` - Process bounces manually or via webhook
   - `GET /api/bounces/stats` - Retrieve bounce statistics

6. **UI Component** (`src/components/campaigns/BounceStatistics.tsx`)
   - Real-time bounce statistics display
   - Bounce type breakdown (hard, soft, complaint)
   - Recent bounces list with contact correlation
   - Category-based analytics

## How It Works

### 1. Email Sending with VERP

When sending a campaign email:

```typescript
// VERP return-path is generated
const verpReturnPath = generateVERPAddress(
  'bounce@yourdomain.com',
  campaignId,
  recipientEmail
)
// Result: bounce+campaign123+recipient=example.com@yourdomain.com
```

**Key Features:**
- Unique return-path for each email
- Campaign ID embedded for tracking
- Contact email encoded in address
- Bounces automatically route to this address

### 2. Bounce Detection

When an email bounces, the mail server sends a bounce notification to the VERP address.

The system detects bounces using multiple indicators:
- **Sender Analysis**: Checks for mailer-daemon, postmaster, etc.
- **Subject Patterns**: "Delivery Status Notification", "Undeliverable", etc.
- **Content Patterns**: SMTP error codes, DSN fields, diagnostic codes
- **Confidence Scoring**: >= 50% confidence threshold

### 3. Bounce Parsing

The parser extracts:

- **Status Codes**: SMTP (550, 450) and Enhanced (5.1.1, 4.2.2)
- **Bounce Type**: hard, soft, complaint, transient, unknown
- **Bounce Category**: invalid_recipient, mailbox_full, spam_complaint, etc.
- **Original Recipient**: The email address that bounced
- **Diagnostic Code**: Full error message from mail server
- **MTA Information**: Reporting and remote mail servers

Example parsed bounce:
```typescript
{
  bounceType: 'hard',
  bounceCategory: 'invalid_recipient',
  statusCode: '550 5.1.1',
  enhancedStatusCode: '5.1.1',
  originalRecipient: 'user@example.com',
  diagnosticCode: 'User unknown',
  originalMessageId: '<message-id-from-sent-email>'
}
```

### 4. Bounce Correlation

The system correlates bounces with sent emails using three methods (in priority order):

#### Method 1: VERP Matching (Most Reliable)
```typescript
// Parse VERP address
const { campaignId, contactEmail } = parseVERPAddress(
  'bounce+campaign123+user=example.com@domain.com'
)
// Find contact and tracking record
```

#### Method 2: Message-ID Matching
```typescript
// Match using In-Reply-To header or original Message-ID
SELECT * FROM email_tracking
WHERE message_id = '<original-message-id>'
```

#### Method 3: Recipient Email Matching
```typescript
// Match by recipient email address
SELECT * FROM contacts
WHERE email = 'bounced-recipient@example.com'
```

### 5. Contact Status Update

Based on bounce type:

**Hard Bounce (Permanent Failure)**
- Immediately sets `engagement_status = 'bad'`
- Marks contact for exclusion from future campaigns
- Pauses active campaigns for this contact
- Examples: User unknown, domain not found

**Soft Bounce (Temporary Failure)**
- Increments `engagement_bounce_count`
- Lets engagement system handle status based on count
- Examples: Mailbox full, message too large

**Spam Complaint**
- Immediately sets `engagement_status = 'bad'`
- High-priority flag for compliance
- Automatic removal from all campaigns

### 6. Engagement Recalculation

After bounce processing:

```typescript
// Automatic engagement recalculation
const result = await recalculateContactEngagement(supabase, contactId)

// Bounce penalties applied:
// - Hard bounce: engagement_status = 'bad', score = 0
// - Soft bounce: score -= 50 per bounce
// - Complaint: engagement_status = 'bad', score -= 100
```

### 7. Campaign Statistics Update

```typescript
// Increment campaign bounce counter
UPDATE campaigns
SET emails_bounced = emails_bounced + 1
WHERE id = campaign_id
```

## Database Schema

### Tables Updated

**email_tracking**
- `bounced_at` - Timestamp of bounce
- `bounce_type` - hard/soft/complaint
- `bounce_reason` - Diagnostic message
- `status` - Set to 'bounced'

**contacts**
- `engagement_status` - Set to 'bad' for hard bounces
- `engagement_bounce_count` - Incremented for soft bounces
- `engagement_updated_at` - Timestamp of update

**campaigns**
- `emails_bounced` - Total bounce count

**email_replies**
- New record created for each bounce
- Links bounce to campaign and contact
- Stores bounce details and actions taken

## API Usage

### Process Bounce (Manual/Webhook)

```bash
# Process a specific email
curl -X POST /api/bounces/process \
  -H "Content-Type: application/json" \
  -d '{"emailId": "email-uuid"}'

# Process all unprocessed bounces
curl -X POST /api/bounces/process \
  -H "Content-Type: application/json" \
  -d '{"processAll": true}'
```

Response:
```json
{
  "success": true,
  "bounceDetected": true,
  "contactId": "contact-uuid",
  "campaignId": "campaign-uuid",
  "bounceType": "hard",
  "contactStatusUpdated": true,
  "engagementRecalculated": true
}
```

### Get Bounce Statistics

```bash
# Get all bounce stats
curl /api/bounces/stats

# Filter by date
curl "/api/bounces/stats?dateFrom=2025-01-01T00:00:00Z"

# Get campaign-specific stats
curl "/api/bounces/stats?campaignId=campaign-uuid"
```

Response:
```json
{
  "total": 45,
  "hard": 30,
  "soft": 12,
  "complaint": 3,
  "byCategory": {
    "invalid_recipient": 25,
    "mailbox_full": 8,
    "spam_complaint": 3,
    "message_too_large": 4,
    "network_error": 5
  },
  "recentBounces": [
    {
      "contactEmail": "user@example.com",
      "bounceType": "hard",
      "bounceCategory": "invalid_recipient",
      "bouncedAt": "2025-10-16T10:30:00Z",
      "campaignName": "Product Launch Campaign"
    }
  ]
}
```

## UI Integration

### Add Bounce Statistics to Campaign Dashboard

```tsx
import { BounceStatistics } from '@/components/campaigns/BounceStatistics'

// In your campaign dashboard component
<BounceStatistics
  campaignId={campaignId}
  showRecentBounces={true}
/>
```

Features:
- Real-time bounce statistics
- Visual breakdown by bounce type
- Category-based analytics
- Recent bounces list
- Bounce rate calculation

## Testing

### Manual Testing

1. **Send Test Campaign**
   ```bash
   # Campaign sends with VERP return-path
   # Check email headers for: Return-Path: bounce+campaign_id+recipient@domain.com
   ```

2. **Simulate Bounce**
   - Send email to invalid address (e.g., `nonexistent@invalid-domain-12345.com`)
   - Check `incoming_emails` table for bounce notification
   - Verify bounce is detected and parsed

3. **Check Correlation**
   ```sql
   -- Verify bounce was correlated with contact
   SELECT * FROM email_tracking
   WHERE bounced_at IS NOT NULL
   ORDER BY bounced_at DESC LIMIT 10;

   -- Check contact status update
   SELECT id, email, engagement_status, engagement_bounce_count
   FROM contacts
   WHERE engagement_status = 'bad';
   ```

4. **Verify Campaign Stats**
   ```sql
   SELECT id, name, emails_sent, emails_bounced
   FROM campaigns
   WHERE emails_bounced > 0;
   ```

### Automated Testing

Create test files:
- `lib/bounce-email-parser.test.ts` - Test bounce parsing
- `lib/bounce-processor.test.ts` - Test bounce processing workflow
- Test VERP encoding/decoding
- Test correlation methods
- Test contact status updates

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Bounce Rate**: `(emails_bounced / emails_sent) * 100`
   - Healthy: < 2%
   - Warning: 2-5%
   - Critical: > 5%

2. **Hard Bounce Rate**: Should be < 1%
3. **Complaint Rate**: Should be < 0.1%

### Maintenance Tasks

1. **Daily**: Check bounce processing logs for errors
2. **Weekly**: Review bounce categories for patterns
3. **Monthly**: Clean up contacts marked as 'bad' for > 90 days
4. **Quarterly**: Review and update bounce classification rules

### Troubleshooting

**Bounces not being detected:**
- Check `incoming_emails` table for bounce notifications
- Verify email account can receive bounces
- Check VERP return-path configuration

**Bounces not correlated with contacts:**
- Verify VERP address format
- Check Message-ID headers in sent emails
- Review correlation method logs

**Contact status not updating:**
- Check `email_tracking` updates
- Verify `recalculateContactEngagement` is running
- Review engagement calculation logic

## Best Practices

1. **VERP Configuration**
   - Use a dedicated bounce email address (e.g., `bounce@yourdomain.com`)
   - Ensure proper DNS/SPF records
   - Monitor bounce inbox regularly

2. **Contact Management**
   - Respect 'bad' status contacts (never send)
   - Review soft bounces after 3 attempts
   - Provide re-engagement workflows

3. **Campaign Health**
   - Pause campaigns with >5% bounce rate
   - Investigate bounce patterns
   - Clean contact lists before sending

4. **Compliance**
   - Handle spam complaints immediately
   - Maintain bounce logs for audit
   - Follow CAN-SPAM and GDPR requirements

## Future Enhancements

- [ ] Webhook integration for real-time bounce processing
- [ ] Machine learning for bounce classification
- [ ] Automatic list cleaning based on bounce patterns
- [ ] Bounce prediction before sending
- [ ] Integration with email verification services
- [ ] Detailed bounce analytics dashboard
- [ ] Export bounce reports
- [ ] Bounce notification alerts

## References

- RFC 3464: Delivery Status Notifications (DSN)
- RFC 3463: Enhanced Mail System Status Codes
- RFC 5321: Simple Mail Transfer Protocol
- VERP: Variable Envelope Return Path specification

## Support

For issues or questions:
- Check logs in campaign processor
- Review bounce detection confidence scores
- Verify database schema matches expected structure
- Test with known bounce scenarios
