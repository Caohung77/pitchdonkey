-- Manual Campaign Database Migration
-- Run this in your Supabase SQL Editor to fix stuck campaign processing
--
-- This adds the missing batch scheduling and contact tracking fields
-- that are required by the campaign processor.

-- ==============================================
-- BATCH SCHEDULING FIELDS
-- ==============================================

-- Add next_batch_send_time field to track when the next batch should be sent
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS next_batch_send_time TIMESTAMP WITH TIME ZONE;

-- Add first_batch_sent_at to track the original send time for interval calculations
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS first_batch_sent_at TIMESTAMP WITH TIME ZONE;

-- Add batch_number to track which batch we're currently on
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_batch_number INTEGER DEFAULT 0;

-- ==============================================
-- CONTACT TRACKING FIELDS
-- ==============================================

-- Add contact tracking fields to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_processed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_remaining JSONB DEFAULT '[]'::jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_failed JSONB DEFAULT '[]'::jsonb;

-- Add batch tracking
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_history JSONB DEFAULT '[]'::jsonb;

-- ==============================================
-- PERFORMANCE INDEXES
-- ==============================================

-- Index for efficient querying of campaigns ready for batch sending
CREATE INDEX IF NOT EXISTS idx_campaigns_next_batch_send_time
ON campaigns(next_batch_send_time)
WHERE status IN ('sending', 'running');

-- Index for efficient status + timing queries
CREATE INDEX IF NOT EXISTS idx_campaigns_batch_processing
ON campaigns(status, next_batch_send_time, daily_send_limit)
WHERE status IN ('sending', 'running', 'scheduled');

-- Create index for better performance on contact tracking queries
CREATE INDEX IF NOT EXISTS idx_campaigns_contacts_processed ON campaigns USING GIN (contacts_processed);
CREATE INDEX IF NOT EXISTS idx_campaigns_contacts_remaining ON campaigns USING GIN (contacts_remaining);

-- ==============================================
-- INITIALIZE EXISTING CAMPAIGNS
-- ==============================================

-- Update existing campaigns to initialize contact tracking
UPDATE campaigns
SET
    contacts_processed = '[]'::jsonb,
    contacts_remaining = '[]'::jsonb,
    contacts_failed = '[]'::jsonb,
    batch_history = '[]'::jsonb,
    current_batch_number = 0
WHERE contacts_processed IS NULL;

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON COLUMN campaigns.next_batch_send_time IS 'Exact timestamp when the next batch of emails should be sent (10 minutes for testing, 24-hour intervals in production)';
COMMENT ON COLUMN campaigns.first_batch_sent_at IS 'Timestamp when the first batch was sent, used for calculating subsequent intervals';
COMMENT ON COLUMN campaigns.current_batch_number IS 'Current batch number (0 = not started, 1 = first batch sent, etc.)';
COMMENT ON COLUMN campaigns.contacts_processed IS 'Array of contact IDs that have successfully received emails';
COMMENT ON COLUMN campaigns.contacts_remaining IS 'Array of contact IDs that still need to receive emails';
COMMENT ON COLUMN campaigns.contacts_failed IS 'Array of contact IDs that failed to receive emails (with retry info)';
COMMENT ON COLUMN campaigns.batch_history IS 'History of batch sends with timestamps and counts';

-- ==============================================
-- VERIFICATION QUERY
-- ==============================================

-- Run this to verify all fields were added successfully:
-- SELECT
--     column_name,
--     data_type,
--     is_nullable,
--     column_default
-- FROM information_schema.columns
-- WHERE table_name = 'campaigns'
-- AND column_name IN (
--     'next_batch_send_time',
--     'first_batch_sent_at',
--     'current_batch_number',
--     'contacts_processed',
--     'contacts_remaining',
--     'contacts_failed',
--     'batch_history'
-- )
-- ORDER BY column_name;