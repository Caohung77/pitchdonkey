-- Rate Limiting and Distribution Database Schema

-- Rate limit configurations for email accounts
CREATE TABLE rate_limit_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  hourly_limit INTEGER NOT NULL DEFAULT 10,
  domain_daily_limit INTEGER NOT NULL DEFAULT 10,
  warmup_mode BOOLEAN NOT NULL DEFAULT false,
  warmup_daily_limit INTEGER,
  burst_limit INTEGER NOT NULL DEFAULT 5,
  cooldown_period_minutes INTEGER NOT NULL DEFAULT 10,
  retry_config JSONB NOT NULL DEFAULT '{
    "max_attempts": 3,
    "backoff_strategy": "exponential",
    "base_delay_ms": 5000,
    "max_delay_ms": 300000,
    "retryable_errors": ["RATE_LIMIT_EXCEEDED", "TEMPORARY_FAILURE", "CONNECTION_ERROR", "TIMEOUT", "SERVER_ERROR"],
    "jitter": true
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(email_account_id),
  
  -- Constraints
  CONSTRAINT valid_daily_limit CHECK (daily_limit > 0 AND daily_limit <= 1000),
  CONSTRAINT valid_hourly_limit CHECK (hourly_limit > 0 AND hourly_limit <= 100),
  CONSTRAINT valid_domain_limit CHECK (domain_daily_limit > 0 AND domain_daily_limit <= 50),
  CONSTRAINT valid_burst_limit CHECK (burst_limit > 0 AND burst_limit <= 20),
  CONSTRAINT valid_cooldown CHECK (cooldown_period_minutes > 0 AND cooldown_period_minutes <= 60),
  CONSTRAINT valid_warmup_limit CHECK (warmup_daily_limit IS NULL OR (warmup_daily_limit > 0 AND warmup_daily_limit <= daily_limit))
);

-- Usage tracking for rate limiting
CREATE TABLE rate_limit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  emails_sent INTEGER NOT NULL DEFAULT 0,
  domains_targeted JSONB NOT NULL DEFAULT '{}', -- domain -> count mapping
  last_send_at TIMESTAMP WITH TIME ZONE,
  burst_count INTEGER NOT NULL DEFAULT 0,
  burst_window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(email_account_id, date, hour)
);

-- Send requests for tracking and retry logic
CREATE TABLE send_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_domain VARCHAR(255) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Send attempt logs for monitoring and analytics
CREATE TABLE send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  send_request_id UUID REFERENCES send_requests(id) ON DELETE SET NULL,
  recipient_domain VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  error_code VARCHAR(50),
  response_time_ms INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'
);

-- Account performance metrics for adaptive rate limiting
CREATE TABLE account_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  emails_delivered INTEGER NOT NULL DEFAULT 0,
  emails_bounced INTEGER NOT NULL DEFAULT 0,
  emails_opened INTEGER NOT NULL DEFAULT 0,
  emails_clicked INTEGER NOT NULL DEFAULT 0,
  emails_replied INTEGER NOT NULL DEFAULT 0,
  spam_complaints INTEGER NOT NULL DEFAULT 0,
  unsubscribes INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated rates
  delivery_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN emails_sent > 0 THEN emails_delivered::DECIMAL / emails_sent ELSE 0 END
  ) STORED,
  bounce_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN emails_sent > 0 THEN emails_bounced::DECIMAL / emails_sent ELSE 0 END
  ) STORED,
  open_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN emails_delivered > 0 THEN emails_opened::DECIMAL / emails_delivered ELSE 0 END
  ) STORED,
  click_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN emails_delivered > 0 THEN emails_clicked::DECIMAL / emails_delivered ELSE 0 END
  ) STORED,
  reply_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN emails_delivered > 0 THEN emails_replied::DECIMAL / emails_delivered ELSE 0 END
  ) STORED,
  spam_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN emails_sent > 0 THEN spam_complaints::DECIMAL / emails_sent ELSE 0 END
  ) STORED,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(email_account_id, date)
);

-- Domain reputation tracking
CREATE TABLE domain_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL,
  reputation_score INTEGER NOT NULL DEFAULT 50 CHECK (reputation_score >= 0 AND reputation_score <= 100),
  risk_level VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  recommended_daily_limit INTEGER NOT NULL DEFAULT 10,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metrics
  total_sends INTEGER NOT NULL DEFAULT 0,
  bounce_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  spam_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  delivery_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  blacklist_sources TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(domain)
);

-- Indexes for performance
CREATE INDEX idx_rate_limit_configs_email_account ON rate_limit_configs(email_account_id);
CREATE INDEX idx_rate_limit_configs_user ON rate_limit_configs(user_id);

