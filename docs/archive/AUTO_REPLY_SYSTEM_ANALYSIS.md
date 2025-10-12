# Auto-Reply System - Complete Analysis & Fix

**Date**: 2025-10-10
**Version**: v0.21.1
**Status**: 🔴 BROKEN - Critical Bug Identified

---

## 🎯 Executive Summary

The autonomous auto-reply system is **NOT working** for IMAP/SMTP email accounts. Gmail OAuth accounts work correctly, but IMAP accounts (which includes `hung@theaiwhisperer.de`) never trigger email classification, preventing autonomous reply drafts from being created.

**Root Cause**: The `syncImapAccount()` function syncs emails but never calls `ReplyProcessor.processUnclassifiedEmails()`.

---

## 📊 System Architecture

### Expected Workflow (Every 5 Minutes)

```
1. Ubuntu Docker Cron (every 5 min)
   ↓
2. POST /api/cron/fetch-emails
   ↓
3. Email Sync
   ├─ Gmail OAuth → syncGmailAccount() ✅ Works
   └─ IMAP/SMTP → syncImapAccount() ❌ BROKEN
   ↓
4. Email Classification (ReplyProcessor.processUnclassifiedEmails)
   ↓
5. Auto-Draft Creation (for human_reply emails only)
   ↓
6. Reply Job Creation (scheduled 5-20 min in future)
   ↓
7. POST /api/cron/process-reply-jobs (every 5 min)
   ↓
8. Email Sending (via Gmail API or SMTP)
```

---

## 🔍 Detailed Analysis

### File: `/api/cron/fetch-emails/route.ts`

#### ✅ Gmail OAuth Path (WORKS)
```typescript
// Line 10-38: syncGmailAccount()
async function syncGmailAccount(supabase, account, syncSent) {
  // Fetch emails from Gmail API
  const inboxEmails = await gmailService.fetchGmailEmails(...)

  // Persist to database
  const inboxResult = await persistGmailEmails(supabase, account, inboxEmails, 'incoming')

  return { newEmails: inboxResult.newEmails, ... }
}

// Line 142-217: persistGmailEmails()
async function persistGmailEmails(supabase, account, emails, type) {
  const newEmailIds = []

  for (const email of emails) {
    // Insert into incoming_emails
    const inserted = await supabase.from('incoming_emails').insert(payload)
    if (type === 'incoming' && inserted?.id) {
      newEmailIds.push(inserted.id)  // ← Track new email IDs
    }
  }

  // ✅ TRIGGERS CLASSIFICATION
  if (type === 'incoming' && newEmailIds.length > 0) {
    const { ReplyProcessor } = await import('@/lib/reply-processor')
    const replyProcessor = new ReplyProcessor()
    await replyProcessor.processUnclassifiedEmails(account.user_id, newEmailIds.length)
  }

  return { newEmails: newEmailsCount }
}
```

#### ❌ IMAP Path (BROKEN)
```typescript
// Line 41-120: syncImapAccount()
async function syncImapAccount(supabase, account, syncSent) {
  const imapProcessor = new IMAPProcessor()

  // Sync emails via IMAP
  const syncResult = await imapProcessor.syncEmails(
    account.user_id,
    account.id,
    imapConfig,
    lastProcessedUID
  )

  // ❌ NO CLASSIFICATION TRIGGER HERE!
  // Email stored with classification_status='unclassified' but never processed

  return {
    newEmails: syncResult.newEmails,  // ← Just a count, no IDs
    errors: combinedErrors
  }
}
```

### File: `lib/imap-processor.ts`

