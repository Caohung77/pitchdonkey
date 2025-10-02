# Enrichment Progress Bar

Real-time progress tracking for contact enrichment jobs using Supabase Realtime.

## Overview

The enrichment progress bar provides live updates on contact enrichment operations through Supabase's Realtime subscriptions. It displays:
- **Compact mode**: Top bar indicator with percentage
- **Full mode**: Detailed card showing all active jobs with status

## Architecture

### Components

**`useEnrichmentProgress` Hook** (`src/hooks/useEnrichmentProgress.ts`)
- Subscribes to `bulk_enrichment_jobs` table changes via Supabase Realtime
- Tracks multiple concurrent jobs
- Auto-removes completed jobs after 5 seconds
- Returns active jobs array and aggregated progress

**`EnrichmentProgressBar` Component** (`components/enrichment/EnrichmentProgressBar.tsx`)
- **Compact mode**: Minimal indicator for top navigation bar
- **Full mode**: Detailed card for dashboard with multi-job support
- Color-coded status indicators
- Live percentage updates

### Database Schema

**Table: `bulk_enrichment_jobs`**
```sql
- id: UUID (primary key)
- user_id: UUID (references users)
- status: TEXT ('pending' | 'running' | 'completed' | 'failed' | 'cancelled')
- progress: JSONB {
    total: number
    completed: number
    failed: number
    current_batch: number
  }
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ (auto-updated via trigger)
```

**RLS Policy**: Users can only access their own enrichment jobs
**Realtime**: Enabled for `postgres_changes` events

## Usage

### Compact Mode (Top Bar)
```tsx
import { EnrichmentProgressBar } from '@/components/enrichment/EnrichmentProgressBar'

<EnrichmentProgressBar userId={user?.id} compact={true} />
```

**Features:**
- Shows only most recent active job
- Minimal space usage (inline with top nav)
- Displays: spinner, contact count, progress bar, percentage

### Full Mode (Dashboard Card)
```tsx
import { EnrichmentProgressBar } from '@/components/enrichment/EnrichmentProgressBar'

<EnrichmentProgressBar userId={user?.id} />
```

**Features:**
- Shows all active jobs
- Detailed status per job (pending, running, completed, failed)
- Failed contact count
- Color-coded progress bars

## Implementation Details

### Realtime Subscription
```typescript
const channel = supabase
  .channel('enrichment_jobs_changes')
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'bulk_enrichment_jobs',
      filter: `user_id=eq.${userId}`
    },
    handleJobUpdate
  )
  .subscribe()
```

### Progress Calculation
```typescript
const percentage = progress.total > 0
  ? Math.round((progress.completed / progress.total) * 100)
  : 0
```

### Auto-Cleanup
Completed/failed jobs are automatically removed from display after 5 seconds:
```typescript
if (!isActive && prev.has(job.id)) {
  setTimeout(() => {
    setActiveJobs(current => {
      const updated = new Map(current)
      updated.delete(job.id)
      return updated
    })
  }, 5000)
}
```

## Integration Points

### Dashboard Layout
Location: `src/app/dashboard/layout.tsx`
```tsx
<div className="flex flex-1 items-center">
  <EnrichmentProgressBar userId={user?.id} compact={true} />
</div>
```

### Dashboard Home
Location: `src/app/dashboard/page.tsx`
```tsx
{/* Enrichment Progress */}
<EnrichmentProgressBar userId={user?.id} />
```

### Enrichment Service
When updating job progress in `lib/bulk-contact-enrichment.ts`:
```typescript
await supabase
  .from('bulk_enrichment_jobs')
  .update({
    progress: {
      total,
      completed,
      failed,
      current_batch
    }
  })
  .eq('id', jobId)
// This triggers Realtime update → UI updates automatically
```

## Testing

### Manual Testing
1. Start an enrichment job for 10-15 contacts
2. Verify compact progress bar appears in top navigation
3. Navigate to dashboard home to see full card view
4. Watch real-time updates as contacts are processed
5. Verify completed jobs disappear after 5 seconds

### Test Multiple Jobs
1. Start first enrichment job
2. Wait a few seconds
3. Attempt to start second job
4. Should see error: "An enrichment job is already running..."
5. Verify only one job shows in progress indicators

### Verify Realtime Updates
1. Open browser DevTools → Network tab
2. Filter for WebSocket connections
3. Should see connection to `wss://[your-project].supabase.co/realtime/v1/websocket`
4. Start enrichment job
5. Watch for `postgres_changes` events in WebSocket messages

## Performance Considerations

### Optimization Strategies
- Uses `Map` for O(1) job lookups and updates
- Debounced updates via Supabase's built-in batching
- Auto-cleanup prevents memory leaks from old jobs
- Compact mode shows only most recent job to minimize rendering

### Resource Usage
- **WebSocket connection**: Shared across all Realtime subscriptions
- **Memory**: ~1KB per active job (negligible for typical usage)
- **Re-renders**: Only when job progress actually changes

## Troubleshooting

### Progress bar not appearing
1. Check user is authenticated (`userId` is defined)
2. Verify RLS policies allow user to read their jobs
3. Check browser console for Supabase connection errors

### Updates not real-time
1. Verify Realtime is enabled for `bulk_enrichment_jobs` table in Supabase dashboard
2. Check WebSocket connection in Network tab
3. Verify `updated_at` trigger is working (auto-updates on row changes)

### Multiple jobs showing when concurrent prevention is enabled
1. This is expected if jobs were started before v0.16.7
2. Old jobs should auto-complete and disappear
3. New jobs properly prevent concurrent execution

## Future Enhancements

Potential improvements:
- **Pause/Resume**: Add controls to pause and resume enrichment jobs
- **Cancel**: Allow users to cancel running jobs from the progress bar
- **Detailed breakdown**: Show batch-level progress within each job
- **Notifications**: Send browser notifications when jobs complete
- **History**: Keep completed jobs visible longer with "View History" link
- **Estimated time**: Calculate and display estimated completion time
