-- Email tracking and analytics database schema

-- Tracking pixels for email opens
CREATE TABLE IF NOT EXISTS tracking_pixels (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  campaign_id TEXT,
  contact_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMP WITH TIME ZONE,
  open_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMP WITH TIME ZONE,
  user_agent TEXT,
  ip_address TEXT,
  location JSONB,
  
  -- Foreign key constraints
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

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
  
  -- Foreign key constraints
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Unsubscribe tokens
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  recipient_email TEXT NOT NULL,
  campaign_id TEXT,
  contact_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Foreign key constraints
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Bounce events
CREATE TABLE IF NOT EXISTS bounce_events (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  bounce_type TEXT NOT NULL CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
  bounce_sub_type TEXT,
  bounce_reason TEXT NOT NULL,
  diagnostic_code TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  provider_id TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  campaign_id TEXT,
  contact_id TEXT,
  
  -- Foreign key constraints
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Email events (unified event log)
CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'replied')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recipient_email TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  event_data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  campaign_id TEXT,
  contact_id TEXT,
  
  -- Foreign key constraints
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Email sends (record of all sent emails)
CREATE TABLE IF NOT EXISTS email_sends (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  message_id TEXT UNIQUE NOT NULL,
  provider_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error TEXT,
  error_code TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  campaign_id TEXT,
  contact_id TEXT,
  tracking_pixel_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraints
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (tracking_pixel_id) REFERENCES tracking_pixels(id) ON DELETE SET NULL
);

-- Email messages (store message content for queue processing)
CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  message_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email queue (for delayed and retry processing)
CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  message_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  priority INTEGER DEFAULT 2,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_attempt_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraints
  FOREIGN KEY (message_id) REFERENCES email_messages(id) ON DELETE CASCADE
);

-- Email providers (configuration for sending providers)
CREATE TABLE IF NOT EXISTS email_providers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gmail', 'outlook', 'smtp')),
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  daily_limit INTEGER DEFAULT 500,
  hourly_limit INTEGER DEFAULT 50,
  current_usage JSONB DEFAULT '{"daily": 0, "hourly": 0, "lastReset": ""}'::JSONB,
  authentication JSONB,
  deliverability_settings JSONB DEFAULT '{
    "dkimEnabled": false,
    "spfEnabled": false,
    "dmarcEnabled": false,
    "unsubscribeLink": true,
    "listUnsubscribeHeader": true
  }'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization

-- Tracking pixels indexes
CREATE INDEX IF NOT EXISTS idx_tracking_pixels_message_id ON tracking_pixels(message_id);
CREATE INDEX IF NOT EXISTS idx_tracking_pixels_recipient_email ON tracking_pixels(recipient_email);
CREATE INDEX IF NOT EXISTS idx_tracking_pixels_campaign_id ON tracking_pixels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tracking_pixels_opened ON tracking_pixels(opened);
CREATE INDEX IF NOT EXISTS idx_tracking_pixels_created_at ON tracking_pixels(created_at);

-- Click tracking indexes
CREATE INDEX IF NOT EXISTS idx_click_tracking_message_id ON click_tracking(message_id);
CREATE INDEX IF NOT EXISTS idx_click_tracking_recipient_email ON click_tracking(recipient_email);
CREATE INDEX IF NOT EXISTS idx_click_tracking_campaign_id ON click_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_click_tracking_clicked ON click_tracking(clicked);
CREATE INDEX IF NOT EXISTS idx_click_tracking_created_at ON click_tracking(created_at);

-- Unsubscribe tokens indexes
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON unsubscribe_tokens(token);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_recipient_email ON unsubscribe_tokens(recipient_email);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_used ON unsubscribe_tokens(used);

-- Bounce events indexes
CREATE INDEX IF NOT EXISTS idx_bounce_events_message_id ON bounce_events(message_id);
CREATE INDEX IF NOT EXISTS idx_bounce_events_recipient_email ON bounce_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_bounce_events_bounce_type ON bounce_events(bounce_type);
CREATE INDEX IF NOT EXISTS idx_bounce_events_timestamp ON bounce_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_bounce_events_processed ON bounce_events(processed);

