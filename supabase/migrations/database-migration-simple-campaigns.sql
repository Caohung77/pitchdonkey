-- Migration: Add Simple Campaign Support to Campaigns Table
-- This migration adds columns needed for simple (single email) campaigns

-- Add simple campaign fields to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_subject VARCHAR(500);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_immediately BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';

-- Add tracking fields for simple campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_send_limit INTEGER DEFAULT 50;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_opens BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_clicks BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_replies BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_test_enabled BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_test_config JSONB DEFAULT '{}';

-- Add statistics fields for simple campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_contacts INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_delivered INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_opened INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_clicked INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_replied INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_bounced INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_complained INTEGER DEFAULT 0;

-- Modify existing constraints to support simple campaigns
-- Drop the existing email_sequence constraint that requires non-empty array
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS valid_email_sequence;

-- Add new constraint that allows either email_sequence OR html_content
ALTER TABLE campaigns ADD CONSTRAINT valid_campaign_content CHECK (
    (jsonb_array_length(email_sequence) > 0) OR 
    (html_content IS NOT NULL AND length(html_content) > 0)
);

-- Update existing campaigns to have valid ai_settings if null
UPDATE campaigns SET ai_settings = '{}' WHERE ai_settings IS NULL;
UPDATE campaigns SET schedule_settings = '{}' WHERE schedule_settings IS NULL;

-- Add status values for simple campaigns
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (
    status IN ('draft', 'active', 'paused', 'completed', 'archived', 'sending', 'scheduled')
);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_campaigns_email_subject ON campaigns(email_subject);
CREATE INDEX IF NOT EXISTS idx_campaigns_send_immediately ON campaigns(send_immediately);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_date ON campaigns(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_html_content ON campaigns USING HASH (html_content) WHERE html_content IS NOT NULL;

-- Comments for new fields
COMMENT ON COLUMN campaigns.email_subject IS 'Email subject for simple campaigns';
COMMENT ON COLUMN campaigns.html_content IS 'HTML content for simple campaigns (single email)';
COMMENT ON COLUMN campaigns.send_immediately IS 'Whether to send the campaign immediately';
COMMENT ON COLUMN campaigns.scheduled_date IS 'When to send the campaign (if not immediate)';
COMMENT ON COLUMN campaigns.timezone IS 'Timezone for scheduled sending';
COMMENT ON COLUMN campaigns.daily_send_limit IS 'Maximum emails to send per day';
COMMENT ON COLUMN campaigns.total_contacts IS 'Total number of contacts in campaign';
COMMENT ON COLUMN campaigns.emails_sent IS 'Number of emails sent';
COMMENT ON COLUMN campaigns.emails_delivered IS 'Number of emails delivered';
COMMENT ON COLUMN campaigns.emails_opened IS 'Number of emails opened';
COMMENT ON COLUMN campaigns.emails_clicked IS 'Number of emails clicked';
COMMENT ON COLUMN campaigns.emails_replied IS 'Number of emails replied to';
COMMENT ON COLUMN campaigns.emails_bounced IS 'Number of emails bounced';
COMMENT ON COLUMN campaigns.emails_complained IS 'Number of spam complaints';