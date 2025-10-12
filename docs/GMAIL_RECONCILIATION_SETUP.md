# Gmail Reconciliation Setup Guide

## Overview

Gmail reconciliation detects emails that have been deleted in Gmail and mirrors those deletions in your database by setting the `archived_at` timestamp. This keeps your mailbox perfectly synchronized with Gmail's actual state.

## How It Works

1. **Lightweight Sync**: Fetches only message IDs from Gmail (not full content)
2. **Comparison**: Compares Gmail message IDs with database message IDs
3. **Archive Deleted**: Marks emails in DB but not in Gmail as `archived`
4. **Track Timestamp**: Updates `last_full_reconciliation_at` in `imap_connections`

## When Reconciliation Runs

### Automatic (After Each Sync)
Every time you manually sync emails via `/api/inbox/sync`, reconciliation runs automatically.

### Daily Cron Job (Recommended)
Set up a daily cron job to catch any deletions that happened between syncs.

## Ubuntu Cron Setup

### 1. Get Your CRON_SECRET

```bash
# In your .env file
CRON_SECRET=your_secure_random_string_here
```

### 2. Create Cron Job Script

Create `/home/your-user/cron-scripts/reconcile-emails.sh`:

```bash
#!/bin/bash

# Load environment variables
source /home/your-user/pitchdonkey/.env

# Call reconciliation endpoint
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/cron/reconcile-emails \
  >> /var/log/pitchdonkey/reconcile-emails.log 2>&1

echo "Reconciliation completed at $(date)" >> /var/log/pitchdonkey/reconcile-emails.log
```

Make it executable:

```bash
chmod +x /home/your-user/cron-scripts/reconcile-emails.sh
```

### 3. Create Log Directory

```bash
sudo mkdir -p /var/log/pitchdonkey
sudo chown your-user:your-user /var/log/pitchdonkey
```

### 4. Add Cron Job

Edit crontab:

```bash
crontab -e
```

Add this line to run daily at 2 AM:

```cron
0 2 * * * /home/your-user/cron-scripts/reconcile-emails.sh
```

### 5. Verify Cron Job

List current cron jobs:

```bash
crontab -l
```

### 6. Monitor Logs

```bash
# Watch reconciliation logs in real-time
tail -f /var/log/pitchdonkey/reconcile-emails.log

# View last 50 lines
tail -n 50 /var/log/pitchdonkey/reconcile-emails.log
```

## API Endpoints

### Reconciliation Endpoint
```
POST /api/cron/reconcile-emails
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAccounts": 3,
    "successfulAccounts": 3,
    "failedAccounts": 0,
    "totalArchivedInbox": 15,
    "totalArchivedSent": 5,
    "results": [...]
  },
  "message": "Reconciled 3/3 accounts. Archived 15 inbox, deleted 5 sent.",
  "timestamp": "2025-10-12T10:00:00.000Z"
}
```

### Health Check Endpoint
```
GET /api/cron/reconcile-emails
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "status": "healthy",
  "endpoint": "/api/cron/reconcile-emails",
  "stats": {
    "accounts_with_reconciliation": 3,
    "last_reconciliation_times": ["2025-10-12T02:00:00Z", ...],
    "archived_last_24h": 15
  },
  "timestamp": "2025-10-12T10:00:00.000Z",
  "cron_secret_configured": true
}
```

## Manual Testing

### Test Reconciliation Endpoint

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/cron/reconcile-emails
```

### Test Manual Sync with Reconciliation

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  https://your-domain.com/api/inbox/sync \
  -d '{"emailAccountId": "your-account-id"}'
```

## Expected Behavior

### Before Reconciliation
- Gmail Inbox: 17 emails
- Database: 48 emails (31 deleted emails still present)
- Mailbox UI: Shows 48 emails

### After Reconciliation
- Gmail Inbox: 17 emails
- Database: 17 active + 31 archived = 48 total
- Mailbox UI: Shows 17 emails (filters `archived_at IS NULL`)

## Database Schema

The `incoming_emails` table has an `archived_at` field:

```sql
archived_at TIMESTAMP WITH TIME ZONE, -- When email was deleted/archived
```

The `imap_connections` table tracks reconciliation:

```sql
last_full_reconciliation_at TIMESTAMP WITH TIME ZONE, -- Last reconciliation timestamp
```

## Troubleshooting

### Reconciliation Not Running

1. **Check Cron Job**: `crontab -l`
2. **Check Script Permissions**: `ls -l /home/your-user/cron-scripts/reconcile-emails.sh`
3. **Check Logs**: `tail -f /var/log/pitchdonkey/reconcile-emails.log`
4. **Test Manually**: Run script directly to see errors

### No Emails Being Archived

1. **Check Gmail Message IDs**: Verify emails have `gmail_message_id` set
2. **Check Account Provider**: Only works for `provider = 'gmail'` with OAuth
3. **Check Logs**: Look for reconciliation output in sync logs
4. **Test Endpoint**: Call `/api/cron/reconcile-emails` directly

### Too Many Emails Archived

1. **Check Gmail Access**: Ensure OAuth tokens are valid
2. **Check Query**: Reconciliation uses `-in:spam -in:trash` query
3. **Verify Labels**: Check if emails have correct Gmail labels

## Performance

- **Lightweight**: Only fetches message IDs (not full email content)
- **Fast**: Processes 1000+ emails in ~2-5 seconds
- **Efficient**: Uses Set comparisons for O(n) performance
- **Parallel**: Processes inbox and sent folders simultaneously

## Security

- **Authentication**: Requires `CRON_SECRET` in Authorization header
- **Service Role**: Uses Supabase service role for database access
- **Rate Limiting**: No user-level rate limits (runs as system cron)
- **Audit Trail**: Logs all reconciliation actions with timestamps

## Maintenance

### Weekly Checks
- Review reconciliation logs for errors
- Verify archived email counts match expectations
- Check reconciliation timestamps are updating

### Monthly Tasks
- Analyze reconciliation patterns and adjust schedule if needed
- Review archived emails for unexpected patterns
- Optimize cron timing based on user activity

### Quarterly Tasks
- Review and rotate CRON_SECRET if needed
- Audit archived emails for cleanup opportunities
- Performance testing with larger datasets

## Support

For issues or questions:
1. Check logs: `/var/log/pitchdonkey/reconcile-emails.log`
2. Review this documentation
3. Test endpoints manually
4. Contact support with log excerpts
