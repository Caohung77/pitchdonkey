# Batch Scheduling System - Testing & Verification Guide

## Overview

This guide provides comprehensive testing instructions for the batch scheduling system, including automated unit tests, manual integration tests, and Supabase database verification.

## Quick Start

```bash
# Run all automated tests
npm test -- --testPathPattern=batch-scheduling

# Run comprehensive test suite (includes manual verification prompts)
./scripts/test-batch-scheduling.sh
```

---

## 1. Automated Unit Tests

### Running Unit Tests

```bash
npm test -- --testPathPattern=batch-scheduling.test.ts --verbose
```

### Test Coverage

The test suite covers:

✅ **Batch Schedule Generation** (4 tests)
- Correct batch calculation for various contact counts
- 20-minute interval timing
- Uneven distribution handling
- Edge cases (0 contacts, exact multiples)

✅ **Campaign Processor Logic** (3 tests)
- Time-based batch triggering
- Skipping campaigns when batch time hasn't arrived
- Campaign completion detection

✅ **Batch Status Updates** (2 tests)
- Marking batches as sent with timestamps
- Setting next_batch_send_time correctly
- Campaign completion when all batches sent

✅ **Warmup Integration** (2 tests)
- Batch size limiting based on warmup status
- Full batch size when warmup complete

✅ **Database Schema** (1 test)
- JSONB structure validation

✅ **Edge Cases** (3 tests)
- Zero contacts, exact multiples, empty contact_ids fallback

### Expected Result

```
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

---

## 2. Supabase Database Verification

### Check Column Exists

Run in Supabase SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'campaigns'
  AND column_name = 'batch_schedule';
```

**Expected Result:**
```
column_name     | data_type | is_nullable
batch_schedule  | jsonb     | YES
```

### Verify Index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'campaigns'
  AND indexname = 'idx_campaigns_batch_schedule';
```

**Expected Result:**
```
indexname                      | indexdef
idx_campaigns_batch_schedule   | CREATE INDEX idx_campaigns_batch_schedule ON public.campaigns USING gin (batch_schedule)
```

### Sample Data Structure

```sql
SELECT
  id,
  name,
  status,
  batch_schedule,
  next_batch_send_time
FROM campaigns
WHERE batch_schedule IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

**Expected batch_schedule structure:**
```json
{
  "batches": [
    {
      "batch_number": 1,
      "scheduled_time": "2025-10-02T20:00:00.000Z",
      "contact_ids": ["id1", "id2", "id3", "id4", "id5"],
      "contact_count": 5,
      "status": "pending"
    },
    {
      "batch_number": 2,
      "scheduled_time": "2025-10-02T20:20:00.000Z",
      "contact_ids": ["id6", "id7", "id8", "id9", "id10"],
      "contact_count": 5,
      "status": "pending"
    }
  ],
  "batch_size": 5,
  "batch_interval_minutes": 20,
  "total_batches": 2,
  "total_contacts": 10,
  "estimated_completion": "2025-10-02T20:20:00.000Z"
}
```

---

## 3. End-to-End Integration Test

### Prerequisites

1. **Email Account**: At least one connected email account
2. **Contacts**: 10-15 test contacts in a list
3. **Dev Server**: Running on http://localhost:3002
4. **Cron Job**: Configured to run every 5 minutes

### Test Procedure

#### Step 1: Create Test Campaign

1. Navigate to: http://localhost:3002/dashboard/campaigns/simple/new
2. Fill in campaign details:
   - **Name**: "Batch Test Campaign"
   - **Subject**: "Test Email - Batch {{batch_number}}"
   - **Content**: Simple test content
3. **Contact Selection**:
   - Select a list with 10 contacts
4. **Batch Settings** (Step 3):
   - **Batch Size**: 5 (creates 2 batches)
   - **Schedule**: "Send now" or 1-2 minutes from now
5. Click "Create Campaign"

#### Step 2: Verify Batch Schedule Created

**In Supabase SQL Editor:**

```sql
SELECT
  id,
  name,
  status,
  batch_schedule->'batch_size' as batch_size,
  batch_schedule->'total_batches' as total_batches,
  batch_schedule->'total_contacts' as total_contacts,
  next_batch_send_time,
  created_at
FROM campaigns
WHERE name = 'Batch Test Campaign'
ORDER BY created_at DESC
LIMIT 1;
```

**Verify:**
- ✅ `batch_size` = 5
- ✅ `total_batches` = 2
- ✅ `total_contacts` = 10
- ✅ `next_batch_send_time` = First batch scheduled time
- ✅ `status` = 'scheduled' or 'sending'

**Check Batch Details:**