#### Email Storage (Line 625-688)
```typescript
private async storeIncomingEmail(email, userId, emailAccountId) {
  // Check for duplicates
  const { data: existing } = await this.supabase
    .from('incoming_emails')
    .select('id, archived_at')
    .eq('message_id', email.messageId)
    .single()

  if (existing) return  // Skip duplicates

  // Insert email with unclassified status
  const payload = {
    user_id: userId,
    email_account_id: emailAccountId,
    message_id: email.messageId,
    from_address: email.from,
    subject: email.subject,
    processing_status: 'pending',        // ← Set to pending
    classification_status: 'unclassified' // ← Set to unclassified
  }

  await this.supabase.from('incoming_emails').insert(payload)

  // ❌ NO CLASSIFICATION TRIGGER!
  // Email sits in database forever with status='unclassified'
}
```

---

## 🐛 Identified Bugs

### Bug #1: IMAP Sync Doesn't Trigger Classification ⚠️ CRITICAL

**Location**: `src/app/api/cron/fetch-emails/route.ts:41-120`

**Problem**:
- `syncImapAccount()` calls `IMAPProcessor.syncEmails()`
- `IMAPProcessor.syncEmails()` stores emails in database
- Returns only a count: `{ newEmails: 5 }`
- Never calls `ReplyProcessor.processUnclassifiedEmails()`

**Impact**: IMAP/SMTP accounts never get emails classified → No auto-drafts created

**Affected Accounts**:
- Provider: `smtp`
- Provider: `gmail-imap-smtp`
- Provider: `gmail` (without OAuth tokens)

### Bug #2: No Fallback Classification Mechanism

**Problem**: If classification fails during sync, emails stay `unclassified` forever

**Missing**: Separate cron job to process `unclassified` emails as a safety net

### Bug #3: No Monitoring or Health Checks

**Problem**: System fails silently - no way to detect classification pipeline failures

**Missing**:
- Health check endpoint for auto-reply system
- Logging of classification success/failure rates
- Alerts for unprocessed emails

---

## ✅ Solution Architecture

### Fix #1: Add Classification Trigger to IMAP Sync

**File**: `src/app/api/cron/fetch-emails/route.ts`

**Change**: Modify `syncImapAccount()` to trigger classification just like Gmail OAuth path

```typescript
async function syncImapAccount(supabase: any, account: any, syncSent: boolean = false) {
  const imapProcessor = new IMAPProcessor()

  // ... existing IMAP config setup ...

  // Sync emails via IMAP
  const syncResult = await imapProcessor.syncEmails(
    account.user_id,
    account.id,
    imapConfig,
    lastProcessedUID
  )

  // ✅ NEW: Trigger classification if new emails were synced
  if (syncResult.newEmails > 0) {
    console.log(`🔄 Triggering classification for ${syncResult.newEmails} new IMAP emails`)

    try {
      const { ReplyProcessor } = await import('@/lib/reply-processor')
      const replyProcessor = new ReplyProcessor()
      await replyProcessor.processUnclassifiedEmails(account.user_id, syncResult.newEmails)

      console.log(`✅ Classification triggered successfully for ${account.email}`)
    } catch (classificationError) {
      console.error(`❌ Classification failed for ${account.email}:`, classificationError)
      // Don't fail the sync - emails are still stored, will be processed by fallback cron
    }
  }

  // ... rest of function ...
}
```

### Fix #2: Create Fallback Classification Cron Job

**New File**: `src/app/api/cron/classify-emails/route.ts`

This runs every 5 minutes as a safety net to catch any unclassified emails.

```typescript
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()

  // Get all users with unclassified emails
  const { data: users } = await supabase
    .from('incoming_emails')
    .select('user_id')
    .eq('classification_status', 'unclassified')
    .eq('processing_status', 'pending')

  const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])]

  console.log(`🔄 Found ${uniqueUserIds.length} users with unclassified emails`)

  const results = []

  for (const userId of uniqueUserIds) {
    try {
      const { ReplyProcessor } = await import('@/lib/reply-processor')
      const replyProcessor = new ReplyProcessor()
      const result = await replyProcessor.processUnclassifiedEmails(userId, 100)

      results.push({
        userId,
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        autonomousDrafts: result.autonomousDraftsCreated
      })
    } catch (error) {
      results.push({ userId, error: error.message })
    }
  }

  return NextResponse.json({
    success: true,
    totalUsers: uniqueUserIds.length,
    results
  })
}
```

