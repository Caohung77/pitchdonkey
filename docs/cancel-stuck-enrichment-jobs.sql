-- Cancel stuck enrichment jobs for medicuscs@gmail.com
-- Run this in Supabase SQL Editor

-- First, find the user_id for the email
-- Replace 'medicuscs@gmail.com' with the actual email if different
WITH user_lookup AS (
  SELECT id, email
  FROM auth.users
  WHERE email = 'medicuscs@gmail.com'
)
-- Update all running/pending jobs to cancelled
UPDATE bulk_enrichment_jobs
SET
  status = 'cancelled',
  updated_at = NOW()
WHERE user_id = (SELECT id FROM user_lookup)
  AND status IN ('running', 'pending')
RETURNING id, status, progress;

-- Alternative: If you want to cancel ALL stuck jobs across all users:
-- UPDATE bulk_enrichment_jobs
-- SET
--   status = 'cancelled',
--   updated_at = NOW()
-- WHERE status IN ('running', 'pending')
--   AND created_at < NOW() - INTERVAL '1 hour'
-- RETURNING id, user_id, status, progress;
