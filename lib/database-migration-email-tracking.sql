-- Migration: Create email_tracking table to fix campaign completion tracking
-- This replaces/enhances the email_sends table structure
-- Run this migration to fix the campaign progress tracking issue

-- Drop existing email_sends table if it exists (backup data first if needed)
-- CREATE TABLE email_sends_backup AS SELECT * FROM email_sends WHERE 1=1;
-- DROP TABLE IF EXISTS email_sends;

-- Create the email_tracking table that the code expects
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
  subject VARCHAR(500),
  content TEXT,
  personalized_content TEXT,
  ab_test_variant VARCHAR(100),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  bounce_reason TEXT,
  reply_content TEXT,
  reply_sentiment VARCHAR(20) CHECK (reply_sentiment IN ('positive', 'negative', 'neutral')),
  tracking_pixel_id UUID DEFAULT gen_random_uuid(),
  link_clicks JSONB DEFAULT '[]',
  tracking_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign_id ON email_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_contact_id ON email_tracking(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_status ON email_tracking(status);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sent_at ON email_tracking(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_delivered_at ON email_tracking(delivered_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_opened_at ON email_tracking(opened_at);

-- Create updated_at trigger
CREATE TRIGGER update_email_tracking_updated_at 
  BEFORE UPDATE ON email_tracking 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration from email_sends to email_tracking (if email_sends exists)
-- Uncomment and modify as needed if migrating existing data:
/*
INSERT INTO email_tracking (
  campaign_id, contact_id, email_account_id, step_number, status,
  subject, content, sent_at, opened_at, clicked_at, replied_at, 
  bounced_at, tracking_data, created_at, updated_at
)
SELECT 
  campaign_id, contact_id, email_account_id, step_number, 
  CASE send_status
    WHEN 'pending' THEN 'pending'
    WHEN 'sent' THEN 'sent'
    WHEN 'delivered' THEN 'delivered' 
    WHEN 'bounced' THEN 'bounced'
    WHEN 'failed' THEN 'failed'
    ELSE 'pending'
  END as status,
  subject, content, sent_at, opened_at, clicked_at, replied_at,
  bounced_at, tracking_data, created_at, updated_at
FROM email_sends
WHERE NOT EXISTS (
  SELECT 1 FROM email_tracking et 
  WHERE et.campaign_id = email_sends.campaign_id 
  AND et.contact_id = email_sends.contact_id
);
*/