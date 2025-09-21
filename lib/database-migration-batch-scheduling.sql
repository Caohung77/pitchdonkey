-- Migration: Add consistent batch scheduling support
-- This migration adds support for 24-hour interval batch scheduling
-- ensuring emails are sent at the same time each day

-- Add next_batch_send_time field to track when the next batch should be sent
-- This replaces the daily midnight reset with precise 24-hour intervals
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS next_batch_send_time TIMESTAMP WITH TIME ZONE;

-- Add first_batch_sent_at to track the original send time for interval calculations
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS first_batch_sent_at TIMESTAMP WITH TIME ZONE;

-- Add batch_number to track which batch we're currently on
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_batch_number INTEGER DEFAULT 0;

-- Index for efficient querying of campaigns ready for batch sending
CREATE INDEX IF NOT EXISTS idx_campaigns_next_batch_send_time
ON campaigns(next_batch_send_time)
WHERE status IN ('sending', 'running');

-- Index for efficient status + timing queries
CREATE INDEX IF NOT EXISTS idx_campaigns_batch_processing
ON campaigns(status, next_batch_send_time, daily_send_limit)
WHERE status IN ('sending', 'running', 'scheduled');

COMMENT ON COLUMN campaigns.next_batch_send_time IS 'Exact timestamp when the next batch of emails should be sent (24-hour intervals)';
COMMENT ON COLUMN campaigns.first_batch_sent_at IS 'Timestamp when the first batch was sent, used for calculating subsequent intervals';
COMMENT ON COLUMN campaigns.current_batch_number IS 'Current batch number (0 = not started, 1 = first batch sent, etc.)';