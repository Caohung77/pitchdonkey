-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  contact_list_ids UUID[] NOT NULL DEFAULT '{}',
  email_sequence JSONB NOT NULL DEFAULT '[]',
  ai_settings JSONB NOT NULL DEFAULT '{}',
  schedule_settings JSONB NOT NULL DEFAULT '{}',
  ab_test_settings JSONB,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  launched_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_contact_lists CHECK (array_length(contact_list_ids, 1) > 0),
  CONSTRAINT valid_email_sequence CHECK (jsonb_array_length(email_sequence) > 0),
  CONSTRAINT valid_status_transitions CHECK (
    (status = 'draft') OR
    (status = 'active' AND launched_at IS NOT NULL) OR
    (status = 'paused' AND launched_at IS NOT NULL) OR
    (status = 'completed' AND launched_at IS NOT NULL AND completed_at IS NOT NULL) OR
    (status = 'archived' AND archived_at IS NOT NULL)
  )
);

-- Campaign Contacts Table (tracks individual contact progress through campaigns)
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'stopped', 'bounced', 'unsubscribed')),
  last_email_sent_at TIMESTAMP WITH TIME ZONE,
  next_email_scheduled_at TIMESTAMP WITH TIME ZONE,
  reply_received_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  ab_test_variant VARCHAR(100),
  personalization_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate contacts in same campaign
  UNIQUE(campaign_id, contact_id)
);

-- Email Tracking Table (enhanced from previous schema)
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  step_number INTEGER NOT NULL,
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

-- Campaign Templates Table
CREATE TABLE IF NOT EXISTS campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('cold_outreach', 'follow_up', 'nurture', 'event', 'product_launch', 'custom')),
  industry VARCHAR(100),
  use_case VARCHAR(500) NOT NULL,
  email_sequence JSONB NOT NULL,
  default_ai_settings JSONB NOT NULL DEFAULT '{}',
  default_schedule_settings JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,4),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact Lists Table (if not already exists)
CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contact_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- Campaign Statistics View
CREATE OR REPLACE VIEW campaign_statistics AS
SELECT 
  c.id as campaign_id,
  c.user_id,
  c.name as campaign_name,
  c.status,
  c.created_at,
  c.launched_at,
  c.completed_at,
  
  -- Contact counts
  COALESCE(cc.total_contacts, 0) as total_contacts,
  COALESCE(cc.active_contacts, 0) as active_contacts,
  COALESCE(cc.completed_contacts, 0) as completed_contacts,
  COALESCE(cc.stopped_contacts, 0) as stopped_contacts,
  
  -- Email counts
  COALESCE(et.emails_sent, 0) as emails_sent,
  COALESCE(et.emails_delivered, 0) as emails_delivered,
  COALESCE(et.emails_opened, 0) as emails_opened,
  COALESCE(et.emails_clicked, 0) as emails_clicked,
  COALESCE(et.emails_replied, 0) as emails_replied,
  COALESCE(et.emails_bounced, 0) as emails_bounced,
  COALESCE(et.positive_replies, 0) as positive_replies,
  
  -- Calculated rates
  CASE 
    WHEN COALESCE(et.emails_sent, 0) > 0 
    THEN ROUND((COALESCE(et.emails_delivered, 0)::DECIMAL / et.emails_sent) * 100, 2)
    ELSE 0 
  END as delivery_rate,
  
  CASE 
    WHEN COALESCE(et.emails_delivered, 0) > 0 
    THEN ROUND((COALESCE(et.emails_opened, 0)::DECIMAL / et.emails_delivered) * 100, 2)
    ELSE 0 
  END as open_rate,
  
  CASE 
    WHEN COALESCE(et.emails_opened, 0) > 0 
    THEN ROUND((COALESCE(et.emails_clicked, 0)::DECIMAL / et.emails_opened) * 100, 2)
    ELSE 0 
  END as click_rate,
  
  CASE 
    WHEN COALESCE(et.emails_sent, 0) > 0 
    THEN ROUND((COALESCE(et.emails_replied, 0)::DECIMAL / et.emails_sent) * 100, 2)
    ELSE 0 
  END as reply_rate,
  
  CASE 
    WHEN COALESCE(et.emails_replied, 0) > 0 
    THEN ROUND((COALESCE(et.positive_replies, 0)::DECIMAL / et.emails_replied) * 100, 2)
    ELSE 0 
  END as positive_reply_rate

FROM campaigns c

