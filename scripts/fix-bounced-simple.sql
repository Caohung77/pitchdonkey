-- Simple fix for bounced contacts
-- Copy and paste this entire block into Supabase SQL Editor

-- Update bounced contacts to have 'bad' engagement status
UPDATE contacts
SET
  engagement_status = 'bad',
  engagement_score = GREATEST(-100, COALESCE(engagement_score, 0) - 50),
  updated_at = NOW()
WHERE engagement_bounce_count > 0
  AND engagement_status != 'bad';

-- Show how many were updated
SELECT COUNT(*) as total_fixed FROM contacts WHERE engagement_bounce_count > 0 AND engagement_status = 'bad';
