-- Add batch_schedule field to campaigns table for proactive batch scheduling
-- This enables pre-calculated batch times with 20-minute intervals

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS batch_schedule JSONB DEFAULT NULL;

COMMENT ON COLUMN campaigns.batch_schedule IS 'Pre-calculated batch schedule with contact assignments and execution times. Format: { batches: [{ batch_number, scheduled_time, contact_ids, status }], batch_size, batch_interval_minutes, total_batches }';

-- Add index for faster queries on batch schedule
CREATE INDEX IF NOT EXISTS idx_campaigns_batch_schedule ON campaigns USING gin (batch_schedule);