**Docker Cron Update** (`docker-ubuntu-cron/docker-compose.yml`):

Add new cron job:
```bash
# Classify unclassified emails every 5 minutes (fallback safety net)
*/5 * * * * echo \"[classify-emails] Running at \\$(date -u +\\\"%Y-%m-%dT%H:%M:%SZ\\\")\" && curl -sS -m 60 -X POST \"$${VERCEL_APP_URL}/api/cron/classify-emails\" -H \"Authorization: Bearer $${CRON_SECRET}\" || echo \"[classify-emails] Request failed at \\$(date -u +\\\"%Y-%m-%dT%H:%M:%SZ\\\")\"
```

### Fix #3: Create Auto-Reply System Health Check

**New File**: `src/app/api/auto-reply/health/route.ts`

Comprehensive health check showing system status:

```typescript
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  // Check unclassified emails
  const { data: unclassifiedEmails } = await supabase
    .from('incoming_emails')
    .select('id, date_received, user_id')
    .eq('classification_status', 'unclassified')
    .eq('processing_status', 'pending')

  // Check emails older than 10 minutes still unclassified (BAD)
  const stuckEmails = unclassifiedEmails?.filter(e =>
    Date.now() - new Date(e.date_received).getTime() > 10 * 60 * 1000
  ) || []

  // Check reply jobs waiting to send
  const { data: pendingJobs } = await supabase
    .from('reply_jobs')
    .select('id, scheduled_at')
    .in('status', ['scheduled', 'approved'])
    .lte('scheduled_at', new Date().toISOString())

  // Check agents assigned to email accounts
  const { data: assignedAgents } = await supabase
    .from('email_accounts')
    .select('id, email, assigned_agent_id')
    .not('assigned_agent_id', 'is', null)

  const health = {
    status: stuckEmails.length === 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    unclassifiedEmails: {
      total: unclassifiedEmails?.length || 0,
      stuck: stuckEmails.length,  // Older than 10 min
      stuckEmails: stuckEmails.map(e => ({
        id: e.id,
        ageMinutes: Math.floor((Date.now() - new Date(e.date_received).getTime()) / (60 * 1000))
      }))
    },
    pendingReplies: {
      total: pendingJobs?.length || 0,
      overdue: pendingJobs?.filter(j =>
        Date.now() - new Date(j.scheduled_at).getTime() > 5 * 60 * 1000
      ).length || 0
    },
    agents: {
      totalAssigned: assignedAgents?.length || 0
    }
  }

  return NextResponse.json(health)
}
```

---

## 🚀 Implementation Plan

### Phase 1: Critical Fixes (Immediate)

1. **Fix IMAP Classification Trigger**
   - Modify `syncImapAccount()` in `src/app/api/cron/fetch-emails/route.ts`
   - Add classification trigger after successful IMAP sync
   - Add error handling and logging

2. **Create Fallback Classification Cron**
   - Create `/api/cron/classify-emails/route.ts`
   - Add to Docker cron configuration
   - Deploy to Vercel

### Phase 2: Monitoring & Safety (Within 24 hours)

3. **Create Health Check Endpoint**
   - Create `/api/auto-reply/health/route.ts`
   - Add diagnostic queries

4. **Add Comprehensive Logging**
   - Classification success/failure
   - Auto-draft creation
   - Reply sending

### Phase 3: Testing & Verification

5. **Test with hung@theaiwhisperer.de**
   - Manually sync email account
   - Verify classification runs
   - Verify Sam Sales creates draft
   - Verify reply is scheduled
   - Verify reply is sent

6. **Monitor for 24 Hours**
   - Check health endpoint
   - Verify no stuck emails
   - Verify auto-drafts are created
   - Verify replies are sent

---

