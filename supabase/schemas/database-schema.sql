-- ColdReach Pro Database Schema
-- This file contains the complete database schema for the application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth, but we extend it)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'agency')),
  plan_limits JSONB DEFAULT '{
    "email_accounts": 1,
    "contacts": 1000,
    "emails_per_month": 2000,
    "campaigns": 5
  }',
  usage_stats JSONB DEFAULT '{
    "emails_sent_this_month": 0,
    "contacts_count": 0,
    "campaigns_count": 0,
    "email_accounts_count": 0
  }',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('gmail', 'outlook', 'smtp')),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- OAuth tokens (encrypted)
  oauth_tokens JSONB,
  
  -- SMTP configuration (encrypted)
  smtp_config JSONB,
  
  -- Account settings
  settings JSONB DEFAULT '{
    "daily_limit": 50,
    "delay_between_emails": 60,
    "warm_up_enabled": true,
    "signature": null
  }',
  
  -- Status and verification
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Domain authentication status
  domain_auth JSONB DEFAULT '{
    "spf": {"status": "unknown", "record": null, "valid": false},
    "dkim": {"status": "unknown", "record": null, "valid": false},
    "dmarc": {"status": "unknown", "record": null, "valid": false}
  }',
  
  -- Health and reputation metrics
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  reputation_data JSONB DEFAULT '{
    "bounce_rate": 0,
    "complaint_rate": 0,
    "delivery_rate": 100,
    "blacklist_status": []
  }',
  
  -- Usage tracking
  daily_sent_count INTEGER DEFAULT 0,
  monthly_sent_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Warmup tracking
  warmup_status VARCHAR(20) DEFAULT 'not_started' CHECK (warmup_status IN ('not_started', 'in_progress', 'completed', 'paused')),
  warmup_progress JSONB DEFAULT '{
    "current_day": 0,
    "target_day": 30,
    "daily_target": 5,
    "emails_sent_today": 0
  }',
  
  -- Timestamps
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic contact information
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  website VARCHAR(500),
  industry VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url VARCHAR(500),
  
  -- Custom fields for additional data
  custom_fields JSONB DEFAULT '{}',
  
  -- Organization and segmentation
  tags TEXT[] DEFAULT '{}',
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'deleted')),
  email_status VARCHAR(20) DEFAULT 'unknown' CHECK (email_status IN ('valid', 'invalid', 'risky', 'unknown')),
  
  -- Engagement tracking
  last_contacted TIMESTAMP WITH TIME ZONE,
  last_opened TIMESTAMP WITH TIME ZONE,
  last_clicked TIMESTAMP WITH TIME ZONE,
  last_replied TIMESTAMP WITH TIME ZONE,
  
  -- Campaign interaction counts
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI templates table
CREATE TABLE IF NOT EXISTS ai_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Template metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'custom' CHECK (category IN ('cold_outreach', 'follow_up', 'introduction', 'meeting_request', 'custom')),
  
  -- Template content
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  custom_prompt TEXT,
  
  -- Usage and status
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI personalizations table (stores personalization results)
CREATE TABLE IF NOT EXISTS ai_personalizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES ai_templates(id) ON DELETE SET NULL,
  
  -- Content
  original_content TEXT NOT NULL,
  personalized_content TEXT NOT NULL,
  
  -- AI processing details
  ai_provider VARCHAR(50) NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  processing_time INTEGER DEFAULT 0, -- milliseconds
  
  -- Variables used
  variables_used JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outreach agents master table
CREATE TABLE IF NOT EXISTS outreach_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  purpose TEXT,
  tone VARCHAR(50) DEFAULT 'friendly',
  last_used_at TIMESTAMP WITH TIME ZONE,
  sender_name VARCHAR(255),
  sender_role VARCHAR(255),
  company_name VARCHAR(255),
  product_one_liner TEXT,
  product_description TEXT,
  unique_selling_points TEXT[] DEFAULT '{}',
  target_persona TEXT,
  conversation_goal VARCHAR(255),
  preferred_cta VARCHAR(255),
  follow_up_strategy VARCHAR(255),
  knowledge_summary JSONB DEFAULT '{}',
  segment_config JSONB DEFAULT '{}',
  quality_weights JSONB DEFAULT '{}',
  custom_prompt TEXT,
  prompt_override TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_agents_user_id_idx ON outreach_agents(user_id);
