# Campaign Scheduling Workflow Documentation

## Overview

This document outlines the complete workflow for scheduling and executing email campaigns in PitchDonkey, covering both Gmail OAuth and SMTP email account integrations.

## Architecture Overview

The campaign scheduling system consists of several key components:

- **Campaign Creation & Scheduling**: Frontend campaign builder with scheduling options
- **Campaign Processor**: Background service that executes scheduled campaigns
- **Cron Job System**: Ubuntu server-based external cron jobs for reliable scheduling
- **Email Providers**: Gmail OAuth and SMTP integrations for sending emails
- **Database**: Supabase for campaign state management and email tracking

## Campaign Lifecycle

### 1. Campaign States

```
draft → scheduled → sending → completed/paused/failed
```

- **draft**: Campaign being created, not ready to send
- **scheduled**: Campaign ready for future execution at `scheduled_date`
- **sending**: Campaign currently being processed (sends emails in batches)
- **completed**: All emails sent successfully
- **paused**: Campaign stopped manually or due to errors
- **failed**: Campaign failed due to configuration issues

### 2. Campaign Creation Process

```typescript
// Campaign creation payload
{
  name: string,
  email_subject: string,
  html_content: string,
  contact_list_ids: string[],
  from_email_account_id: string,  // Gmail or SMTP account ID
  scheduled_date?: string,        // ISO string for future sending
  daily_send_limit?: number,      // Default: 50 for SMTP, 100 for Gmail
  send_immediately?: boolean      // For immediate sending
}
```

**API Endpoint**: `POST /api/campaigns`

**Flow**:
1. User creates campaign with scheduling options
2. System validates email account and contact lists
3. Campaign saved with `scheduled` status if future date provided
4. If `send_immediately=true`, status set to `sending`

## Email Account Integration

### Gmail OAuth Accounts

**Provider**: `gmail` or `gmail-imap-smtp`

**Authentication**:
- OAuth2 flow with Google APIs
- Encrypted `access_token` and `refresh_token` storage
- Automatic token refresh handling

**Configuration**:
```typescript
{
  provider: 'gmail',
  email: 'user@gmail.com',
  access_token: 'encrypted_token',
  refresh_token: 'encrypted_token',
  daily_send_limit: 100,
  status: 'active'
}
```

**Sending Process**:
1. Decrypt OAuth tokens from database
2. Create Gmail API service instance
3. Use Gmail SMTP/API for email delivery
4. Handle token refresh automatically if needed

**Daily Limits**: 100 emails/day (configurable)

### SMTP Accounts

**Provider**: `smtp`

**Authentication**:
- Username/password authentication
- Support for various SMTP servers (Gmail SMTP, Outlook, custom)

**Configuration**:
```typescript
{
  provider: 'smtp',
  email: 'user@domain.com',
  smtp_host: 'smtp.gmail.com',
  smtp_port: 587,
  smtp_secure: false,
  smtp_username: 'user@domain.com',
  smtp_password: 'encrypted_password',
  daily_send_limit: 50,
  status: 'active'
}
```

**Sending Process**:
1. Create nodemailer transporter with SMTP config
2. Send emails using SMTP protocol
3. Handle connection errors and retries

**Daily Limits**: 50 emails/day (configurable)

## Scheduling System

### Ubuntu Cron Job Configuration

**Cron Schedule**: Every 5 minutes
```bash
*/5 * * * * curl -X POST "https://pitchdonkey.vercel.app/api/cron/process-campaigns" \
  -H "Authorization: Bearer $CRON_SECRET" \
  >> /var/log/pitchdonkey-cron.log 2>&1
```

**Environment Variables Required**:
- `CRON_SECRET`: Authentication token for cron endpoint
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access

### Cron Job Workflow

**Endpoint**: `POST /api/cron/process-campaigns`

**Authentication**:
- Requires `Authorization: Bearer $CRON_SECRET` header
- Alternative: Vercel cron user agent (`vercel-cron`)

**Process Flow**:

1. **Campaign Discovery**
   ```sql
   SELECT * FROM campaigns
   WHERE status IN ('scheduled', 'sending')
     AND (scheduled_date <= NOW() OR status = 'sending')
   ORDER BY created_at ASC
   ```

2. **Status Updates**
   - `scheduled` → `sending` when `scheduled_date <= NOW()`
   - Campaigns already in `sending` status are processed immediately

3. **Campaign Processing**
   - Import and invoke `campaignProcessor.processReadyCampaigns()`
   - Process campaigns sequentially to avoid conflicts
   - Update campaign status based on results

4. **Error Handling**
   - Failed campaigns reverted to `scheduled` status
   - Detailed error logging for debugging
   - Graceful degradation on processing errors

## Campaign Processor

### Main Processor: `lib/campaign-processor.ts`

**Key Features**:
- Singleton pattern for consistent state management
- Separate email account fetching (works with both Gmail and SMTP)
- Batch processing with daily limits
- Rate limiting and delay management

**Processing Flow**:

1. **Campaign Validation**
   ```typescript
   // Check if campaign is ready to send
   if (campaign.status === 'scheduled') {
     const scheduledTime = new Date(campaign.scheduled_date)
     const now = new Date()
     if (scheduledTime > now) {
       return // Not ready yet
     }
   }
   ```

