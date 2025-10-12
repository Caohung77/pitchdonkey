-- =====================================================
-- Click Tracking Database Schema Setup
-- Execute this SQL file in your Supabase SQL Editor
-- =====================================================

-- Click tracking for email links
CREATE TABLE IF NOT EXISTS click_tracking (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  original_url TEXT NOT NULL,
  tracking_url TEXT NOT NULL,
  campaign_id TEXT,
  contact_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  click_count INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  user_agent TEXT,
  ip_address TEXT,
  location JSONB,

  -- Foreign key constraints (will be created only if referenced tables exist)
  CONSTRAINT fk_click_tracking_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_click_tracking_contact
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Email events table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'replied')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recipient_email TEXT NOT NULL,
  provider_id TEXT NOT NULL DEFAULT 'tracking',
  event_data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  campaign_id TEXT,
  contact_id TEXT,

  -- Foreign key constraints (will be created only if referenced tables exist)
  CONSTRAINT fk_email_events_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_events_contact
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- =====================================================
-- Performance Indexes
-- =====================================================

-- Click tracking indexes
CREATE INDEX IF NOT EXISTS idx_click_tracking_message_id ON click_tracking(message_id);
CREATE INDEX IF NOT EXISTS idx_click_tracking_recipient_email ON click_tracking(recipient_email);
CREATE INDEX IF NOT EXISTS idx_click_tracking_campaign_id ON click_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_click_tracking_clicked ON click_tracking(clicked);
CREATE INDEX IF NOT EXISTS idx_click_tracking_created_at ON click_tracking(created_at);
CREATE INDEX IF NOT EXISTS idx_click_tracking_original_url ON click_tracking(original_url);

-- Email events indexes
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(type);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient_email ON email_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_processed ON email_events(processed);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_click_tracking_campaign_clicked ON click_tracking(campaign_id, clicked);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_type_timestamp ON email_events(campaign_id, type, timestamp);

-- =====================================================
-- Table Comments for Documentation
-- =====================================================

COMMENT ON TABLE click_tracking IS 'Stores click tracking data for email link tracking - tracks when recipients click links in emails';
COMMENT ON TABLE email_events IS 'Unified log of all email events including click events for analytics';

COMMENT ON COLUMN click_tracking.id IS 'Unique tracking ID generated for each link (e.g., track_123456789)';
COMMENT ON COLUMN click_tracking.message_id IS 'Email message identifier to link clicks to specific emails';
COMMENT ON COLUMN click_tracking.original_url IS 'The original destination URL before tracking was applied';
COMMENT ON COLUMN click_tracking.tracking_url IS 'The generated tracking URL that was sent in the email';
COMMENT ON COLUMN click_tracking.clicked IS 'Boolean flag indicating if this link has been clicked at least once';
COMMENT ON COLUMN click_tracking.click_count IS 'Total number of times this link has been clicked';

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check if tables were created successfully
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'click_tracking') THEN
        RAISE NOTICE '✅ click_tracking table created successfully';
    ELSE
        RAISE NOTICE '❌ click_tracking table creation failed';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_events') THEN
        RAISE NOTICE '✅ email_events table created successfully';
    ELSE
        RAISE NOTICE '❌ email_events table creation failed';
    END IF;
END
$$;

-- =====================================================
-- Test Data (Optional - Remove in Production)
-- =====================================================

-- Uncomment the following section to insert test data for verification

/*
-- Insert a test click tracking record
INSERT INTO click_tracking (
    id,
    message_id,
    recipient_email,
    original_url,
    tracking_url,
    clicked,
    click_count,
    created_at
) VALUES (
    'test_click_' || extract(epoch from now())::text,
    'test_message_' || extract(epoch from now())::text,
    'test@example.com',
    'https://example.com/test',
    'https://pitchdonkey.vercel.app/api/tracking/click/test_click_' || extract(epoch from now())::text,
    false,
    0,
    NOW()
);

-- Insert a test email event
INSERT INTO email_events (
    id,
    message_id,
    type,
    recipient_email,
    provider_id,
    event_data,
    timestamp
) VALUES (
    'test_event_' || extract(epoch from now())::text,
    'test_message_' || extract(epoch from now())::text,
    'clicked',
    'test@example.com',
    'tracking',
    '{"test": true, "setup": "verification"}'::jsonb,
    NOW()
);

-- Verify test data insertion
SELECT 'Test data inserted successfully' as status,
       COUNT(*) as click_tracking_records
FROM click_tracking
WHERE id LIKE 'test_click_%';
*/

-- =====================================================
-- Setup Complete
-- =====================================================

SELECT
    'Click tracking schema setup completed successfully!' as message,
    NOW() as setup_timestamp;

-- Display table information
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename IN ('click_tracking', 'email_events')
ORDER BY tablename;