-- Email events indexes
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(type);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient_email ON email_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_processed ON email_events(processed);

-- Email sends indexes
CREATE INDEX IF NOT EXISTS idx_email_sends_message_id ON email_sends(message_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_email ON email_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_success ON email_sends(success);
CREATE INDEX IF NOT EXISTS idx_email_sends_created_at ON email_sends(created_at);

-- Email queue indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority);
CREATE INDEX IF NOT EXISTS idx_email_queue_next_attempt_at ON email_queue(next_attempt_at);

-- Email providers indexes
CREATE INDEX IF NOT EXISTS idx_email_providers_type ON email_providers(type);
CREATE INDEX IF NOT EXISTS idx_email_providers_is_active ON email_providers(is_active);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracking_pixels_campaign_opened ON tracking_pixels(campaign_id, opened);
CREATE INDEX IF NOT EXISTS idx_click_tracking_campaign_clicked ON click_tracking(campaign_id, clicked);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_type_timestamp ON email_events(campaign_id, type, timestamp);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled ON email_queue(status, scheduled_at);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_messages_updated_at BEFORE UPDATE ON email_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_queue_updated_at BEFORE UPDATE ON email_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_providers_updated_at BEFORE UPDATE ON email_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common analytics queries

-- Campaign performance view
CREATE OR REPLACE VIEW campaign_performance AS
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  COUNT(es.id) as total_sent,
  COUNT(CASE WHEN es.success THEN 1 END) as total_delivered,
  COUNT(CASE WHEN tp.opened THEN 1 END) as total_opened,
  COUNT(CASE WHEN ct.clicked THEN 1 END) as total_clicked,
  COUNT(CASE WHEN ee.type = 'bounced' THEN 1 END) as total_bounced,
  COUNT(CASE WHEN ee.type = 'unsubscribed' THEN 1 END) as total_unsubscribed,
  COUNT(CASE WHEN ee.type = 'replied' THEN 1 END) as total_replied,
  
  -- Calculate rates
  CASE WHEN COUNT(es.id) > 0 THEN 
    ROUND(COUNT(CASE WHEN es.success THEN 1 END)::DECIMAL / COUNT(es.id) * 100, 2)
  ELSE 0 END as delivery_rate,
  
  CASE WHEN COUNT(CASE WHEN es.success THEN 1 END) > 0 THEN 
    ROUND(COUNT(CASE WHEN tp.opened THEN 1 END)::DECIMAL / COUNT(CASE WHEN es.success THEN 1 END) * 100, 2)
  ELSE 0 END as open_rate,
  
  CASE WHEN COUNT(CASE WHEN es.success THEN 1 END) > 0 THEN 
    ROUND(COUNT(CASE WHEN ct.clicked THEN 1 END)::DECIMAL / COUNT(CASE WHEN es.success THEN 1 END) * 100, 2)
  ELSE 0 END as click_rate,
  
  CASE WHEN COUNT(es.id) > 0 THEN 
    ROUND(COUNT(CASE WHEN ee.type = 'bounced' THEN 1 END)::DECIMAL / COUNT(es.id) * 100, 2)
  ELSE 0 END as bounce_rate

FROM campaigns c
LEFT JOIN email_sends es ON c.id = es.campaign_id
LEFT JOIN tracking_pixels tp ON es.message_id = tp.message_id
LEFT JOIN click_tracking ct ON es.message_id = ct.message_id
LEFT JOIN email_events ee ON es.message_id = ee.message_id
GROUP BY c.id, c.name;