LEFT JOIN (
  SELECT 
    campaign_id,
    COUNT(*) as total_contacts,
    COUNT(*) FILTER (WHERE status = 'active') as active_contacts,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_contacts,
    COUNT(*) FILTER (WHERE status = 'stopped') as stopped_contacts
  FROM campaign_contacts
  GROUP BY campaign_id
) cc ON c.id = cc.campaign_id

LEFT JOIN (
  SELECT 
    campaign_id,
    COUNT(*) FILTER (WHERE status = 'sent') as emails_sent,
    COUNT(*) FILTER (WHERE status = 'delivered') as emails_delivered,
    COUNT(*) FILTER (WHERE status = 'opened') as emails_opened,
    COUNT(*) FILTER (WHERE status = 'clicked') as emails_clicked,
    COUNT(*) FILTER (WHERE status = 'replied') as emails_replied,
    COUNT(*) FILTER (WHERE status = 'bounced') as emails_bounced,
    COUNT(*) FILTER (WHERE reply_sentiment = 'positive') as positive_replies
  FROM email_tracking
  GROUP BY campaign_id
) et ON c.id = et.campaign_id;

-- Step Performance View
CREATE OR REPLACE VIEW step_performance AS
SELECT 
  et.campaign_id,
  et.step_number,
  COUNT(*) FILTER (WHERE et.status = 'sent') as emails_sent,
  COUNT(*) FILTER (WHERE et.status = 'delivered') as emails_delivered,
  COUNT(*) FILTER (WHERE et.status = 'opened') as emails_opened,
  COUNT(*) FILTER (WHERE et.status = 'clicked') as emails_clicked,
  COUNT(*) FILTER (WHERE et.status = 'replied') as emails_replied,
  COUNT(*) FILTER (WHERE et.status = 'bounced') as emails_bounced,
  
  -- Step-specific rates
  CASE 
    WHEN COUNT(*) FILTER (WHERE et.status = 'sent') > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE et.status = 'delivered')::DECIMAL / COUNT(*) FILTER (WHERE et.status = 'sent')) * 100, 2)
    ELSE 0 
  END as delivery_rate,
  
  CASE 
    WHEN COUNT(*) FILTER (WHERE et.status = 'delivered') > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE et.status = 'opened')::DECIMAL / COUNT(*) FILTER (WHERE et.status = 'delivered')) * 100, 2)
    ELSE 0 
  END as open_rate,
  
  CASE 
    WHEN COUNT(*) FILTER (WHERE et.status = 'opened') > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE et.status = 'clicked')::DECIMAL / COUNT(*) FILTER (WHERE et.status = 'opened')) * 100, 2)
    ELSE 0 
  END as click_rate,
  
  CASE 
    WHEN COUNT(*) FILTER (WHERE et.status = 'sent') > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE et.status = 'replied')::DECIMAL / COUNT(*) FILTER (WHERE et.status = 'sent')) * 100, 2)
    ELSE 0 
  END as reply_rate