```sql
SELECT
  jsonb_array_elements(batch_schedule->'batches') as batch_details
FROM campaigns
WHERE name = 'Batch Test Campaign'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Output:**
```json
{"batch_number": 1, "scheduled_time": "...", "contact_count": 5, "status": "pending", ...}
{"batch_number": 2, "scheduled_time": "...", "contact_count": 5, "status": "pending", ...}
```

#### Step 3: Monitor First Batch Execution

**Wait for scheduled time or manually trigger:**

```bash
curl -X POST http://localhost:3002/api/cron/process-campaigns
```

**Check Server Logs:**

Look for these log messages:

```
🚀 === CAMPAIGN PROCESSOR STARTED ===
📋 Found 1 campaigns to process
🔄 Will process Batch Test Campaign - has pending batch ready
🎯 === PROCESSING CAMPAIGN: Batch Test Campaign ===
📅 Using batch schedule for campaign <campaign-id>
📧 Processing batch 1/2
   Scheduled: <time>
   Contacts: 5
✅ Email sent successfully to <contact-email>
[... 5 emails total ...]
📅 Updating batch schedule after processing
📅 Next batch scheduled for: <batch-2-time>
📊 Batch 2/2
```

**Verify in Database:**

```sql
SELECT
  status,
  emails_sent,
  batch_schedule->'batches'->0->>'status' as batch1_status,
  batch_schedule->'batches'->1->>'status' as batch2_status,
  next_batch_send_time
FROM campaigns
WHERE name = 'Batch Test Campaign';
```

**Expected:**
- ✅ `status` = 'sending'
- ✅ `emails_sent` = 5
- ✅ `batch1_status` = 'sent'
- ✅ `batch2_status` = 'pending'
- ✅ `next_batch_send_time` = Batch 2 scheduled time

#### Step 4: Monitor Second Batch Execution

**Wait for 20 minutes (or batch 2 scheduled time)**

The cron job should automatically trigger, or manually run:

```bash
curl -X POST http://localhost:3002/api/cron/process-campaigns
```

**Check Server Logs:**

```
🔄 Will process Batch Test Campaign - has pending batch ready
📧 Processing batch 2/2
✅ Email sent successfully to <contact-email>
[... 5 more emails ...]
🎉 All batches completed! Campaign finished.
```

**Verify Campaign Completion:**

```sql
SELECT
  status,
  emails_sent,
  batch_schedule->'batches'->0->>'status' as batch1_status,
  batch_schedule->'batches'->1->>'status' as batch2_status,
  next_batch_send_time,
  end_date
FROM campaigns
WHERE name = 'Batch Test Campaign';
```

**Expected:**
- ✅ `status` = 'completed'
- ✅ `emails_sent` = 10
- ✅ `batch1_status` = 'sent'
- ✅ `batch2_status` = 'sent'
- ✅ `next_batch_send_time` = NULL
- ✅ `end_date` IS NOT NULL

#### Step 5: Verify in UI

1. Navigate to: http://localhost:3002/dashboard/campaigns
2. Find "Batch Test Campaign"
3. Verify:
   - ✅ Status shows "Completed"
   - ✅ Progress shows "10 of 10 emails sent"
   - ✅ Batch badge shows "Batch 2/2" or completed indicator
   - ✅ All 10 emails visible in campaign analytics

---

## 4. Cron Job Verification

### Check Cron Configuration

On your Ubuntu server:

```bash
# View current crontab
crontab -l

# Expected entry:
*/5 * * * * curl -X POST http://localhost:3002/api/cron/process-campaigns
```

### Check Cron Execution Logs

```bash
# View system cron logs
grep CRON /var/log/syslog | tail -20

# Or application logs if using pm2/systemd
pm2 logs pitchdonkey
```

### Manual Cron Trigger

```bash
curl -v -X POST http://localhost:3002/api/cron/process-campaigns
```

**Expected Response:**

```json
{
  "success": true,
  "processed": 1,
  "message": "Campaign processing completed"
}
```

---

## 5. Troubleshooting

### Issue: Batch 2 Not Triggering

**Symptoms:**
- First batch sends successfully
- Second batch never triggers after 20 minutes
- Campaign stays in "sending" status

**Diagnosis:**

```sql
SELECT
  id,
  name,
  status,
  next_batch_send_time,
  NOW() as current_time,
  batch_schedule->'batches' as batches
FROM campaigns
WHERE status = 'sending'
  AND batch_schedule IS NOT NULL;
