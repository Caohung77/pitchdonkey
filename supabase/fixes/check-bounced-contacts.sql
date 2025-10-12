-- Check for bounced contacts in the database
-- Run this to see what bounced contacts exist

-- Check contacts with bounce count
SELECT
  COUNT(*) as total_contacts_with_bounces,
  SUM(engagement_bounce_count) as total_bounces
FROM contacts
WHERE engagement_bounce_count > 0;

-- Check their current engagement status
SELECT
  engagement_status,
  COUNT(*) as count,
  AVG(engagement_score) as avg_score,
  AVG(engagement_bounce_count) as avg_bounces
FROM contacts
WHERE engagement_bounce_count > 0
GROUP BY engagement_status;

-- Show sample of bounced contacts
SELECT
  email,
  engagement_bounce_count,
  engagement_status,
  engagement_score,
  last_contacted_at
FROM contacts
WHERE engagement_bounce_count > 0
LIMIT 10;