FROM email_tracking et
GROUP BY et.campaign_id, et.step_number;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_tags ON campaigns USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact_id ON campaign_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_next_scheduled ON campaign_contacts(next_email_scheduled_at) WHERE next_email_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign_id ON email_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_contact_id ON email_tracking(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_status ON email_tracking(status);
CREATE INDEX IF NOT EXISTS idx_email_tracking_step_number ON email_tracking(step_number);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sent_at ON email_tracking(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_pixel_id ON email_tracking(tracking_pixel_id);

CREATE INDEX IF NOT EXISTS idx_campaign_templates_category ON campaign_templates(category);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_public ON campaign_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_campaign_templates_tags ON campaign_templates USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_contact_lists_user_id ON contact_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_tags ON contact_lists USING GIN(tags);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_contacts_updated_at 
    BEFORE UPDATE ON campaign_contacts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_tracking_updated_at 
    BEFORE UPDATE ON email_tracking 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_templates_updated_at 
    BEFORE UPDATE ON campaign_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_lists_updated_at 
    BEFORE UPDATE ON contact_lists 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) Policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;

-- Campaigns policies
CREATE POLICY \"Users can view their own campaigns\" ON campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert their own campaigns\" ON campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update their own campaigns\" ON campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY \"Users can delete their own campaigns\" ON campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Campaign contacts policies
CREATE POLICY \"Users can view campaign contacts from their campaigns\" ON campaign_contacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = campaign_contacts.campaign_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY \"System can manage campaign contacts\" ON campaign_contacts
    FOR ALL USING (true); -- Allow system operations

-- Email tracking policies
CREATE POLICY \"Users can view email tracking from their campaigns\" ON email_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = email_tracking.campaign_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY \"System can manage email tracking\" ON email_tracking
    FOR ALL USING (true); -- Allow system operations

-- Campaign templates policies
CREATE POLICY \"Users can view public templates and their own templates\" ON campaign_templates
    FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY \"Users can insert their own templates\" ON campaign_templates
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY \"Users can update their own templates\" ON campaign_templates
    FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY \"Users can delete their own templates\" ON campaign_templates
    FOR DELETE USING (created_by = auth.uid());

-- Contact lists policies
CREATE POLICY \"Users can view their own contact lists\" ON contact_lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert their own contact lists\" ON contact_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update their own contact lists\" ON contact_lists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY \"Users can delete their own contact lists\" ON contact_lists
    FOR DELETE USING (auth.uid() = user_id);

-- Functions for campaign management

-- Function to get campaign progress
CREATE OR REPLACE FUNCTION get_campaign_progress(campaign_uuid UUID)
RETURNS TABLE(
    campaign_id UUID,
    total_contacts INTEGER,
    active_contacts INTEGER,
    completed_contacts INTEGER,
    current_step_distribution JSONB,
    next_scheduled_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.campaign_id,
        COUNT(*)::INTEGER as total_contacts,
        COUNT(*) FILTER (WHERE cc.status = 'active')::INTEGER as active_contacts,
        COUNT(*) FILTER (WHERE cc.status = 'completed')::INTEGER as completed_contacts,
        jsonb_object_agg(cc.current_step, step_count) as current_step_distribution,
        COUNT(*) FILTER (WHERE cc.next_email_scheduled_at IS NOT NULL AND cc.next_email_scheduled_at > NOW())::INTEGER as next_scheduled_count
    FROM campaign_contacts cc
    LEFT JOIN (
        SELECT current_step, COUNT(*) as step_count
        FROM campaign_contacts
        WHERE campaign_id = campaign_uuid
        GROUP BY current_step
    ) step_dist ON cc.current_step = step_dist.current_step
    WHERE cc.campaign_id = campaign_uuid
    GROUP BY cc.campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to duplicate a campaign
CREATE OR REPLACE FUNCTION duplicate_campaign(
    original_campaign_id UUID,
    new_name VARCHAR(255),
    user_uuid UUID
) RETURNS UUID AS $$
DECLARE
    new_campaign_id UUID;
    original_campaign RECORD;
BEGIN
    -- Get original campaign
    SELECT * INTO original_campaign
    FROM campaigns
    WHERE id = original_campaign_id AND user_id = user_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign not found or access denied';
    END IF;
    
    -- Create new campaign
    INSERT INTO campaigns (
        user_id,
        name,
        description,
        status,
        contact_list_ids,
        email_sequence,
        ai_settings,
        schedule_settings,
        ab_test_settings,
        tags
    ) VALUES (
        user_uuid,
        new_name,
        original_campaign.description,
        'draft',
        original_campaign.contact_list_ids,
        original_campaign.email_sequence,
        original_campaign.ai_settings,
        original_campaign.schedule_settings,
        original_campaign.ab_test_settings,
        original_campaign.tags
    ) RETURNING id INTO new_campaign_id;
    
    RETURN new_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive old completed campaigns
CREATE OR REPLACE FUNCTION archive_old_campaigns(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE campaigns 
    SET status = 'archived', archived_at = NOW()
    WHERE status = 'completed'
    AND completed_at < NOW() - (days_old || ' days')::INTERVAL
    AND archived_at IS NULL;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON campaign_statistics TO authenticated;
GRANT SELECT ON step_performance TO authenticated;

-- Comments for documentation
COMMENT ON TABLE campaigns IS 'Main campaigns table storing email sequence campaigns';
COMMENT ON TABLE campaign_contacts IS 'Tracks individual contact progress through campaigns';
COMMENT ON TABLE email_tracking IS 'Detailed email tracking and analytics data';
COMMENT ON TABLE campaign_templates IS 'Reusable campaign templates';
COMMENT ON TABLE contact_lists IS 'Contact list management';

COMMENT ON VIEW campaign_statistics IS 'Aggregated campaign performance statistics';
COMMENT ON VIEW step_performance IS 'Step-by-step campaign performance metrics';

COMMENT ON FUNCTION get_campaign_progress IS 'Get real-time campaign progress information';
COMMENT ON FUNCTION duplicate_campaign IS 'Create a copy of an existing campaign';
COMMENT ON FUNCTION archive_old_campaigns IS 'Archive old completed campaigns for cleanup';"