CREATE INDEX IF NOT EXISTS outreach_agents_status_idx ON outreach_agents(status);

-- Knowledge entries linked to outreach agents
CREATE TABLE IF NOT EXISTS outreach_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pdf', 'doc', 'text', 'link', 'html')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT,
  storage_path TEXT,
  embedding_status VARCHAR(20) DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'ready', 'failed')),
  embedding_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_agent_knowledge_agent_idx ON outreach_agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS outreach_agent_knowledge_user_idx ON outreach_agent_knowledge(user_id);

-- Stored scoring runs for agent contact evaluation
CREATE TABLE IF NOT EXISTS agent_contact_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  reasons JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_contact_scores_unique_idx ON agent_contact_scores(agent_id, contact_id, run_id);
CREATE INDEX IF NOT EXISTS agent_contact_scores_agent_idx ON agent_contact_scores(agent_id);
CREATE INDEX IF NOT EXISTS agent_contact_scores_run_idx ON agent_contact_scores(run_id);

-- Tracks active contacts assigned to an agent's smart segment
CREATE TABLE IF NOT EXISTS agent_segment_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'selected' CHECK (status IN ('selected', 'excluded', 'sent', 'failed')),
  score NUMERIC(5,2),
  reasons JSONB DEFAULT '[]',
  run_id UUID,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  removed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_segment_members_unique_idx ON agent_segment_members(agent_id, contact_id);
CREATE INDEX IF NOT EXISTS agent_segment_members_status_idx ON agent_segment_members(status);
CREATE INDEX IF NOT EXISTS agent_segment_members_run_idx ON agent_segment_members(run_id);

-- Maintain outreach agent timestamps
CREATE OR REPLACE FUNCTION touch_outreach_agents()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_outreach_agents ON outreach_agents;
CREATE TRIGGER trg_touch_outreach_agents
BEFORE UPDATE ON outreach_agents
FOR EACH ROW
EXECUTE FUNCTION touch_outreach_agents();

-- Update knowledge summary counters when knowledge entries change
CREATE OR REPLACE FUNCTION update_outreach_agent_knowledge_summary()
RETURNS TRIGGER AS $$
DECLARE
  knowledge_counts JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'ready', COUNT(*) FILTER (WHERE embedding_status = 'ready'),
    'pending', COUNT(*) FILTER (WHERE embedding_status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE embedding_status = 'processing'),
    'failed', COUNT(*) FILTER (WHERE embedding_status = 'failed')
  ) INTO knowledge_counts
  FROM outreach_agent_knowledge
  WHERE agent_id = COALESCE(NEW.agent_id, OLD.agent_id);

  UPDATE outreach_agents
  SET knowledge_summary = COALESCE(knowledge_counts, '{}')::jsonb,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.agent_id, OLD.agent_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_insert ON outreach_agent_knowledge;
DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_update ON outreach_agent_knowledge;
DROP TRIGGER IF EXISTS trg_update_agent_knowledge_summary_delete ON outreach_agent_knowledge;

CREATE TRIGGER trg_update_agent_knowledge_summary_insert
AFTER INSERT ON outreach_agent_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_outreach_agent_knowledge_summary();

CREATE TRIGGER trg_update_agent_knowledge_summary_update
AFTER UPDATE ON outreach_agent_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_outreach_agent_knowledge_summary();

