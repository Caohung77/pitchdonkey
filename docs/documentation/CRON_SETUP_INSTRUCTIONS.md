# Cron Job Setup Instructions for Enrichment Recovery

## Overview
The enrichment system needs a cron job to recover stuck jobs every 5 minutes. This ensures jobs that fail to chain to the next batch get automatically resumed.

**Note**: You're on Vercel Hobby tier which doesn't include Vercel Cron. This guide covers Ubuntu Docker cron job setup.

---

## **Ubuntu Docker Cron Job Setup**

### Step 1: Edit Crontab
```bash
crontab -e
```

### Step 2: Add Cron Entry
```bash
# Enrichment job recovery - every 5 minutes
*/5 * * * * curl -X GET https://pitchdonkey.vercel.app/api/cron/process-enrichment-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE" \
  >> /var/log/enrichment-cron.log 2>&1
```

**Replace `YOUR_CRON_SECRET_HERE`** with the value from your Vercel environment variables.

### Step 3: Create Log Directory
```bash
sudo touch /var/log/enrichment-cron.log
sudo chmod 664 /var/log/enrichment-cron.log
```

### Step 4: Verify Cron is Running
```bash
# List active cron jobs
crontab -l

# Monitor logs in real-time
tail -f /var/log/enrichment-cron.log

# Check if cron daemon is running
systemctl status cron
```

### Step 5: Test Manual Execution
```bash
curl -X GET https://pitchdonkey.vercel.app/api/cron/process-enrichment-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

Expected response:
```json
{
  "success": true,
  "message": "No stuck jobs to process",
  "processed": 0
}
```

---

## **Alternative: GitHub Actions (Optional Backup)**

If your Ubuntu server goes down, you can use GitHub Actions as a backup:

### Create Workflow File
Create `.github/workflows/enrichment-cron.yml`:

```yaml
name: Enrichment Job Recovery (Backup)

on:
  schedule:
    # Run every 5 minutes
    - cron: '*/5 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  recover-jobs:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Enrichment Recovery
        run: |
          curl -X GET https://pitchdonkey.vercel.app/api/cron/process-enrichment-jobs \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Add Secret to GitHub
GitHub Repository → Settings → Secrets and variables → Actions:
- **Name**: `CRON_SECRET`
- **Value**: Same as your Vercel CRON_SECRET

**Note**: Disable this workflow when Ubuntu cron is working to avoid duplicate processing.

---

## Troubleshooting

### Cron Not Executing
```bash
# Check cron service status
systemctl status cron

# Restart cron service
sudo systemctl restart cron

# Check system logs
journalctl -u cron -f
```

### Unauthorized Errors
- Verify `CRON_SECRET` matches in both Vercel and cron command
- Check Authorization header format: `Bearer YOUR_SECRET` (not just `YOUR_SECRET`)

### No Jobs Found
This is normal if no jobs are stuck. The cron will log:
```
✅ No stuck enrichment jobs found
```

### Jobs Still Stuck After Cron
1. Check job status in Supabase: `SELECT * FROM bulk_enrichment_jobs WHERE status = 'running'`
2. Manually trigger recovery: `curl ... /api/cron/process-enrichment-jobs`
3. Check processor endpoint logs in Vercel Dashboard
4. Verify client-side stale job detection is active (check browser console)

---

## Verification Checklist

- [ ] Cron job configured (Vercel/Ubuntu/GitHub)
- [ ] `CRON_SECRET` environment variable set
- [ ] Test manual execution successful
- [ ] Cron logs showing successful runs every 5 minutes
- [ ] Stuck jobs successfully recovered

---

## Monitoring

### Check Cron Execution Logs
**Vercel Dashboard** → Project → Functions → filter "cron"

**Ubuntu Server**:
```bash
tail -f /var/log/enrichment-cron.log
```

**GitHub Actions**:
Repository → Actions → "Enrichment Job Recovery" workflow

### Success Indicators
```
✅ Cron job completed: 1/1 jobs processed successfully
✅ Successfully resumed job abc-123-def
✅ No stuck enrichment jobs found
```

### Failure Indicators
```
❌ Failed to resume job abc-123-def: HTTP 500
🚨 Job abc-123-def has been stuck for >30 minutes, marking as failed
```

---

## Recommended Setup
**Use Ubuntu Docker Cron** as your primary solution. Configure GitHub Actions as a backup in case your Ubuntu server experiences downtime.