CREATE INDEX idx_rate_limit_usage_account_date ON rate_limit_usage(email_account_id, date);
CREATE INDEX idx_rate_limit_usage_date_hour ON rate_limit_usage(date, hour);
CREATE INDEX idx_rate_limit_usage_last_send ON rate_limit_usage(last_send_at);

CREATE INDEX idx_send_requests_status_scheduled ON send_requests(status, scheduled_at);
CREATE INDEX idx_send_requests_account_status ON send_requests(email_account_id, status);
CREATE INDEX idx_send_requests_user_campaign ON send_requests(user_id, campaign_id);
CREATE INDEX idx_send_requests_retry ON send_requests(retry_count, max_retries);

CREATE INDEX idx_send_logs_account_timestamp ON send_logs(email_account_id, timestamp);
CREATE INDEX idx_send_logs_domain_success ON send_logs(recipient_domain, success);
CREATE INDEX idx_send_logs_timestamp ON send_logs(timestamp);

CREATE INDEX idx_account_metrics_account_date ON account_performance_metrics(email_account_id, date);
CREATE INDEX idx_account_metrics_date ON account_performance_metrics(date);
CREATE INDEX idx_account_metrics_delivery_rate ON account_performance_metrics(delivery_rate);
CREATE INDEX idx_account_metrics_bounce_rate ON account_performance_metrics(bounce_rate);

CREATE INDEX idx_domain_reputation_domain ON domain_reputation(domain);
CREATE INDEX idx_domain_reputation_risk ON domain_reputation(risk_level);
CREATE INDEX idx_domain_reputation_score ON domain_reputation(reputation_score);

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_rate_limit_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update burst count and window
  IF NEW.burst_count > OLD.burst_count THEN
    -- Check if we need to reset burst window (10 minutes)
    IF NEW.burst_window_start < NOW() - INTERVAL '10 minutes' THEN
      NEW.burst_count := 1;
      NEW.burst_window_start := NOW();
    END IF;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rate_limit_usage
  BEFORE UPDATE ON rate_limit_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_limit_usage();

-- Function to automatically create default rate limit config
CREATE OR REPLACE FUNCTION create_default_rate_limit_config()
RETURNS TRIGGER AS $$
DECLARE
  account_age INTEGER;
  warmup_status VARCHAR(50);
  daily_limit INTEGER := 25;
  hourly_limit INTEGER := 5;
  domain_limit INTEGER := 3;
  is_warmup BOOLEAN := true;
