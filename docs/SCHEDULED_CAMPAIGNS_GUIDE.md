# Scheduled Campaigns Guide

Complete documentation for understanding and troubleshooting scheduled campaigns in PitchDonkey.

## Overview

Scheduled campaigns allow users to create email campaigns that automatically send at a future date/time without manual intervention. The system uses a combination of database status tracking and cron jobs to process campaigns when they're ready to send.

## Architecture Components

### 1. Database Schema

**Campaigns Table Key Fields:**
```sql
-- Campaign status and timing
status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused'
scheduled_date: timestamp      -- When campaign should start sending
start_date: timestamp         -- When campaign actually started
end_date: timestamp          -- When campaign completed

-- Contact and sending limits
contact_list_ids: string[]   -- Arrays of contact list IDs
total_contacts: number       -- Total number of contacts to email
daily_send_limit: number     -- Max emails per day (default: 50)

-- Email tracking
emails_sent: number          -- Actual emails sent successfully
emails_bounced: number       -- Failed/bounced emails
```

**Email Tracking Table:**
```sql
-- Individual email tracking
campaign_id: string          -- Links to campaigns table
contact_id: string          -- Links to contacts table
status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
sent_at: timestamp          -- When email was sent
delivered_at: timestamp     -- When email was delivered
```

### 2. Campaign Lifecycle States

```
draft → scheduled → sending → completed
  ↓         ↓         ↓          ↑
  └─────→ paused ←───┴──────────┘
```

**State Definitions:**
- **draft**: Campaign being created, not ready to send
- **scheduled**: Campaign ready to send at future date
- **sending**: Campaign currently processing contacts
- **completed**: All contacts processed successfully
- **paused**: Campaign manually stopped or encountered errors

### 3. System Components

#### Cron Job System (`/api/cron/process-campaigns`)
- **Schedule**: Every day at 9:00 AM UTC (configurable in `vercel.json`)
- **Purpose**: Find and trigger scheduled campaigns that are ready
- **Security**: Uses `CRON_SECRET` environment variable for authentication

#### Campaign Processor (`lib/campaign-processor.ts`)
- **Purpose**: Handles actual email sending and campaign execution
- **Triggers**: Called by cron job when campaigns are ready
- **Features**: Rate limiting, contact deduplication, email tracking

#### Campaign Execution Engine (`lib/campaign-execution.ts`)
- **Purpose**: Handles sequence campaigns (multi-step email flows)
- **Integration**: Works with campaign processor for complex campaigns

## How Scheduled Campaigns Work

### Step 1: Campaign Creation
```typescript
// User creates campaign through UI
const campaign = {
  name: "Product Launch Campaign",
  status: "draft",
  contact_list_ids: ["list-1", "list-2"],
  scheduled_date: "2024-01-15T09:00:00Z",
  daily_send_limit: 50,
  // ... other settings
}
```

### Step 2: Campaign Scheduling
```typescript
// User schedules campaign (UI action)
await supabase
  .from('campaigns')
  .update({
    status: 'scheduled',
    scheduled_date: scheduledDateTime
  })
  .eq('id', campaignId)
```

### Step 3: Cron Job Detection
**Daily at 9:00 AM UTC, cron job runs:**

```typescript
// Query for ready campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .in('status', ['scheduled', 'sending'])
  .or(`scheduled_date.lte.${now.toISOString()},status.eq.sending`)
  .order('created_at', { ascending: true })
```

**Logic:**
- Finds campaigns with `status = 'scheduled'` AND `scheduled_date <= now`
- Also finds `status = 'sending'` campaigns (stuck campaigns)
- Processes oldest campaigns first

### Step 4: Status Transition
```typescript
// Cron job updates status
if (campaign.status === 'scheduled') {
  await supabase
    .from('campaigns')
    .update({
      status: 'sending',
      send_immediately: true,
      updated_at: now.toISOString()
    })
    .eq('id', campaign.id)
}
```

### Step 5: Campaign Processing
**Campaign Processor handles actual sending:**

1. **Contact Collection:**
   ```typescript
   // Get all contacts from contact lists
   const { data: contactLists } = await supabase
     .from('contact_lists')
     .select('contact_ids')
     .in('id', campaign.contact_list_ids)

   // Deduplicate contacts
   const allContactIds = new Set()
   contactLists.forEach(list => {
     list.contact_ids.forEach(id => allContactIds.add(id))
   })
   ```

