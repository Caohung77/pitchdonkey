-- Campaign Contact Tracking Migration
-- Adds proper contact tracking to prevent duplicate emails in bulk campaigns

-- Add contact tracking fields to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_processed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_remaining JSONB DEFAULT '[]'::jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_failed JSONB DEFAULT '[]'::jsonb;

-- Add batch tracking
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_history JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN campaigns.contacts_processed IS 'Array of contact IDs that have successfully received emails';
COMMENT ON COLUMN campaigns.contacts_remaining IS 'Array of contact IDs that still need to receive emails';
COMMENT ON COLUMN campaigns.contacts_failed IS 'Array of contact IDs that failed to receive emails (with retry info)';
COMMENT ON COLUMN campaigns.batch_history IS 'History of batch sends with timestamps and counts';

-- Create index for better performance on contact tracking queries
CREATE INDEX IF NOT EXISTS idx_campaigns_contacts_processed ON campaigns USING GIN (contacts_processed);
CREATE INDEX IF NOT EXISTS idx_campaigns_contacts_remaining ON campaigns USING GIN (contacts_remaining);

-- Update existing campaigns to initialize contact tracking
UPDATE campaigns
SET
    contacts_processed = '[]'::jsonb,
    contacts_remaining = COALESCE(
        (
            SELECT jsonb_agg(DISTINCT contact_id)
            FROM email_tracking
            WHERE campaign_id = campaigns.id
            AND status NOT IN ('sent', 'delivered')
        ),
        '[]'::jsonb
    ),
    contacts_failed = '[]'::jsonb,
    batch_history = '[]'::jsonb
WHERE contacts_processed IS NULL;