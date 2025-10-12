# Email Sync Cron Job Setup

This document explains how to configure the differential email sync system with separate intervals for inbox and sent emails.

## Overview

The email sync system uses two different intervals:
- **Inbox emails**: Every 5 minutes (time-sensitive, important for replies and engagement)
- **Sent emails**: Every 30 minutes (less critical, mainly for record-keeping)

## Cron Job Configuration

### Ubuntu/Linux Cron Setup

Edit your crontab:
```bash
crontab -e
```

Add these two cron jobs:

```bash
# Inbox sync - Every 5 minutes (fetch inbox emails only)
*/5 * * * * curl -X POST "https://your-domain.com/api/cron/fetch-emails" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  >> /var/log/pitchdonkey-inbox-sync.log 2>&1

# Sent emails sync - Every 30 minutes (fetch both inbox AND sent emails)
*/30 * * * * curl -X POST "https://your-domain.com/api/cron/fetch-emails?sync_sent=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  >> /var/log/pitchdonkey-sent-sync.log 2>&1
```

### GitHub Actions Setup

Create `.github/workflows/email-sync.yml`:

```yaml
name: Email Sync

on:
  schedule:
    # Inbox sync - Every 5 minutes
    - cron: '*/5 * * * *'
    # Sent sync - Every 30 minutes
    - cron: '*/30 * * * *'
  workflow_dispatch:

jobs:
  sync-inbox:
    if: github.event.schedule == '*/5 * * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Sync inbox emails
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cron/fetch-emails" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  sync-sent:
    if: github.event.schedule == '*/30 * * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Sync sent emails
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cron/fetch-emails?sync_sent=true" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Docker Cron Setup

Create `crontab` file:
```bash
# Inbox sync - Every 5 minutes
*/5 * * * * curl -X POST "http://localhost:3000/api/cron/fetch-emails" -H "Authorization: Bearer ${CRON_SECRET}"

# Sent emails sync - Every 30 minutes
*/30 * * * * curl -X POST "http://localhost:3000/api/cron/fetch-emails?sync_sent=true" -H "Authorization: Bearer ${CRON_SECRET}"
```

## API Endpoints

### Inbox Only Sync (Every 5 minutes)
```bash
POST /api/cron/fetch-emails
```
- Syncs inbox emails only
- Fast execution (~5-15 seconds per account)
- Time-sensitive for reply detection

### Full Sync with Sent Emails (Every 30 minutes)
```bash
POST /api/cron/fetch-emails?sync_sent=true
```
- Syncs both inbox AND sent emails
- Longer execution time (~10-30 seconds per account)
- Complete email history sync

## Environment Variables

Ensure these are set in your `.env`:
```bash
CRON_SECRET=your-secure-random-secret-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Monitoring

### Check Cron Logs
```bash
# Ubuntu/Linux
tail -f /var/log/pitchdonkey-inbox-sync.log
tail -f /var/log/pitchdonkey-sent-sync.log

# Docker
docker logs -f container-name | grep "Cron: Fetch emails"
```

### Expected Log Output

**Inbox sync (every 5 minutes):**
```
🕐 Cron: Fetch emails triggered (sync_sent=false)
✅ Cron: Fetched 5 new emails from 2/2 accounts
```

**Sent sync (every 30 minutes):**
```
🕐 Cron: Fetch emails triggered (sync_sent=true)
✅ Cron: Fetched 15 new emails from 2/2 accounts
```

## Testing

### Manual Trigger - Inbox Only
```bash
curl -X POST "http://localhost:3000/api/cron/fetch-emails" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Manual Trigger - Full Sync with Sent
```bash
curl -X POST "http://localhost:3000/api/cron/fetch-emails?sync_sent=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Health Check
```bash
curl -X GET "http://localhost:3000/api/cron/fetch-emails" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Performance Considerations

### Inbox Sync (5 minutes)
- **Execution time**: ~5-15 seconds per account
- **Resource usage**: Low (only fetches new inbox emails)
- **Critical for**: Reply detection, engagement tracking

### Sent Sync (30 minutes)
- **Execution time**: ~10-30 seconds per account
- **Resource usage**: Moderate (fetches both inbox and sent)
- **Critical for**: Sent email history, campaign tracking

### Optimization Tips
1. **Stagger cron jobs**: Ensure the 30-minute sync doesn't conflict with 5-minute syncs
2. **Monitor execution time**: If sync takes >2 minutes, consider adjusting intervals
3. **Scale resources**: For >10 email accounts, consider increasing server resources

## Troubleshooting

### Sent Emails Not Syncing
**Problem**: Sent emails aren't appearing in the database

**Solution**: Verify the 30-minute cron job includes `?sync_sent=true` parameter
```bash
# Correct
*/30 * * * * curl -X POST "https://domain.com/api/cron/fetch-emails?sync_sent=true"

# Wrong (won't sync sent)
*/30 * * * * curl -X POST "https://domain.com/api/cron/fetch-emails"
```

### Duplicate Emails
**Problem**: Same emails appearing multiple times

**Solution**: The system automatically deduplicates based on `message_id` and `gmail_message_id`. If duplicates persist, check database constraints.

### High Resource Usage
**Problem**: Server overload during sync

**Solution**:
1. Increase interval to 10 minutes for inbox, 60 minutes for sent
2. Implement batch processing with smaller chunks
3. Add rate limiting per provider

## Migration from Old Setup

If you're migrating from the old 5-minute sync for everything:

1. **Stop old cron job**:
```bash
crontab -e
# Comment out or remove old job
```

2. **Add new dual cron jobs** (see configuration above)

3. **Verify sync_sent parameter** is only on 30-minute job

4. **Monitor logs** for first hour to ensure proper operation

## Architecture Benefits

### Why Differential Sync?

1. **Resource Efficiency**:
   - 5-min inbox sync: ~12 syncs/hour = fast, lightweight
   - 30-min full sync: ~2 syncs/hour = complete but less frequent

2. **Performance**:
   - Inbox emails are time-sensitive (replies, leads)
   - Sent emails are historical (can wait 30 minutes)

3. **Cost Optimization**:
   - Reduces API calls to Gmail/IMAP by ~50%
   - Lower server CPU/memory usage
   - Better for free tier hosting (Vercel, Railway)

4. **User Experience**:
   - Inbox replies detected within 5 minutes
   - Sent email history updated every 30 minutes
   - No noticeable delay for users