```

**Check:**
1. Is `next_batch_send_time` set correctly?
2. Is `next_batch_send_time` < current time?
3. Are there pending batches in `batch_schedule.batches`?

**Common Fixes:**

```bash
# 1. Restart dev server to reload campaign processor
npm run dev

# 2. Manually trigger cron
curl -X POST http://localhost:3002/api/cron/process-campaigns

# 3. Check campaign processor logs
tail -f /path/to/logs | grep "CAMPAIGN PROCESSOR"
```

### Issue: Campaign Marked Completed After First Batch

**Cause:** Old completion logic counting `emails_sent` vs `total_contacts`

**Fix:** Ensure v0.16.5+ is deployed with new batch-aware completion logic

**Verify Fix:**

```bash
# Check campaign-processor.ts
grep -A 5 "batch_schedule?.batches" lib/campaign-processor.ts

# Should show time-based batch filtering logic
```

### Issue: Empty contact_ids Array

**Symptoms:**
- Batch has `contact_ids: []`
- No emails sent even when batch time arrives

**Fix:** Fallback logic should fetch contacts from contact lists

**Verify:**

```bash
grep -A 10 "contact_ids.length > 0" lib/campaign-processor.ts
```

Should show fallback logic that queries contact lists when array is empty.

---

## 6. Test Report Template

### Test Execution Summary

**Date:** _________________
**Tester:** _________________
**Environment:** Development / Staging / Production
**Version:** v0.16.5+

#### Unit Tests

- [ ] All 15 unit tests passed
- [ ] Test coverage ≥ 80%
- [ ] No test failures or warnings

#### Database Schema

- [ ] `batch_schedule` column exists (JSONB)
- [ ] Index `idx_campaigns_batch_schedule` created
- [ ] Sample data structure validated

#### Integration Tests

- [ ] Campaign created with batch schedule
- [ ] First batch triggered at scheduled time
- [ ] First batch marked as 'sent' correctly
- [ ] Second batch triggered 20 minutes later
- [ ] Second batch completed successfully
- [ ] Campaign marked as 'completed'
- [ ] All 10 emails sent and tracked

#### Cron Job

- [ ] Cron job configured (every 5 minutes)
- [ ] Cron job executing successfully
- [ ] Manual trigger works
- [ ] Logs show campaign processing

#### UI Verification

- [ ] Campaign list shows correct status
- [ ] Progress bar accurate (X of Y emails)
- [ ] Batch badge displays correctly
- [ ] Campaign details page shows batch info

### Issues Found

_List any issues discovered during testing_

### Sign-Off

**Tester Signature:** _________________
**Date:** _________________

---

## 7. Continuous Testing

### Automated Testing in CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Batch Scheduling Tests
  run: npm test -- --testPathPattern=batch-scheduling
```

### Monitoring in Production

Set up alerts for:
- Campaigns stuck in 'sending' status > 2 hours
- `next_batch_send_time` in past but batch not processed
- Cron job failures

**Example Monitoring Query:**

```sql
-- Campaigns with pending batches that should have triggered
SELECT
  id,
  name,
  status,
  next_batch_send_time,
  NOW() - next_batch_send_time::timestamp as overdue_by
FROM campaigns
WHERE status = 'sending'
  AND next_batch_send_time < NOW()
  AND next_batch_send_time IS NOT NULL;
```

---

## Appendix

### A. Batch Scheduling Architecture

```
Campaign Creation
    ↓
Pre-calculate ALL batch times
    ↓
Store in batch_schedule JSONB
    ↓
Set next_batch_send_time = Batch 1 time
    ↓
Cron Job (every 5 min)
    ↓
Check campaigns WHERE next_batch_send_time <= NOW()
    ↓
Process batch
    ↓
Mark batch as 'sent', set next_batch_send_time = Batch 2 time
    ↓
Repeat until all batches sent
    ↓
Mark campaign as 'completed'
```

### B. Key Files

- **Tests:** `__tests__/lib/batch-scheduling.test.ts`
- **Processor:** `lib/campaign-processor.ts`
- **Campaign API:** `src/app/api/campaigns/simple/route.ts`
- **Cron API:** `src/app/api/cron/process-campaigns/route.ts`
- **Migration:** `supabase/migrations/20251002_add_batch_schedule.sql`
- **Test Script:** `scripts/test-batch-scheduling.sh`

### C. Version History

- **v0.16.0** - Initial batch scheduling implementation
- **v0.16.3** - Variable shadowing fix
- **v0.16.4** - Migration endpoint created
- **v0.16.5** - Fixed batch triggering logic (critical fix)

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review server logs for detailed error messages
3. Verify database state with SQL queries provided
4. Check GitHub issues: https://github.com/Caohung77/pitchdonkey/issues