-- Daily email statistics view
CREATE OR REPLACE VIEW daily_email_stats AS
SELECT 
  DATE(es.created_at) as date,
  COUNT(es.id) as total_sent,
  COUNT(CASE WHEN es.success THEN 1 END) as total_delivered,
  COUNT(CASE WHEN tp.opened THEN 1 END) as total_opened,
  COUNT(CASE WHEN ct.clicked THEN 1 END) as total_clicked,
  COUNT(CASE WHEN ee.type = 'bounced' THEN 1 END) as total_bounced,
  COUNT(CASE WHEN ee.type = 'unsubscribed' THEN 1 END) as total_unsubscribed,
  COUNT(CASE WHEN ee.type = 'replied' THEN 1 END) as total_replied,
  
  -- Calculate rates
  CASE WHEN COUNT(es.id) > 0 THEN 
    ROUND(COUNT(CASE WHEN es.success THEN 1 END)::DECIMAL / COUNT(es.id) * 100, 2)
  ELSE 0 END as delivery_rate,
  
  CASE WHEN COUNT(CASE WHEN es.success THEN 1 END) > 0 THEN 
    ROUND(COUNT(CASE WHEN tp.opened THEN 1 END)::DECIMAL / COUNT(CASE WHEN es.success THEN 1 END) * 100, 2)
  ELSE 0 END as open_rate,
  
  CASE WHEN COUNT(CASE WHEN es.success THEN 1 END) > 0 THEN 
    ROUND(COUNT(CASE WHEN ct.clicked THEN 1 END)::DECIMAL / COUNT(CASE WHEN es.success THEN 1 END) * 100, 2)
  ELSE 0 END as click_rate

FROM email_sends es
LEFT JOIN tracking_pixels tp ON es.message_id = tp.message_id
LEFT JOIN click_tracking ct ON es.message_id = ct.message_id
LEFT JOIN email_events ee ON es.message_id = ee.message_id
GROUP BY DATE(es.created_at)
ORDER BY date DESC;

-- Contact engagement view
CREATE OR REPLACE VIEW contact_engagement AS
SELECT 
  c.id as contact_id,
  c.email,
  c.first_name,
  c.last_name,
  COUNT(es.id) as emails_received,
  COUNT(CASE WHEN tp.opened THEN 1 END) as emails_opened,
  COUNT(CASE WHEN ct.clicked THEN 1 END) as emails_clicked,
  COUNT(CASE WHEN ee.type = 'replied' THEN 1 END) as emails_replied,
  
  -- Engagement score (0-100)
  CASE WHEN COUNT(es.id) > 0 THEN 
    ROUND((
      COUNT(CASE WHEN tp.opened THEN 1 END) * 30 +
      COUNT(CASE WHEN ct.clicked THEN 1 END) * 40 +
      COUNT(CASE WHEN ee.type = 'replied' THEN 1 END) * 30
    )::DECIMAL / COUNT(es.id), 2)
  ELSE 0 END as engagement_score,
  
  MAX(tp.last_opened_at) as last_opened_at,
  MAX(ct.last_clicked_at) as last_clicked_at,
  MAX(CASE WHEN ee.type = 'replied' THEN ee.timestamp END) as last_replied_at

FROM contacts c
LEFT JOIN email_sends es ON c.id = es.contact_id
LEFT JOIN tracking_pixels tp ON es.message_id = tp.message_id
LEFT JOIN click_tracking ct ON es.message_id = ct.message_id
LEFT JOIN email_events ee ON es.message_id = ee.message_id
WHERE c.is_active = true
GROUP BY c.id, c.email, c.first_name, c.last_name;

-- Comments for documentation
COMMENT ON TABLE tracking_pixels IS 'Stores tracking pixel data for email open tracking';
COMMENT ON TABLE click_tracking IS 'Stores click tracking data for email link tracking';
COMMENT ON TABLE unsubscribe_tokens IS 'Stores unsubscribe tokens for email opt-out functionality';
COMMENT ON TABLE bounce_events IS 'Stores email bounce events from providers';
COMMENT ON TABLE email_events IS 'Unified log of all email events (opens, clicks, bounces, etc.)';
COMMENT ON TABLE email_sends IS 'Record of all sent emails with delivery status';
COMMENT ON TABLE email_messages IS 'Stores email message content for queue processing';
COMMENT ON TABLE email_queue IS 'Queue for delayed and retry email processing';
COMMENT ON TABLE email_providers IS 'Configuration for email sending providers';

COMMENT ON VIEW campaign_performance IS 'Aggregated performance metrics for campaigns';
COMMENT ON VIEW daily_email_stats IS 'Daily email statistics and performance metrics';
COMMENT ON VIEW contact_engagement IS 'Contact engagement scores and activity metrics';