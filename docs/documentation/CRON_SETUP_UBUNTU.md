# Ubuntu Cron Setup for Autonomous Reply System

This guide explains how to configure Ubuntu cron to run both email fetching and reply sending jobs every 5 minutes.

## Overview

The autonomous reply system requires **two cron jobs**:

1. **Fetch Emails** (`/api/cron/fetch-emails`) - Fetches emails from Gmail/SMTP accounts
2. **Send Replies** (`/api/cron/process-reply-jobs`) - Sends scheduled autonomous replies

## Prerequisites

- Ubuntu server with cron installed (`sudo apt-get install cron`)
- Application deployed to a publicly accessible URL
- `CRON_SECRET` environment variable configured

## Step 1: Set CRON_SECRET

Generate a strong random secret:

```bash
# Generate a secure random secret
openssl rand -hex 32

# Add to your .env file
echo "CRON_SECRET=your_generated_secret_here" >> .env
```

**Important**: Use the same `CRON_SECRET` value in your deployed application's environment variables.

## Step 2: Configure Crontab

Edit your crontab:

```bash
crontab -e
```

Add these two cron jobs:

```bash
# Fetch emails every 5 minutes (triggers autonomous reply drafts)
*/5 * * * * curl -X POST https://your-domain.com/api/cron/fetch-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE" \
  >> /var/log/fetch-emails-cron.log 2>&1

# Send scheduled replies every 5 minutes
*/5 * * * * curl -X POST https://your-domain.com/api/cron/process-reply-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE" \
  >> /var/log/process-replies-cron.log 2>&1
```

**Replace**:
- `https://your-domain.com` with your actual domain
- `YOUR_CRON_SECRET_HERE` with your actual CRON_SECRET value

## Step 3: Create Log Directory

Create log files with proper permissions:

```bash
# Create log directory
sudo mkdir -p /var/log

# Create log files
sudo touch /var/log/fetch-emails-cron.log
sudo touch /var/log/process-replies-cron.log

# Set permissions (replace 'ubuntu' with your username)
sudo chown ubuntu:ubuntu /var/log/fetch-emails-cron.log
sudo chown ubuntu:ubuntu /var/log/process-replies-cron.log
```

## Step 4: Verify Cron is Running

```bash
# Check if cron service is running
sudo systemctl status cron

# Start cron if not running
sudo systemctl start cron

# Enable cron to start on boot
sudo systemctl enable cron
```

## Step 5: Test Manually

Test each endpoint manually before relying on cron:

```bash
# Test email fetching
curl -X POST https://your-domain.com/api/cron/fetch-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v

# Test reply sending
curl -X POST https://your-domain.com/api/cron/process-reply-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v

# Health checks
curl -X GET https://your-domain.com/api/cron/fetch-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X GET https://your-domain.com/api/cron/process-reply-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Step 6: Monitor Logs

Check cron logs to ensure jobs are running:

```bash
# View fetch emails log (live)
tail -f /var/log/fetch-emails-cron.log

# View process replies log (live)
tail -f /var/log/process-replies-cron.log

# View system cron log
sudo tail -f /var/log/syslog | grep CRON
```

## Complete Autonomous Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS REPLY FLOW                     │
└─────────────────────────────────────────────────────────────┘

Every 5 minutes:

1. FETCH EMAILS CRON (/api/cron/fetch-emails)
   │
   ├── Fetch from Gmail OAuth accounts
   │   └── GmailIMAPSMTPService.fetchEmails()
   │
   ├── Fetch from SMTP/IMAP accounts
   │   └── IMAPProcessor.syncEmails()
   │
   ├── Save to incoming_emails table
   │
   └── Trigger reply-processor.ts
       └── processIncomingEmail()
           ├── Classify email (human reply? spam? etc.)
           ├── Check if email account has assigned agent
           ├── Draft autonomous reply (if applicable)
           │   ├── Generate AI reply with guardrails
           │   ├── Calculate risk score (0.0-1.0)
           │   ├── Determine approval status
           │   └── Schedule send time (5-15 min + risk delay)
           └── Save to reply_jobs table

2. SEND REPLIES CRON (/api/cron/process-reply-jobs)
   │
   ├── Query reply_jobs WHERE scheduled_at <= NOW()
   │
   ├── For each job:
   │   ├── Check if still editable
   │   ├── Update status to 'sending'
   │   ├── Send via Gmail/SMTP
   │   ├── Update status to 'sent'
   │   ├── Create email_sends tracking record
   │   └── Pause active campaigns for contact
   │
   └── Retry failed jobs with exponential backoff
       └── 5min → 15min → 45min → mark failed
```

## Cron Schedule Options

### Every 5 Minutes (Recommended)
```bash
*/5 * * * * command
```