2. **Email Account Resolution**
   ```typescript
   // Fetch email account separately (not in JOIN)
   const { data: emailAccount } = await supabase
     .from('email_accounts')
     .select('*')
     .eq('user_id', campaign.user_id)
     .eq('id', campaign.from_email_account_id)
     .eq('status', 'active')
     .single()
   ```

3. **Contact Processing**
   - Resolve contact lists to individual contacts
   - Apply daily sending limits
   - Create email tracking records

4. **Email Sending**
   - Route to appropriate provider (Gmail OAuth or SMTP)
   - Apply rate limiting delays
   - Update tracking records with results

5. **Campaign Completion**
   - Update campaign statistics
   - Set status to `completed` when all emails processed

### Deprecated Processor: `lib/campaign-processor-fixed.ts`

**Issues**:
- Broken JOIN query that fails for SMTP accounts
- Complex email account relationship handling
- Used to cause scheduled SMTP campaigns to fail

**Status**: No longer used in cron jobs (fixed in recent update)

## Email Sending Workflows

### Gmail OAuth Workflow

```typescript
async function sendGmailEmail(accountId: string, emailData: EmailData) {
  // 1. Fetch and decrypt OAuth tokens
  const account = await getEmailAccount(accountId)
  const tokens = await decryptOAuthTokens(account)

  // 2. Create Gmail service with automatic token refresh
  const gmailService = new GmailIMAPSMTPServerService()

  // 3. Send email using Gmail API/SMTP
  const result = await gmailService.sendGmailEmail(accountId, emailData)

  // 4. Update tracking record
  await updateEmailTracking(result)
}
```

**Advantages**:
- Higher daily limits (100 emails/day)
- Better deliverability
- Automatic token management
- Integration with Gmail features

**Requirements**:
- OAuth2 setup with Google
- Encrypted token storage
- Service account or domain verification

### SMTP Workflow

```typescript
async function sendSMTPEmail(emailAccount: SMTPAccount, emailData: EmailData) {
  // 1. Create nodemailer transporter
  const transporter = nodemailer.createTransporter({
    host: emailAccount.smtp_host,
    port: emailAccount.smtp_port,
    secure: emailAccount.smtp_secure,
    auth: {
      user: emailAccount.smtp_username,
      pass: emailAccount.smtp_password,
    },
  })

  // 2. Send email
  const info = await transporter.sendMail({
    from: `"${senderName}" <${emailAccount.email}>`,
    to: contact.email,
    subject: personalizedSubject,
    html: htmlContent
  })

  // 3. Update tracking record
  await updateEmailTracking({
    messageId: info.messageId,
    status: 'delivered'
  })
}
```

**Advantages**:
- Works with any SMTP provider
- Simple configuration
- No OAuth complexity

**Limitations**:
- Lower daily limits (50 emails/day)
- Potential deliverability issues
- Manual credential management

## Email Tracking System

### Tracking Records

**Table**: `email_tracking`

```typescript
{
  id: string,
  user_id: string,
  campaign_id: string,
  contact_id: string,
  message_id: string,
  tracking_pixel_id: string,
  email_account_id: string,
  status: 'pending' | 'delivered' | 'failed' | 'bounced',
  sent_at: datetime,
  delivered_at: datetime,
  opened_at: datetime,
  clicked_at: datetime,
  bounced_at: datetime,
  bounce_reason: string
}
```

### Tracking Flow

1. **Record Creation**
   - Created before email sending attempt
   - Initial status: `pending`
   - Includes tracking pixel ID for open tracking

2. **Sending Results**
   - Success: Status → `delivered`, `sent_at` and `delivered_at` set
   - Failure: Status → `failed`, error details recorded
   - Bounce: Status → `bounced`, `bounced_at` and `bounce_reason` set

3. **Engagement Tracking**
   - Opens: Tracking pixel requests update `opened_at`
   - Clicks: Link redirects update `clicked_at`
   - Replies: IMAP monitoring updates `replied_at`

## Rate Limiting & Performance

### Daily Limits

**Gmail OAuth**: 100 emails/day per account
**SMTP**: 50 emails/day per account

### Rate Limiting Implementation

```typescript
// Check daily quota
const startOfDay = new Date()
startOfDay.setHours(0,0,0,0)

const { data: sentTodayRows } = await supabase
  .from('email_tracking')
  .select('sent_at')
  .eq('campaign_id', campaign.id)
  .gte('sent_at', startOfDay.toISOString())

const sentToday = sentTodayRows.length
const remainingToday = Math.max(0, dailyLimit - sentToday)
```

### Sending Delays

**Configuration**:
- Production: 30-60 seconds between emails
- Development: 1-2 seconds between emails
- Configurable via environment variables

```typescript
const delayConfig = {
  min: process.env.CAMPAIGN_SEND_DELAY_MIN_MS || 30000,
  max: process.env.CAMPAIGN_SEND_DELAY_MAX_MS || 60000
}
```

## Error Handling & Debugging

### Common Issues

