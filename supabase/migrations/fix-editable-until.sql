-- Backfill editable_until for existing reply_jobs
-- This sets editable_until to scheduled_at - 2 minutes for any jobs that don't have it set

UPDATE reply_jobs
SET editable_until = scheduled_at - INTERVAL '2 minutes'
WHERE editable_until IS NULL
  AND status IN ('scheduled', 'needs_approval', 'approved');

-- Verify the update
SELECT
  COUNT(*) as total_jobs,
  COUNT(editable_until) as jobs_with_editable_until,
  COUNT(*) - COUNT(editable_until) as jobs_without_editable_until
FROM reply_jobs
WHERE status IN ('scheduled', 'needs_approval', 'approved');