2. **Filter Already Sent:**
   ```typescript
   // Skip contacts already sent to
   const { data: sentEmails } = await supabase
     .from('email_tracking')
     .select('contact_id')
     .eq('campaign_id', campaign.id)
     .in('status', ['sent', 'delivered'])

   const sentContactIds = new Set(sentEmails.map(e => e.contact_id))
   const remainingContacts = allContacts.filter(id => !sentContactIds.has(id))
   ```

3. **Rate Limited Sending:**
   ```typescript
   // Respect daily limit
   const dailyLimit = campaign.daily_send_limit || 50

   for (let i = 0; i < contacts.length && emailsSent < dailyLimit; i++) {
     // Send email with tracking
     const result = await sendEmail(contact, campaign)

     // Create tracking record
     await supabase.from('email_tracking').insert({
       campaign_id: campaign.id,
       contact_id: contact.id,
       status: result.status,
       sent_at: new Date().toISOString()
     })
   }
   ```

4. **Campaign Completion:**
   ```typescript
   // Check if campaign is complete
   const processedCount = emailsSent + emailsFailed
   const newStatus = processedCount >= totalContacts ? 'completed' : 'sending'

   await supabase
     .from('campaigns')
     .update({
       status: newStatus,
       emails_sent: emailsSent,
       emails_bounced: emailsFailed,
       end_date: newStatus === 'completed' ? new Date().toISOString() : null
     })
     .eq('id', campaign.id)
   ```

### Step 6: Email Sending
**Both SMTP and Gmail OAuth supported:**

```typescript
// SMTP Example
const transporter = nodemailer.createTransporter({
  host: emailAccount.smtp_host,
  auth: { user: emailAccount.smtp_username, pass: emailAccount.smtp_password }
})

// Gmail OAuth Example
const gmailService = new GmailIMAPSMTPServerService()
const result = await gmailService.sendGmailEmail(emailAccountId, emailData)
```

**Features:**
- Click tracking (link rewriting)
- Open tracking (pixel insertion)
- Personalization (variable replacement)
- Rate limiting (delays between sends)

## Configuration

### Environment Variables
```bash
# Required for cron jobs
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_random_secret_16_chars_minimum

# Optional for email delays
CAMPAIGN_SEND_DELAY_MIN_MS=15000    # Min delay between emails (15s)
CAMPAIGN_SEND_DELAY_MAX_MS=45000    # Max delay between emails (45s)
```

### Cron Schedule (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/process-campaigns",
      "schedule": "0 9 * * *"  // Daily at 9:00 AM UTC
    }
  ]
}
```

**Frequency Options:**
- **Hobby Plan**: `"0 9 * * *"` (once daily)
- **Pro Plan**: `"*/5 * * * *"` (every 5 minutes)

## Monitoring & Debugging

### 1. Check Campaign Status
```typescript
// Query campaigns by status
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, scheduled_date, start_date, end_date')
  .eq('status', 'scheduled')

console.log('Scheduled campaigns:', campaigns)
```

### 2. Debug Cron Job
```bash
# Manual test
curl -X GET "https://your-app.vercel.app/api/cron/process-campaigns" \
  -H "Authorization: Bearer your_cron_secret"

# Debug endpoint
curl -X GET "https://your-app.vercel.app/api/debug/check-scheduled-campaigns"
```

### 3. Check Email Tracking
```typescript
// See email sending progress
const { data: emailStats } = await supabase
  .from('email_tracking')
  .select('status, sent_at, delivered_at')
  .eq('campaign_id', campaignId)