## 📝 Testing Checklist

### Pre-Deployment Checks
- [ ] Code changes reviewed
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Docker cron configuration updated

### Post-Deployment Checks (hung@theaiwhisperer.de)
- [ ] Email sync completes successfully
- [ ] Classification runs (check logs)
- [ ] Email classified as `human_reply`
- [ ] Sam Sales agent creates draft
- [ ] Reply job created with `scheduled` status
- [ ] Reply job appears in Scheduled Replies UI
- [ ] Reply is sent at scheduled time
- [ ] Email tracking record created

### Health Check Verification
- [ ] `/api/auto-reply/health` shows `status: "healthy"`
- [ ] No stuck emails (unclassified >10 min old)
- [ ] No overdue reply jobs
- [ ] Agents assigned correctly

---

## 🔧 Configuration Requirements

### Vercel Environment Variables
```bash
CRON_SECRET=<your-secret>  # Already configured
OPENAI_API_KEY=<key>       # For AI classification
ANTHROPIC_API_KEY=<key>    # For AI reply drafting
```

### Ubuntu Docker Cron
**Location**: `87.106.70.121:/docker-ubuntu-cron/docker-compose.yml`

**Updated Cron Jobs**:
```bash
# Fetch emails every 5 minutes (triggers classification)
*/5 * * * * curl -sS -m 70 -X POST "${VERCEL_APP_URL}/api/cron/fetch-emails" -H "Authorization: Bearer ${CRON_SECRET}"

# Classify unclassified emails every 5 minutes (fallback)
*/5 * * * * curl -sS -m 60 -X POST "${VERCEL_APP_URL}/api/cron/classify-emails" -H "Authorization: Bearer ${CRON_SECRET}"

# Send scheduled replies every 5 minutes
*/5 * * * * curl -sS -m 25 -X POST "${VERCEL_APP_URL}/api/cron/process-reply-jobs" -H "Authorization: Bearer ${CRON_SECRET}"
```

---

## 📊 Success Metrics

### Before Fix (Current State)
- IMAP emails: 0% classified
- Auto-drafts created: 0
- Autonomous replies sent: 0

### After Fix (Expected)
- IMAP emails: >95% classified within 5 min
- Auto-drafts created: 100% of `human_reply` emails
- Autonomous replies sent: 100% of scheduled jobs
- System health: "healthy" status

---

## 🎯 Expected Timeline

**T+0 min**: Deploy v0.21.1 to Vercel
**T+5 min**: First email sync with classification
**T+10 min**: Classification processed
**T+15-35 min**: Auto-draft created and scheduled
**T+20-40 min**: Reply sent automatically

Total time from email received to reply sent: **20-40 minutes** (configurable)

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: Classification not running
**Check**: `/api/auto-reply/health` - look for stuck emails
**Fix**: Manually trigger `/api/cron/classify-emails`

**Issue**: No auto-drafts created
**Check**: Agent assigned to email account?
**Fix**: Assign Sam Sales agent via Dashboard → Email Accounts

**Issue**: Drafts created but not sent
**Check**: `/api/auto-reply/health` - look for overdue jobs
**Fix**: Check reply-job-processor logs for sending errors

### Debug SQL Queries

```sql
-- Check unclassified emails
SELECT id, from_address, subject, date_received,
       EXTRACT(EPOCH FROM (NOW() - date_received))/60 as age_minutes
FROM incoming_emails
WHERE classification_status = 'unclassified'
  AND processing_status = 'pending'
ORDER BY date_received DESC;

-- Check agent assignments
SELECT ea.email, ea.assigned_agent_id, oa.name, oa.status
FROM email_accounts ea
LEFT JOIN outreach_agents oa ON ea.assigned_agent_id = oa.id;

-- Check recent reply jobs
SELECT id, recipient_email, draft_subject, status, scheduled_at, created_at
FROM reply_jobs
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Next Review**: After v0.21.1 deployment
