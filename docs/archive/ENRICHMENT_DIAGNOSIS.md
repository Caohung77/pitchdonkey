# Enrichment Progress Bar Stuck at 67% - Diagnosis Report

## 🔍 Summary
Enrichment jobs consistently get stuck at approximately 67% progress (10/15 contacts processed) and never complete.

## 📊 Observed Symptoms
1. **Progress Bar**: Shows "10/15 contacts (2 failed)" = 67%
2. **Recent Activity**: Shows "Processing 0/15 contacts" (stale data)
3. **Job Status**: Marked as "Running" but no further progress
4. **Pattern**: Happens "every time" at approximately the same point

## 🐛 Root Causes Identified

### **PRIMARY ISSUE: Batch Chaining Failure**
**Severity**: CRITICAL ⚠️
**Location**: `src/app/api/contacts/bulk-enrich/process/route.ts:82-142`

**Description**:
The batch processor uses self-chaining via HTTP fetch() to process subsequent batches. When this chain breaks (network failure, Vercel timeout, cold start delay), enrichment stops mid-job.

**Why it stops at 67%**:
- With batch_size=3 and 15 total contacts → 5 batches needed
- Batches 1-4 succeed (12 contacts = 80%), but 2 contacts failed
- Actual completed: 10/15 = 67%
- Batch 5 fetch() fails → chain breaks → job stuck

**Evidence**:
```typescript
// Line 82-89: Self-chaining pattern
if (result.hasMore) {
  const nextBatchResponse = await fetch(processorUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobToProcess.id })
  })
}
```

**Failure Points**:
1. Network timeout (Vercel→Vercel inter-function call)
2. Cold start delay (>60s timeout)
3. Retry exhaustion (3 attempts × exponential backoff)
4. Vercel serverless function limit (60s max)

---

### **SECONDARY ISSUE: Progress Double-Counting**
**Severity**: MEDIUM
**Location**: `lib/bulk-contact-enrichment.ts:489-658`

**Description**:
The `processBatch()` function may double-count progress if batch restarts or retries.

**Problem Code**:
```typescript
// Line 489-498: Gets cumulative progress at batch start
const { data: jobData } = await supabase
  .from('bulk_enrichment_jobs')
  .select('progress')
  .eq('id', jobId)
  .single()
const cumulativeProgress = (jobData?.progress as any) || { completed: 0, failed: 0 }

// Line 582-590: Updates progress AFTER EACH contact
const batchCompleted = results.filter(r => r.success).length
const totalCompleted = cumulativeProgress.completed + batchCompleted
await this.updateJobProgress(jobId, {
  completed: totalCompleted,
  failed: totalFailed
})
```

**Scenario**:
1. Batch processes contact 1 → cumulativeProgress.completed = 0 + 1 = 1
2. Batch processes contact 2 → cumulativeProgress.completed = 0 + 2 = 2 (should be 1 + 1 = 2) ✅
3. **Batch RETRIES** → cumulativeProgress.completed = 2 (from DB)
4. Batch processes contact 1 again → cumulativeProgress.completed = 2 + 1 = 3 ❌ (DOUBLE-COUNTED)

**Fix**: Recalculate cumulative progress BEFORE each contact update instead of caching at batch start.

---

### **TERTIARY ISSUE: Stale Activity Data**
**Severity**: LOW (UI-only)
**Location**: `src/app/api/dashboard/activity/route.ts:22-35`

**Description**:
Recent Activity shows "Processing 0/15" while progress bar shows "10/15" due to data source mismatch.

**Explanation**:
- **Progress Bar**: Uses realtime subscription (`useEnrichmentProgress` hook) → Always current
- **Recent Activity**: Uses REST API (`/api/dashboard/activity`) → May be stale/cached

**Impact**: Confusing UI only, does not affect actual enrichment.

**Fix**: Update activity route to show accurate progress or remove progress from activity description.

---

### **QUATERNARY ISSUE: Cron Job Not Configured**
**Severity**: MEDIUM
**Location**: Server cron configuration

**Description**:
The rescue cron job (`/api/cron/process-enrichment-jobs`) should recover stuck jobs every 5 minutes but may not be running.

**Required Setup**:
```bash
# Ubuntu Server Crontab
*/5 * * * * curl -X GET https://pitchdonkey.vercel.app/api/cron/process-enrichment-jobs \
  -H "Authorization: Bearer $CRON_SECRET" \
  >> /var/log/enrichment-cron.log 2>&1
```

**Check**:
1. Verify cron is configured: `crontab -l`
2. Check cron logs: `tail -f /var/log/enrichment-cron.log`
3. Verify CRON_SECRET environment variable is set in Vercel

---

## 🔧 Recommended Fixes (Priority Order)

### **Fix #1: Add Job Status Monitoring & Auto-Recovery**
Create a client-side fallback that detects stuck jobs and manually triggers recovery:

**File**: `hooks/useEnrichmentProgress.ts`
**Change**: Add stale job detection (job hasn't updated in >2 minutes → trigger manual recovery)

### **Fix #2: Improve Batch Chaining Reliability**
Add server-side queue system instead of HTTP chaining:

**Option A**: Use Vercel Queue (requires upgrade)
**Option B**: Use database-driven queue with polling

### **Fix #3: Fix Progress Double-Counting**
Refactor `processBatch()` to recalculate cumulative progress per-contact:

**File**: `lib/bulk-contact-enrichment.ts:489-658`
**Change**: Move cumulative progress fetch inside the contact loop

### **Fix #4: Setup Cron Job**
Configure Ubuntu server cron OR Vercel Cron (Hobby tier has free cron):

**Option A**: Ubuntu Server Cron (current approach)
**Option B**: Vercel Cron (vercel.json configuration)

### **Fix #5: Update Recent Activity Data**
Show accurate progress in Recent Activity feed:

**File**: `src/app/api/dashboard/activity/route.ts:27`
**Change**: Use realtime data or remove specific progress numbers

---

## 🧪 Testing Plan

1. **Reproduce Issue**: Start enrichment with 15 contacts, observe stuck at 67%
2. **Check Logs**: Review Vercel function logs for batch chaining failures
3. **Test Cron**: Manually trigger `/api/cron/process-enrichment-jobs` to verify recovery
4. **Verify Fix**: Apply fixes and test with 15+ contact enrichment

---

## 📝 Next Steps

1. **Immediate**: Setup cron job for stuck job recovery (Fix #4)
2. **Short-term**: Add client-side stale job detection (Fix #1)
3. **Long-term**: Migrate to queue-based batch processing (Fix #2)
4. **Optional**: Fix UI inconsistencies (Fix #3, #5)
