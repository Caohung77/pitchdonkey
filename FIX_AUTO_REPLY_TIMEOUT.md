# Fix for Auto-Reply System Timeout Issue

## Problem Identified
The `/api/cron/fetch-emails` endpoint was timing out after 25 seconds, preventing:
- Email sync from Gmail/IMAP
- Email classification
- Automatic reply generation
- Scheduled reply creation

**Root Cause**: Vercel Hobby plan default timeout is 10 seconds, but IMAP email sync takes longer.

## Changes Made

### 1. Added Vercel Function Timeout Configuration
**File**: `src/app/api/cron/fetch-emails/route.ts`

Added at the top of the file:
```typescript
// Configure function to run up to 60 seconds (Vercel limit)
export const maxDuration = 60 // seconds
export const dynamic = 'force-dynamic'
```

This allows the serverless function to run for up to 60 seconds instead of the default 10 seconds.

### 2. Updated Docker Cron Timeout
**File**: `docker-ubuntu-cron/docker-compose.yml`

Changed the curl timeout from `-m 25` to `-m 70`:
```yaml
# Before
curl -sS -m 25 -X POST ...

# After
curl -sS -m 70 -X POST ...
```

This gives the function 60 seconds to complete + 10 seconds buffer.

## Deployment Steps

### Step 1: Deploy to Vercel
```bash
cd /Users/caohungnguyen/Projects/Kiro/pitchdonkey

# Commit changes
git add src/app/api/cron/fetch-emails/route.ts
git commit -m "fix: increase fetch-emails timeout to 60s for IMAP sync"

# Push to trigger Vercel deployment
git push origin main
```

**Wait for Vercel deployment to complete** (check https://vercel.com/dashboard)

### Step 2: Update Docker Container on Ubuntu Server

SSH to your Ubuntu server:
```bash
ssh user@87.106.70.121
cd ~/docker-ubuntu-cron  # or wherever your docker-compose.yml is located
```

If you have the updated `docker-compose.yml` on the server, restart:
```bash
# Pull latest changes if using git
git pull

# Or manually update docker-compose.yml with the new timeout (-m 70)

# Restart the container
docker-compose down
docker-compose up -d

# Verify it's running
docker ps | grep pitchdonkey
docker logs pitchdonkey-cron --tail 20
```

**Alternative**: If `docker-compose.yml` is not in git, manually copy it:
```bash
# From your local machine
scp /Users/caohungnguyen/Projects/Kiro/pitchdonkey/docker-ubuntu-cron/docker-compose.yml user@87.106.70.121:~/docker-ubuntu-cron/

# Then SSH and restart
ssh user@87.106.70.121
cd ~/docker-ubuntu-cron
docker-compose down && docker-compose up -d
```

## Verification

### 1. Check Docker Logs (on Ubuntu server)
```bash
docker logs -f pitchdonkey-cron
```

**Expected**: Within 5 minutes, you should see:
```
[fetch-emails] Running at 2025-10-10T...
{"success":true,"data":{"totalNewEmails":X,...}}
```

**NO MORE** timeout errors like:
```
curl: (28) Operation timed out after 25000 milliseconds
```

### 2. Check Vercel Logs
Go to Vercel Dashboard → Your Project → Functions → `/api/cron/fetch-emails`

**Expected**: Function completes successfully within 60 seconds

### 3. Check Database
Run in Supabase SQL Editor:
```sql
-- Should show recent sync (within last 5 minutes)
SELECT
  email_account_id,
  last_sync_at,
  status,
  last_error
FROM imap_connections
ORDER BY last_sync_at DESC;

-- Should show new emails synced
SELECT
  id,
  from_address,
  subject,
  date_received,
  classification_status,
  processing_status
FROM incoming_emails
WHERE date_received >= NOW() - INTERVAL '1 hour'
ORDER BY date_received DESC
LIMIT 10;

-- Should show reply jobs created (if agent assigned)
SELECT
  rj.id,
  rj.draft_subject,
  rj.status,
  rj.scheduled_at,
  rj.created_at
FROM reply_jobs rj
WHERE rj.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY rj.created_at DESC;
```

### 4. Test Manual Trigger
```bash
# From any machine
curl -X POST "https://pitchdonkey.vercel.app/api/cron/fetch-emails" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v
```

**Expected**: Should return success within 60 seconds

## Still Need to Configure

Once the timeout is fixed and emails are syncing, you still need to:

### 1. Assign Outreach Agent to Email Account
Go to: Dashboard → Email Accounts → `hung@theaiwhisperer.de` → Click "Assign Agent"

Or run this SQL:
```sql
UPDATE email_accounts
SET assigned_agent_id = (
  SELECT id FROM outreach_agents
  WHERE status = 'active'
  LIMIT 1
)
WHERE email = 'hung@theaiwhisperer.de';
```

### 2. Ensure Agent is Active
Go to: Dashboard → AI Outreach Agents → Edit Agent → Set Status = "active"

Or run this SQL:
```sql
UPDATE outreach_agents
SET status = 'active'
WHERE id = 'YOUR_AGENT_ID';
```

## Timeline After Fix

Once deployed:
- **T+0**: Deploy to Vercel + restart Docker
- **T+5min**: First successful email sync
- **T+5min**: Emails classified, reply jobs created
- **T+10-20min**: First automatic replies sent

## Troubleshooting

### If Still Timing Out
1. Check Vercel deployment completed: `maxDuration` should appear in function config
2. Check Docker container restarted with new config
3. Check Vercel logs for actual execution time

### If Emails Sync But No Replies
1. Verify agent assignment (see diagnostic queries above)
2. Check agent is active
3. Check email classification (should be "human_reply" not "bounce" or "auto_reply")

## Summary

✅ **Root Cause**: Vercel 10s timeout + IMAP sync taking 25+ seconds
✅ **Fix**: Increased to 60s maxDuration + 70s curl timeout
✅ **Next Steps**: Deploy → Restart Docker → Verify → Assign Agent

This should completely resolve the timeout issue and enable automatic email replies!