const sentCount = emailStats.filter(e => e.status === 'sent').length
const deliveredCount = emailStats.filter(e => e.status === 'delivered').length
```

### 4. Common Issues & Solutions

#### Issue: Campaigns Stuck in "Scheduled"
**Symptoms:** Campaign never changes from "scheduled" to "sending"

**Debug Steps:**
1. Check scheduled_date: `SELECT scheduled_date FROM campaigns WHERE id = 'xxx'`
2. Test cron job: `curl /api/cron/process-campaigns`
3. Check server logs for database errors

**Common Causes:**
- `scheduled_date` is in the future
- Database schema mismatch (missing columns)
- Cron job authentication failure
- Network issues between cron and database

#### Issue: Campaigns Stuck in "Sending"
**Symptoms:** Campaign processes some contacts but never completes

**Debug Steps:**
1. Check email tracking: Count sent vs total contacts
2. Check for processor errors in logs
3. Verify email account is active and configured

**Common Causes:**
- Email account credentials expired
- Daily send limit reached
- SMTP server issues
- Contact data problems (invalid emails)

#### Issue: Emails Not Actually Sending
**Symptoms:** Campaign shows as "sending" but no emails received

**Debug Steps:**
1. Check email_tracking table for actual send records
2. Test email account configuration manually
3. Check SMTP/OAuth credentials
4. Verify domain authentication (SPF/DKIM)

**Common Causes:**
- Invalid email account credentials
- SMTP server blocking
- OAuth tokens expired
- Email content triggering spam filters

## Performance Considerations

### 1. Rate Limiting
- **Default**: 50 emails/day per campaign
- **Delays**: 15-45 seconds between emails
- **Batch Size**: Process in chunks to avoid timeouts

### 2. Database Optimization
- **Indexes**: Ensure indexes on `status`, `scheduled_date`, `campaign_id`
- **Cleanup**: Archive old campaigns and email_tracking records
- **Connection Pooling**: Use service role for cron jobs

### 3. Scalability
- **Horizontal**: Multiple cron instances (Pro plan)
- **Vertical**: Increase daily limits and batch sizes
- **Queue System**: Consider background job queues for large campaigns

## Best Practices

### 1. Campaign Creation
- Set realistic `daily_send_limit` based on email account capabilities
- Test with small contact lists first
- Verify contact data quality before scheduling
- Use clear, descriptive campaign names

### 2. Scheduling
- Schedule campaigns during business hours for better engagement
- Allow buffer time between creation and scheduled send
- Consider timezone differences for global campaigns
- Avoid scheduling multiple large campaigns simultaneously

### 3. Monitoring
- Set up alerts for stuck campaigns
- Monitor email delivery rates and bounces
- Track campaign performance metrics
- Regular cleanup of completed campaigns

### 4. Error Handling
- Implement retry logic for transient failures
- Graceful degradation when email services are down
- Comprehensive logging for debugging
- User notifications for campaign failures

## API Reference

### Create Scheduled Campaign
```typescript
POST /api/campaigns
{
  "name": "Product Launch",
  "status": "scheduled",
  "scheduled_date": "2024-01-15T09:00:00Z",
  "contact_list_ids": ["list-1", "list-2"],
  "daily_send_limit": 50,
  "email_subject": "Exciting Product Launch!",
  "html_content": "<html>...</html>"
}
```

### Update Campaign Schedule
```typescript
PUT /api/campaigns/{id}
{
  "scheduled_date": "2024-01-16T10:00:00Z",
  "status": "scheduled"
}
```

### Pause Campaign
```typescript
PUT /api/campaigns/{id}
{
  "status": "paused"
}
```

### Resume Campaign
```typescript
PUT /api/campaigns/{id}
{
  "status": "sending"  // Will be picked up by next cron run
}
```

## Troubleshooting Checklist

When scheduled campaigns aren't working:

- [ ] **Verify cron job is running:** Check Vercel dashboard or server logs
- [ ] **Check campaign status:** Should be "scheduled" with future `scheduled_date`
- [ ] **Test cron endpoint manually:** `curl /api/cron/process-campaigns`
- [ ] **Verify database schema:** Ensure all required columns exist
- [ ] **Check email account status:** Must be "active" and properly configured
- [ ] **Review contact lists:** Ensure they contain valid contacts
- [ ] **Check environment variables:** All required secrets present
- [ ] **Monitor server logs:** Look for database or email sending errors
- [ ] **Test email sending:** Verify SMTP/OAuth credentials work
- [ ] **Check rate limits:** Ensure daily limits aren't already reached

## Support & Maintenance

### Log Monitoring
Monitor these log patterns for issues:
- `❌ Error fetching campaigns:` - Database query issues
- `📊 Found 0 campaigns ready to process` - No scheduled campaigns (normal)
- `✅ Email sent successfully` - Successful email delivery
- `❌ Failed to send email` - Email sending problems

### Regular Maintenance
- **Weekly**: Review stuck campaigns and error logs
- **Monthly**: Clean up old email_tracking records
- **Quarterly**: Review and optimize cron job frequency
- **Annually**: Rotate CRON_SECRET and other credentials

This documentation should serve as a complete reference for understanding, implementing, and troubleshooting scheduled campaigns in your system.