1. **SMTP Authentication Failures**
   - Verify SMTP credentials
   - Check if 2FA/app passwords required
   - Validate SMTP host/port configuration

2. **Gmail OAuth Token Expiry**
   - Automatic refresh handling implemented
   - Re-authentication flow available in UI
   - Encrypted token storage prevents exposure

3. **Campaign Stuck in Scheduled Status**
   - Check cron job execution logs
   - Verify `CRON_SECRET` environment variable
   - Ensure Ubuntu server connectivity to Vercel

4. **Daily Limit Exceeded**
   - Campaign automatically pauses when limit reached
   - Resumes next day automatically
   - Configurable limits per email account

### Debug Endpoints

**Check Scheduled Campaigns**: `GET /api/debug/check-scheduled-campaigns`
**Campaign Query Debug**: `GET /api/debug/campaign-query`
**Email System Status**: `GET /api/debug/email-system`
**Manual Campaign Process**: `POST /api/campaigns/manual-send`

### Logging

**Cron Job Logs**: `/var/log/pitchdonkey-cron.log`
**Application Logs**: Vercel function logs
**Database Logs**: Supabase dashboard

## Configuration

### Environment Variables

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key

# Cron Authentication
CRON_SECRET=your_cron_secret

# Email Rate Limiting
CAMPAIGN_SEND_DELAY_MIN_MS=30000
CAMPAIGN_SEND_DELAY_MAX_MS=60000

# Gmail OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Encryption
ENCRYPTION_KEY=your_encryption_key
```

### Ubuntu Cron Setup

1. **Install cron job**:
   ```bash
   crontab -e
   ```

2. **Add schedule**:
   ```bash
   */5 * * * * curl -X POST "https://pitchdonkey.vercel.app/api/cron/process-campaigns" \
     -H "Authorization: Bearer $CRON_SECRET" \
     >> /var/log/pitchdonkey-cron.log 2>&1
   ```

3. **Set environment variable**:
   ```bash
   export CRON_SECRET="your_secret_here"
   ```

## Best Practices

### Campaign Creation
- Always test with small contact lists first
- Verify email account status before scheduling
- Set appropriate daily limits based on provider
- Use meaningful campaign names and descriptions

### Email Account Management
- Regularly verify OAuth token validity
- Monitor daily sending quotas
- Use dedicated sending accounts for campaigns
- Implement proper SPF/DKIM/DMARC records

### Monitoring & Maintenance
- Monitor cron job execution logs
- Set up alerts for campaign failures
- Regular database cleanup of old tracking records
- Performance monitoring for email delivery times

### Security
- Never commit SMTP passwords or OAuth secrets
- Use environment variables for all sensitive data
- Implement proper access controls for campaign management
- Regular security audits of email account configurations

## Troubleshooting Guide

### Scheduled Campaigns Not Sending

1. **Check cron job status**:
   ```bash
   curl -X POST "https://pitchdonkey.vercel.app/api/cron/process-campaigns" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

2. **Verify campaign status**:
   ```bash
   curl "https://pitchdonkey.vercel.app/api/debug/check-scheduled-campaigns"
   ```

3. **Check email account**:
   - Verify `status = 'active'`
   - Test SMTP connection manually
   - Refresh Gmail OAuth tokens if needed

### SMTP Sending Failures

1. **Test SMTP connection**:
   ```javascript
   const nodemailer = require('nodemailer')
   const transporter = nodemailer.createTransporter({
     host: 'smtp.gmail.com',
     port: 587,
     secure: false,
     auth: {
       user: 'your-email@gmail.com',
       pass: 'your-app-password'
     }
   })

   await transporter.verify()
   ```

2. **Common fixes**:
   - Enable "Less secure app access" (Gmail)
   - Use app passwords instead of account password
   - Verify SMTP host and port settings
   - Check firewall/network restrictions

### Gmail OAuth Issues

1. **Token refresh failures**:
   - Re-authenticate account in dashboard
   - Check Google Cloud Console OAuth configuration
   - Verify callback URLs are correct

2. **API quota exceeded**:
   - Monitor Google Cloud Console quotas
   - Implement exponential backoff
   - Consider upgrading to higher quota limits

## API Reference

### Campaign Management

**Create Campaign**: `POST /api/campaigns`
**List Campaigns**: `GET /api/campaigns`
**Get Campaign**: `GET /api/campaigns/[id]`
**Update Campaign**: `PUT /api/campaigns/[id]`
**Delete Campaign**: `DELETE /api/campaigns/[id]`

### Email Accounts

**List Email Accounts**: `GET /api/email-accounts`
**Add Email Account**: `POST /api/email-accounts`
**Verify Email Account**: `POST /api/email-accounts/[id]/verify`
**Delete Email Account**: `DELETE /api/email-accounts/[id]`

### Campaign Processing

**Manual Process**: `POST /api/campaigns/manual-send`
**Cron Process**: `POST /api/cron/process-campaigns`
**Process Single**: `POST /api/campaigns/[id]/process`

This documentation provides a comprehensive overview of the campaign scheduling workflow for both Gmail and SMTP email accounts. For additional support or questions, refer to the debug endpoints or contact the development team.