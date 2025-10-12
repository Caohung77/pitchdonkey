-- Fix engagement status for contacts that have been in campaigns
-- This updates contacts that were imported before the engagement system was implemented

-- Step 1: Update contacts that have email tracking data (have been in campaigns)
-- Set them to 'engaged' if they have opens/clicks/replies, otherwise 'pending'
UPDATE contacts c
SET
  engagement_status = CASE
    -- If they have bounces/complaints/unsubscribed -> 'bad'
    WHEN EXISTS (
      SELECT 1 FROM email_tracking et
      WHERE et.contact_id = c.id
      AND (et.bounced_at IS NOT NULL OR et.complained_at IS NOT NULL OR et.unsubscribed_at IS NOT NULL)
    ) THEN 'bad'

    -- If they have any positive engagement (opens/clicks/replies) -> 'engaged'
    WHEN EXISTS (
      SELECT 1 FROM email_tracking et
      WHERE et.contact_id = c.id
      AND (et.opened_at IS NOT NULL OR et.clicked_at IS NOT NULL OR et.replied_at IS NOT NULL)
    ) THEN 'engaged'

    -- If they have been sent emails but no engagement -> 'pending'
    WHEN EXISTS (
      SELECT 1 FROM email_tracking et
      WHERE et.contact_id = c.id
      AND (et.sent_at IS NOT NULL OR et.delivered_at IS NOT NULL)
    ) THEN 'pending'

    -- Otherwise keep as 'not_contacted'
    ELSE 'not_contacted'
  END,

  -- Update engagement counts
  engagement_sent_count = COALESCE((
    SELECT COUNT(*) FROM email_tracking et
    WHERE et.contact_id = c.id
    AND (et.sent_at IS NOT NULL OR et.delivered_at IS NOT NULL)
  ), 0),

  engagement_open_count = COALESCE((
    SELECT COUNT(*) FROM email_tracking et
    WHERE et.contact_id = c.id
    AND et.opened_at IS NOT NULL
  ), 0),

  engagement_click_count = COALESCE((
    SELECT COUNT(*) FROM email_tracking et
    WHERE et.contact_id = c.id
    AND et.clicked_at IS NOT NULL
  ), 0),

  engagement_reply_count = COALESCE((
    SELECT COUNT(*) FROM email_tracking et
    WHERE et.contact_id = c.id
    AND et.replied_at IS NOT NULL
  ), 0),

  engagement_bounce_count = COALESCE((
    SELECT COUNT(*) FROM email_tracking et
    WHERE et.contact_id = c.id
    AND (et.bounced_at IS NOT NULL OR et.status = 'bounced')
  ), 0),

  -- Calculate engagement score
  engagement_score = LEAST(
    -- Opens: +5 per open, max 15
    LEAST(COALESCE((
      SELECT COUNT(*) FROM email_tracking et
      WHERE et.contact_id = c.id
      AND et.opened_at IS NOT NULL
    ), 0) * 5, 15) +

    -- Clicks: +20 per click, max 60
    LEAST(COALESCE((
      SELECT COUNT(*) FROM email_tracking et
      WHERE et.contact_id = c.id
      AND et.clicked_at IS NOT NULL
    ), 0) * 20, 60) +

    -- Replies: +50 per reply, no cap
    COALESCE((
      SELECT COUNT(*) FROM email_tracking et
      WHERE et.contact_id = c.id
      AND et.replied_at IS NOT NULL
    ), 0) * 50
  , 100), -- Cap at 100

  -- Set last positive engagement date
  engagement_last_positive_at = (
    SELECT MAX(GREATEST(
      COALESCE(et.replied_at, '1970-01-01'::timestamp),
      COALESCE(et.clicked_at, '1970-01-01'::timestamp),
      COALESCE(et.opened_at, '1970-01-01'::timestamp)
    ))
    FROM email_tracking et
    WHERE et.contact_id = c.id
    AND (et.replied_at IS NOT NULL OR et.clicked_at IS NOT NULL OR et.opened_at IS NOT NULL)
  ),

  updated_at = NOW()

WHERE
  -- Only update contacts that have email tracking data (been in campaigns)
  EXISTS (
    SELECT 1 FROM email_tracking et
    WHERE et.contact_id = c.id
  )
  -- And currently have 'not_contacted' status (meaning they weren't updated)
  AND c.engagement_status = 'not_contacted';

-- Show results
SELECT
  engagement_status,
  COUNT(*) as count,
  ROUND(AVG(engagement_score), 2) as avg_score
FROM contacts
GROUP BY engagement_status
ORDER BY
  CASE engagement_status
    WHEN 'engaged' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'not_contacted' THEN 3
    WHEN 'bad' THEN 4
  END;
