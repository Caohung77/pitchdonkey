-- Enhanced Contact Engagement Quality Rating System
-- This migration adds detailed engagement tracking columns and updates the enum

-- Add detailed engagement tracking columns
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS engagement_open_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_reply_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_bounce_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_complaint_count INTEGER NOT NULL DEFAULT 0;

-- Ensure engagement_status column uses the correct enum values
-- Update existing enum to include all 4-color system values
DO $$
BEGIN
  -- Check if enum values exist and add them if not
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'not_contacted' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contact_engagement_status')) THEN
    ALTER TYPE contact_engagement_status ADD VALUE 'not_contacted';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contact_engagement_status')) THEN
    ALTER TYPE contact_engagement_status ADD VALUE 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'engaged' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contact_engagement_status')) THEN
    ALTER TYPE contact_engagement_status ADD VALUE 'engaged';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bad' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contact_engagement_status')) THEN
    ALTER TYPE contact_engagement_status ADD VALUE 'bad';
  END IF;
END $$;

-- Create indexes for efficient filtering and sorting by engagement metrics
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_status_score ON contacts(engagement_status, engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_counts ON contacts(engagement_open_count, engagement_click_count, engagement_reply_count);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_last_positive_score ON contacts(engagement_last_positive_at DESC, engagement_score DESC);

-- Create a composite index for common filtering scenarios
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_filtering ON contacts(user_id, engagement_status, engagement_score DESC, status);

-- Add a function to automatically update engagement_updated_at when engagement fields change
CREATE OR REPLACE FUNCTION update_engagement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Update timestamp if any engagement-related field has changed
  IF (OLD.engagement_status IS DISTINCT FROM NEW.engagement_status OR
      OLD.engagement_score IS DISTINCT FROM NEW.engagement_score OR
      OLD.engagement_sent_count IS DISTINCT FROM NEW.engagement_sent_count OR
      OLD.engagement_open_count IS DISTINCT FROM NEW.engagement_open_count OR
      OLD.engagement_click_count IS DISTINCT FROM NEW.engagement_click_count OR
      OLD.engagement_reply_count IS DISTINCT FROM NEW.engagement_reply_count OR
      OLD.engagement_last_positive_at IS DISTINCT FROM NEW.engagement_last_positive_at) THEN
    NEW.engagement_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update engagement timestamp
DROP TRIGGER IF EXISTS trigger_update_engagement_timestamp ON contacts;
CREATE TRIGGER trigger_update_engagement_timestamp
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_engagement_timestamp();

-- Update existing contacts to have proper default engagement status
UPDATE contacts
SET engagement_status = 'not_contacted'
WHERE engagement_status IS NULL OR engagement_status = '';

-- Initialize engagement counts for existing contacts based on email_tracking data
WITH engagement_counts AS (
  SELECT
    contact_id,
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as open_count,
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as click_count,
    COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as reply_count,
    COUNT(CASE WHEN bounced_at IS NOT NULL OR status = 'bounced' THEN 1 END) as bounce_count,
    COUNT(CASE WHEN complained_at IS NOT NULL OR status = 'complained' THEN 1 END) as complaint_count
  FROM email_tracking
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
)
UPDATE contacts
SET
  engagement_open_count = COALESCE(engagement_counts.open_count, 0),
  engagement_click_count = COALESCE(engagement_counts.click_count, 0),
  engagement_reply_count = COALESCE(engagement_counts.reply_count, 0),
  engagement_bounce_count = COALESCE(engagement_counts.bounce_count, 0),
  engagement_complaint_count = COALESCE(engagement_counts.complaint_count, 0)
FROM engagement_counts
WHERE contacts.id = engagement_counts.contact_id;

-- Create a view for easy engagement analytics
CREATE OR REPLACE VIEW contact_engagement_analytics AS
SELECT
  engagement_status,
  COUNT(*) as contact_count,
  AVG(engagement_score) as avg_score,
  AVG(engagement_sent_count) as avg_emails_sent,
  AVG(engagement_open_count) as avg_opens,
  AVG(engagement_click_count) as avg_clicks,
  AVG(engagement_reply_count) as avg_replies
FROM contacts
WHERE engagement_status IS NOT NULL
GROUP BY engagement_status;

-- Grant necessary permissions
GRANT SELECT ON contact_engagement_analytics TO authenticated;