CREATE TRIGGER trg_update_agent_knowledge_summary_delete
AFTER DELETE ON outreach_agent_knowledge
FOR EACH ROW
EXECUTE FUNCTION update_outreach_agent_knowledge_summary();

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Campaign metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Campaign configuration
  sequence_data JSONB NOT NULL DEFAULT '{"emails": []}',
  ai_settings JSONB DEFAULT '{
    "enabled": false,
    "template_id": null,
    "custom_prompt": null
  }',
  
  -- Scheduling settings
  schedule_settings JSONB DEFAULT '{
    "timezone": "UTC",
    "business_hours": {"start": "09:00", "end": "17:00"},
    "working_days": [1, 2, 3, 4, 5],
    "respect_recipient_timezone": true
  }',
  
  -- Targeting settings
  targeting_settings JSONB DEFAULT '{
    "contact_segments": [],
    "exclude_replied": true,
    "exclude_unsubscribed": true
  }',
  
  -- A/B testing configuration
  ab_test_config JSONB DEFAULT '{
    "enabled": false,
    "test_type": "subject",
    "variants": [],
    "traffic_split": 50,
    "winner_criteria": "open_rate"
  }',
  
  -- Campaign status and metrics
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  
  -- Performance metrics
  stats JSONB DEFAULT '{
    "total_sent": 0,
    "total_delivered": 0,
    "total_opened": 0,
    "total_clicked": 0,
    "total_replied": 0,
    "total_bounced": 0,
    "total_unsubscribed": 0
  }',
  
  -- Execution tracking
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  next_execution_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign contacts table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  
  -- Sequence progress
  current_step INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'paused', 'stopped')),
  
  -- Personalized content for this contact
  personalized_emails JSONB DEFAULT '[]',
  
  -- Execution tracking
  next_send_at TIMESTAMP WITH TIME ZONE,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Engagement tracking
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  
  -- A/B test variant assignment
  ab_variant VARCHAR(10),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(campaign_id, contact_id)
);

-- Email sends table (tracks individual email sends)
CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  
  -- Email details
  subject VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  step_number INTEGER DEFAULT 1,
  
  -- Sending details
  message_id VARCHAR(255), -- Provider message ID
  send_status VARCHAR(20) DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
  
  -- Tracking data
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking metadata
  tracking_data JSONB DEFAULT '{}',
  
  -- Error information
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- A/B test information
  ab_variant VARCHAR(10),
  
  -- Timestamps
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warmup emails table (tracks warmup email sends)
CREATE TABLE IF NOT EXISTS warmup_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  
  -- Warmup details
  warmup_day INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  sent_count INTEGER DEFAULT 0,
  
  -- Email details
  subject VARCHAR(500),
  content TEXT,
  recipient_email VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'replied', 'failed')),
  
  -- Tracking
  message_id VARCHAR(255),
  opened_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unsubscribes table
CREATE TABLE IF NOT EXISTS unsubscribes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Unsubscribe details
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(500),
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, contact_id)
);

-- Webhooks table (for email provider webhooks)
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Webhook details
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  message_id VARCHAR(255),
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_email_accounts_is_active ON email_accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_templates_user_id ON ai_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_templates_category ON ai_templates(category);
CREATE INDEX IF NOT EXISTS idx_ai_templates_is_default ON ai_templates(is_default);

CREATE INDEX IF NOT EXISTS idx_ai_personalizations_user_id ON ai_personalizations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_personalizations_contact_id ON ai_personalizations(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_personalizations_template_id ON ai_personalizations(template_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact_id ON campaign_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_next_send_at ON campaign_contacts(next_send_at);

CREATE INDEX IF NOT EXISTS idx_email_sends_user_id ON email_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_contact_id ON email_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_email_account_id ON email_sends(email_account_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_send_status ON email_sends(send_status);
CREATE INDEX IF NOT EXISTS idx_email_sends_scheduled_at ON email_sends(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_sends_message_id ON email_sends(message_id);

CREATE INDEX IF NOT EXISTS idx_warmup_emails_email_account_id ON warmup_emails(email_account_id);
CREATE INDEX IF NOT EXISTS idx_warmup_emails_status ON warmup_emails(status);
CREATE INDEX IF NOT EXISTS idx_warmup_emails_scheduled_at ON warmup_emails(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_unsubscribes_user_id ON unsubscribes(user_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_contact_id ON unsubscribes(contact_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON unsubscribes(email);

CREATE INDEX IF NOT EXISTS idx_webhooks_provider ON webhooks(provider);
CREATE INDEX IF NOT EXISTS idx_webhooks_event_type ON webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_message_id ON webhooks(message_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_processed ON webhooks(processed);

-- Notifications table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'enrichment_started',
    'enrichment_completed',
    'enrichment_failed',
    'campaign_completed',
    'general'
  )),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_templates_updated_at BEFORE UPDATE ON ai_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaign_contacts_updated_at BEFORE UPDATE ON campaign_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_sends_updated_at BEFORE UPDATE ON email_sends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