### Every 10 Minutes (Lower API usage)
```bash
*/10 * * * * command
```

### Every Hour (Development/Testing)
```bash
0 * * * * command
```

### Business Hours Only (9 AM - 6 PM, Mon-Fri)
```bash
*/5 9-18 * * 1-5 command
```

## Troubleshooting

### Cron Job Not Running

```bash
# Check cron service
sudo systemctl status cron

# Check cron logs
sudo tail -f /var/log/syslog | grep CRON

# Verify crontab syntax
crontab -l
```

### Authentication Errors (401)

- Verify `CRON_SECRET` matches in both crontab and application .env
- Check Authorization header format: `Bearer YOUR_SECRET`
- Ensure no extra spaces or newlines in secret

### No Emails Being Fetched

```bash
# Check health endpoint
curl -X GET https://your-domain.com/api/cron/fetch-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Expected response:
# {
#   "status": "healthy",
#   "stats": {
#     "active_accounts": 2,
#     "accounts_by_provider": {
#       "gmail": 1,
#       "smtp": 1
#     },
#     "last_24h_emails": 15
#   }
# }
```

### No Replies Being Sent

```bash
# Check if there are scheduled jobs
# Query database:
SELECT id, status, scheduled_at, draft_subject
FROM reply_jobs
WHERE status IN ('scheduled', 'approved')
ORDER BY scheduled_at ASC
LIMIT 10;

# Manually trigger processing
curl -X POST https://your-domain.com/api/cron/process-reply-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Security Best Practices

1. **Strong Secret**: Use a cryptographically secure random string (≥32 characters)
2. **HTTPS Only**: Never send CRON_SECRET over unencrypted HTTP
3. **Log Rotation**: Set up logrotate to prevent log files from growing too large
4. **Restricted Access**: Limit cron log file permissions to your user only
5. **Monitor Failures**: Set up alerting for repeated cron failures

## Log Rotation Setup

Create `/etc/logrotate.d/cron-jobs`:

```bash
/var/log/fetch-emails-cron.log /var/log/process-replies-cron.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 ubuntu ubuntu
}
```

Apply log rotation:
```bash
sudo logrotate -f /etc/logrotate.d/cron-jobs
```

## Monitoring & Alerting

### Email Alerts for Failures

Add to crontab for email notifications on errors:

```bash
MAILTO=your-email@example.com

*/5 * * * * curl -X POST https://your-domain.com/api/cron/fetch-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  >> /var/log/fetch-emails-cron.log 2>&1 || echo "Fetch emails cron failed"
```

### Health Check Script

Create `check-cron-health.sh`:

```bash
#!/bin/bash

SECRET="YOUR_CRON_SECRET"
DOMAIN="https://your-domain.com"

# Check fetch emails
FETCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$DOMAIN/api/cron/fetch-emails" \
  -H "Authorization: Bearer $SECRET")

# Check process replies
SEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$DOMAIN/api/cron/process-reply-jobs" \
  -H "Authorization: Bearer $SECRET")

if [ "$FETCH_STATUS" != "200" ] || [ "$SEND_STATUS" != "200" ]; then
  echo "CRITICAL: Cron endpoints unhealthy"
  # Send alert (email, Slack, etc.)
  exit 1
fi

echo "OK: All cron endpoints healthy"
exit 0
```

Run health check every hour:
```bash
0 * * * * /path/to/check-cron-health.sh
```

## Production Deployment Checklist

- [ ] `CRON_SECRET` set in production environment
- [ ] Crontab configured with correct domain and secret
- [ ] Cron service enabled and running
- [ ] Log files created with proper permissions
- [ ] Log rotation configured
- [ ] Manual test of both endpoints successful
- [ ] First cron execution verified in logs
- [ ] Health check monitoring set up
- [ ] Alert system configured for failures
- [ ] Email accounts connected and verified
- [ ] At least one agent assigned to an email account

## Advanced: Multiple Environments

For staging and production:

```bash
# Staging (every 10 minutes)
*/10 * * * * curl -X POST https://staging.your-domain.com/api/cron/fetch-emails \
  -H "Authorization: Bearer STAGING_CRON_SECRET" \
  >> /var/log/staging-fetch-emails.log 2>&1

# Production (every 5 minutes)
*/5 * * * * curl -X POST https://your-domain.com/api/cron/fetch-emails \
  -H "Authorization: Bearer PRODUCTION_CRON_SECRET" \
  >> /var/log/production-fetch-emails.log 2>&1
```

## Support

If you encounter issues:
1. Check logs: `/var/log/*-cron.log`
2. Verify cron service: `sudo systemctl status cron`
3. Test endpoints manually with curl
4. Check database for incoming_emails and reply_jobs records
5. Review application logs for detailed error messages