BEGIN
  -- Get account info
  SELECT 
    EXTRACT(DAY FROM NOW() - created_at)::INTEGER,
    COALESCE(NEW.warmup_status, 'pending')
  INTO account_age, warmup_status
  FROM email_accounts 
  WHERE id = NEW.id;
  
  -- Determine limits based on account age and warmup status
  IF warmup_status = 'completed' AND account_age > 30 THEN
    daily_limit := 50;
    hourly_limit := 12;
    domain_limit := 10;
    is_warmup := false;
  ELSIF warmup_status = 'in_progress' OR account_age > 7 THEN
    daily_limit := 40;
    hourly_limit := 8;
    domain_limit := 5;
    is_warmup := true;
  END IF;
  
  -- Create default config
  INSERT INTO rate_limit_configs (
    user_id,
    email_account_id,
    daily_limit,
    hourly_limit,
    domain_daily_limit,
    warmup_mode,
    warmup_daily_limit
  ) VALUES (
    NEW.user_id,
    NEW.id,
    daily_limit,
    hourly_limit,
    domain_limit,
    is_warmup,
    CASE WHEN is_warmup THEN LEAST(daily_limit, 30) ELSE NULL END
  ) ON CONFLICT (email_account_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_rate_limit_config
  AFTER INSERT ON email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION create_default_rate_limit_config();

-- Function to update account performance metrics
CREATE OR REPLACE FUNCTION update_account_performance_metrics(
  p_email_account_id UUID,
  p_date DATE,
  p_event_type VARCHAR(50),
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO account_performance_metrics (
    email_account_id,
    date,
    emails_sent,
    emails_delivered,
    emails_bounced,
    emails_opened,
    emails_clicked,
    emails_replied,
    spam_complaints,
    unsubscribes
  ) VALUES (
    p_email_account_id,
    p_date,
    CASE WHEN p_event_type = 'sent' THEN p_increment ELSE 0 END,
    CASE WHEN p_event_type = 'delivered' THEN p_increment ELSE 0 END,
    CASE WHEN p_event_type = 'bounced' THEN p_increment ELSE 0 END,
    CASE WHEN p_event_type = 'opened' THEN p_increment ELSE 0 END,
    CASE WHEN p_event_type = 'clicked' THEN p_increment ELSE 0 END,
    CASE WHEN p_event_type = 'replied' THEN p_increment ELSE 0 END,
    CASE WHEN p_event_type = 'spam_complaint' THEN p_increment ELSE 0 END,
    CASE WHEN p_event_type = 'unsubscribed' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (email_account_id, date)
  DO UPDATE SET
    emails_sent = account_performance_metrics.emails_sent + 
      CASE WHEN p_event_type = 'sent' THEN p_increment ELSE 0 END,
    emails_delivered = account_performance_metrics.emails_delivered + 
      CASE WHEN p_event_type = 'delivered' THEN p_increment ELSE 0 END,
    emails_bounced = account_performance_metrics.emails_bounced + 
      CASE WHEN p_event_type = 'bounced' THEN p_increment ELSE 0 END,
    emails_opened = account_performance_metrics.emails_opened + 
      CASE WHEN p_event_type = 'opened' THEN p_increment ELSE 0 END,
    emails_clicked = account_performance_metrics.emails_clicked + 
      CASE WHEN p_event_type = 'clicked' THEN p_increment ELSE 0 END,
    emails_replied = account_performance_metrics.emails_replied + 
      CASE WHEN p_event_type = 'replied' THEN p_increment ELSE 0 END,
    spam_complaints = account_performance_metrics.spam_complaints + 
      CASE WHEN p_event_type = 'spam_complaint' THEN p_increment ELSE 0 END,
    unsubscribes = account_performance_metrics.unsubscribes + 
      CASE WHEN p_event_type = 'unsubscribed' THEN p_increment ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Views for common queries
CREATE VIEW rate_limit_status AS
SELECT 
  rlc.email_account_id,
  ea.email,
  ea.user_id,
  rlc.daily_limit,
  rlc.hourly_limit,
  rlc.domain_daily_limit,
  rlc.warmup_mode,
  rlc.warmup_daily_limit,
  COALESCE(rlu_daily.emails_sent, 0) as daily_sent,
  COALESCE(rlu_hourly.emails_sent, 0) as hourly_sent,
  rlc.daily_limit - COALESCE(rlu_daily.emails_sent, 0) as daily_remaining,
  rlc.hourly_limit - COALESCE(rlu_hourly.emails_sent, 0) as hourly_remaining,
  CASE 
    WHEN rlc.daily_limit - COALESCE(rlu_daily.emails_sent, 0) > 0 
     AND rlc.hourly_limit - COALESCE(rlu_hourly.emails_sent, 0) > 0 
    THEN true 
    ELSE false 
  END as can_send
FROM rate_limit_configs rlc
JOIN email_accounts ea ON ea.id = rlc.email_account_id
LEFT JOIN (
  SELECT email_account_id, SUM(emails_sent) as emails_sent
  FROM rate_limit_usage 
  WHERE date = CURRENT_DATE
  GROUP BY email_account_id
) rlu_daily ON rlu_daily.email_account_id = rlc.email_account_id
LEFT JOIN (
  SELECT email_account_id, emails_sent
  FROM rate_limit_usage 
  WHERE date = CURRENT_DATE AND hour = EXTRACT(HOUR FROM NOW())
) rlu_hourly ON rlu_hourly.email_account_id = rlc.email_account_id;

-- View for account performance summary
CREATE VIEW account_performance_summary AS
SELECT 
  apm.email_account_id,
  ea.email,
  ea.user_id,
  AVG(apm.delivery_rate) as avg_delivery_rate,
  AVG(apm.bounce_rate) as avg_bounce_rate,
  AVG(apm.open_rate) as avg_open_rate,
  AVG(apm.click_rate) as avg_click_rate,
  AVG(apm.reply_rate) as avg_reply_rate,
  AVG(apm.spam_rate) as avg_spam_rate,
  SUM(apm.emails_sent) as total_emails_sent,
  COUNT(*) as days_active,
  MAX(apm.date) as last_activity_date
FROM account_performance_metrics apm
JOIN email_accounts ea ON ea.id = apm.email_account_id
WHERE apm.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY apm.email_account_id, ea.email, ea.user_id;

-- Cleanup old data (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_data()
RETURNS VOID AS $$
BEGIN
  -- Keep usage data for 90 days
  DELETE FROM rate_limit_usage 
  WHERE date < CURRENT_DATE - INTERVAL '90 days';
  
  -- Keep send logs for 30 days
  DELETE FROM send_logs 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Keep completed send requests for 7 days
  DELETE FROM send_requests 
  WHERE status IN ('sent', 'failed', 'cancelled') 
    AND updated_at < NOW() - INTERVAL '7 days';
  
  -- Keep performance metrics for 1 year
  DELETE FROM account_performance_metrics 
  WHERE date < CURRENT_DATE - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;