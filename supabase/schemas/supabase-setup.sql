-- ColdReach Pro Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email accounts table
CREATE TABLE public.email_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'smtp')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'suspended')),
  
  -- OAuth tokens (encrypted)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- SMTP settings (encrypted)
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  
  -- IMAP settings (encrypted)
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_secure BOOLEAN DEFAULT true,
  
  -- Domain authentication
  domain TEXT,
  dkim_verified BOOLEAN DEFAULT false,
  spf_verified BOOLEAN DEFAULT false,
  dmarc_verified BOOLEAN DEFAULT false,
  
  -- Warmup settings
  warmup_enabled BOOLEAN DEFAULT false,
  warmup_stage TEXT DEFAULT 'not_started' CHECK (warmup_stage IN ('not_started', 'stage_1', 'stage_2', 'stage_3', 'completed')),
  daily_send_limit INTEGER DEFAULT 50,
  current_daily_sent INTEGER DEFAULT 0,
  
  -- Reputation tracking
  reputation_score DECIMAL(5,2) DEFAULT 100.00,
  bounce_rate DECIMAL(5,4) DEFAULT 0.0000,
  complaint_rate DECIMAL(5,4) DEFAULT 0.0000,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  position TEXT,
  phone TEXT,
  website TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  
  -- Location data
  country TEXT,
  city TEXT,
  timezone TEXT,
  
  -- Custom fields (JSONB for flexibility)
  custom_fields JSONB DEFAULT '{}',
  
  -- Segmentation
  tags TEXT[] DEFAULT '{}',
  segments TEXT[] DEFAULT '{}',
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
  unsubscribed_at TIMESTAMPTZ,
  
  -- Engagement tracking
  last_contacted_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  last_replied_at TIMESTAMPTZ,
  
  -- AI personalization data
  ai_research_data JSONB DEFAULT '{}',
  ai_personalization_score DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, email)
);

-- Contact segments table
CREATE TABLE public.contact_segments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL, -- Segment rules
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'archived')),
  
  -- Campaign settings
  from_email_account_id UUID REFERENCES public.email_accounts(id),
  reply_to_email TEXT,
  
  -- Scheduling
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  
  -- Send settings
  daily_send_limit INTEGER DEFAULT 50,
  send_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Monday to Friday
  send_time_start TIME DEFAULT '09:00',
  send_time_end TIME DEFAULT '17:00',
  
  -- Tracking
  track_opens BOOLEAN DEFAULT true,
  track_clicks BOOLEAN DEFAULT true,
  track_replies BOOLEAN DEFAULT true,
  
  -- A/B Testing
  ab_test_enabled BOOLEAN DEFAULT false,
  ab_test_config JSONB,
  
  -- Statistics
  total_contacts INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  emails_complained INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign sequences (email templates in a sequence)
CREATE TABLE public.campaign_sequences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  
  -- Email content
  subject_line TEXT NOT NULL,
  email_body TEXT NOT NULL,
  email_type TEXT DEFAULT 'html' CHECK (email_type IN ('html', 'text')),
  
  -- Timing
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  
  -- Conditions
  send_conditions JSONB DEFAULT '{}',
  
  -- A/B Testing variants
  is_ab_test BOOLEAN DEFAULT false,
  ab_test_percentage DECIMAL(5,2) DEFAULT 50.00,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign contacts (many-to-many relationship)
CREATE TABLE public.campaign_contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'unsubscribed')),
  current_sequence INTEGER DEFAULT 1,
  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Personalization
  personalized_subject TEXT,
  personalized_body TEXT,
  ai_personalization_used BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, contact_id)
);

-- Email tracking table
CREATE TABLE public.email_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES public.campaign_sequences(id) ON DELETE CASCADE,
  
  -- Email identifiers
  message_id TEXT UNIQUE NOT NULL,
  thread_id TEXT,
  
  -- Tracking data
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  
  -- Bounce/complaint details
  bounce_reason TEXT,
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
  
  -- Email content
  subject_line TEXT,
  email_body TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI templates table
CREATE TABLE public.ai_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  
  -- Template content
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  -- AI settings
  ai_provider TEXT DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'anthropic')),
  ai_model TEXT DEFAULT 'gpt-4',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,4) DEFAULT 0.0000,
  
  -- Template variables
  variables JSONB DEFAULT '[]',
  
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE public.usage_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('email_sent', 'ai_personalization', 'contact_import', 'campaign_created')),
  resource_id UUID,
  quantity INTEGER DEFAULT 1,
  cost_credits INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription limits table
CREATE TABLE public.subscription_limits (
  tier TEXT PRIMARY KEY CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
  monthly_emails INTEGER NOT NULL,
  monthly_ai_personalizations INTEGER NOT NULL,
  max_email_accounts INTEGER NOT NULL,
  max_contacts INTEGER NOT NULL,
  max_campaigns INTEGER NOT NULL,
  features JSONB DEFAULT '{}'
);

