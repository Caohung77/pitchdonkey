-- Fix Bounced Contacts Engagement Status
-- This script retroactively fixes engagement status for contacts with bounced emails
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Step 1: Find all contacts with bounced emails but not marked as 'bad'
SELECT
  id,
  email,
  engagement_score,x
  status,
  engagement_status,
  unsubscribed_at
FROM contacts
WHERE status = 'bounced'
  AND (engagement_status IS NULL OR engagement_status != 'bad');

-- Step 2: Update their engagement status to 'bad' and apply penalty
UPDATE contacts
SET
  engagement_status = 'bad',
  engagement_score = GREATEST(-100, COALESCE(engagement_score, 0) - 50),
  updated_at = NOW()
WHERE status = 'bounced'
  AND (engagement_status IS NULL OR engagement_status != 'bad');

-- Step 3: Show results
SELECT
  COUNT(*) as total_fixed,
  AVG(engagement_score) as avg_score_after_fix
FROM contacts
WHERE status = 'bounced'
  AND engagement_status = 'bad';

-- Alternative: If you want to fix only for specific user (replace USER_ID)
-- UPDATE contacts
-- SET
--   engagement_status = 'bad',
--   engagement_score = GREATEST(-100, COALESCE(engagement_score, 0) - 50),
--   updated_at = NOW()
-- WHERE status = 'bounced'
--   AND (engagement_status IS NULL OR engagement_status != 'bad')
--   AND user_id = 'YOUR_USER_ID_HERE';