-- Insert default subscription limits
INSERT INTO public.subscription_limits (tier, monthly_emails, monthly_ai_personalizations, max_email_accounts, max_contacts, max_campaigns, features) VALUES
('free', 100, 10, 1, 1000, 3, '{"warmup": false, "ab_testing": false, "advanced_analytics": false}'),
('starter', 1000, 100, 3, 10000, 10, '{"warmup": true, "ab_testing": false, "advanced_analytics": false}'),
('professional', 5000, 500, 10, 50000, 50, '{"warmup": true, "ab_testing": true, "advanced_analytics": true}'),
('enterprise', -1, -1, -1, -1, -1, '{"warmup": true, "ab_testing": true, "advanced_analytics": true, "priority_support": true}');

-- Create indexes for better performance
CREATE INDEX idx_email_accounts_user_id ON public.email_accounts(user_id);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_status ON public.contacts(status);
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaign_contacts_campaign_id ON public.campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_contact_id ON public.campaign_contacts(contact_id);
CREATE INDEX idx_email_tracking_user_id ON public.email_tracking(user_id);
CREATE INDEX idx_email_tracking_campaign_id ON public.email_tracking(campaign_id);
CREATE INDEX idx_email_tracking_message_id ON public.email_tracking(message_id);
CREATE INDEX idx_usage_tracking_user_id ON public.usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_created_at ON public.usage_tracking(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Email accounts policies
CREATE POLICY "Users can view own email accounts" ON public.email_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email accounts" ON public.email_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email accounts" ON public.email_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email accounts" ON public.email_accounts FOR DELETE USING (auth.uid() = user_id);

-- Contacts policies
CREATE POLICY "Users can view own contacts" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

-- Contact segments policies
CREATE POLICY "Users can view own contact segments" ON public.contact_segments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contact segments" ON public.contact_segments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contact segments" ON public.contact_segments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contact segments" ON public.contact_segments FOR DELETE USING (auth.uid() = user_id);

-- Campaigns policies
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- Campaign sequences policies
CREATE POLICY "Users can view own campaign sequences" ON public.campaign_sequences FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));
CREATE POLICY "Users can insert own campaign sequences" ON public.campaign_sequences FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));
CREATE POLICY "Users can update own campaign sequences" ON public.campaign_sequences FOR UPDATE USING (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));
CREATE POLICY "Users can delete own campaign sequences" ON public.campaign_sequences FOR DELETE USING (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));

-- Campaign contacts policies
CREATE POLICY "Users can view own campaign contacts" ON public.campaign_contacts FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));
CREATE POLICY "Users can insert own campaign contacts" ON public.campaign_contacts FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));
CREATE POLICY "Users can update own campaign contacts" ON public.campaign_contacts FOR UPDATE USING (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));
CREATE POLICY "Users can delete own campaign contacts" ON public.campaign_contacts FOR DELETE USING (auth.uid() = (SELECT user_id FROM public.campaigns WHERE id = campaign_id));

-- Email tracking policies
CREATE POLICY "Users can view own email tracking" ON public.email_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email tracking" ON public.email_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email tracking" ON public.email_tracking FOR UPDATE USING (auth.uid() = user_id);

-- AI templates policies
CREATE POLICY "Users can view own and public AI templates" ON public.ai_templates FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can insert own AI templates" ON public.ai_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own AI templates" ON public.ai_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own AI templates" ON public.ai_templates FOR DELETE USING (auth.uid() = user_id);

-- Usage tracking policies
CREATE POLICY "Users can view own usage tracking" ON public.usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage tracking" ON public.usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON public.email_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contact_segments_updated_at BEFORE UPDATE ON public.contact_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaign_sequences_updated_at BEFORE UPDATE ON public.campaign_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaign_contacts_updated_at BEFORE UPDATE ON public.campaign_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_templates_updated_at BEFORE UPDATE ON public.ai_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;-- Additional trigger to ensure engagement counts stay synchronized
CREATE OR REPLACE FUNCTION refresh_contact_engagement_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE contacts
  SET
    engagement_sent_count = (
      SELECT COUNT(*)
      FROM email_tracking et
      WHERE et.contact_id = NEW.contact_id
        AND (et.sent_at IS NOT NULL OR et.delivered_at IS NOT NULL OR et.status IN ('sent','delivered','opened','clicked','replied'))
    ),
    engagement_open_count = (
      SELECT COUNT(*)
      FROM email_tracking et
      WHERE et.contact_id = NEW.contact_id
        AND et.opened_at IS NOT NULL
    ),
    engagement_click_count = (
      SELECT COUNT(*)
      FROM email_tracking et
      WHERE et.contact_id = NEW.contact_id
        AND et.clicked_at IS NOT NULL
    ),
    engagement_reply_count = (
      SELECT COUNT(*)
      FROM email_tracking et
      WHERE et.contact_id = NEW.contact_id
        AND et.replied_at IS NOT NULL
    ),
    engagement_bounce_count = (
      SELECT COUNT(*)
      FROM email_tracking et
      WHERE et.contact_id = NEW.contact_id
        AND (et.bounced_at IS NOT NULL OR et.status = 'bounced')
    )
  WHERE id = NEW.contact_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_refresh_contact_engagement_counts ON email_tracking;
CREATE TRIGGER trigger_refresh_contact_engagement_counts
  AFTER INSERT OR UPDATE ON email_tracking
  FOR EACH ROW
  EXECUTE FUNCTION refresh_contact_engagement_counts();
