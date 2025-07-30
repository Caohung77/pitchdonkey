-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL, -- in cents
    currency CHAR(3) NOT NULL DEFAULT 'usd',
    interval VARCHAR(10) NOT NULL CHECK (interval IN ('month', 'year')),
    features JSONB NOT NULL DEFAULT '[]',
    limits JSONB NOT NULL DEFAULT '{}',
    stripe_price_id VARCHAR(255) NOT NULL UNIQUE,
    is_popular BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    trial_end TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage Metrics Table
CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    period VARCHAR(7) NOT NULL, -- YYYY-MM format
    emails_sent INTEGER DEFAULT 0,
    contacts_count INTEGER DEFAULT 0,
    campaigns_count INTEGER DEFAULT 0,
    templates_count INTEGER DEFAULT 0,
    automations_count INTEGER DEFAULT 0,
    team_members_count INTEGER DEFAULT 1,
    api_calls_count INTEGER DEFAULT 0,
    custom_domains_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period)
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id VARCHAR(255) NOT NULL,
    stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
    amount INTEGER NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'usd',
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    invoice_url TEXT,
    invoice_pdf TEXT,
    line_items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'bank_account')),
    brand VARCHAR(50),
    last4 VARCHAR(4) NOT NULL,
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    billing_address JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add stripe_customer_id to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_period ON usage_metrics(user_id, period);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(user_id, is_default);

-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, description, price, currency, interval, features, limits, stripe_price_id, is_popular) VALUES
(
    'starter',
    'Starter',
    'Perfect for individuals and small teams getting started with cold email outreach',
    4900, -- $49.00
    'usd',
    'month',
    '[
        {"name": "Email Accounts", "description": "Connect up to 1 email account", "included": true, "limit": 1},
        {"name": "Contacts", "description": "Store up to 1,000 contacts", "included": true, "limit": 1000},
        {"name": "Monthly Emails", "description": "Send up to 2,000 emails per month", "included": true, "limit": 2000},
        {"name": "AI Personalization", "description": "AI-powered email personalization", "included": true},
        {"name": "Basic Analytics", "description": "Track opens, clicks, and replies", "included": true},
        {"name": "Email Templates", "description": "Access to email templates", "included": true, "limit": 10},
        {"name": "Campaign Sequences", "description": "Create automated sequences", "included": true, "limit": 3},
        {"name": "Email Support", "description": "Standard email support", "included": true}
    ]',
    '{
        "emailsPerMonth": 2000,
        "contactsLimit": 1000,
        "campaignsLimit": 3,
        "templatesLimit": 10,
        "automationsLimit": 5,
        "teamMembersLimit": 1,
        "apiCallsPerMonth": 1000,
        "customDomains": 0,
        "advancedAnalytics": false,
        "prioritySupport": false,
        "whiteLabel": false
    }',
    'price_starter_monthly',
    false
),
(
    'professional',
    'Professional',
    'Ideal for growing businesses and sales teams scaling their outreach',
    14900, -- $149.00
    'usd',
    'month',
    '[
        {"name": "Email Accounts", "description": "Connect up to 3 email accounts", "included": true, "limit": 3},
        {"name": "Contacts", "description": "Store up to 10,000 contacts", "included": true, "limit": 10000},
        {"name": "Monthly Emails", "description": "Send up to 10,000 emails per month", "included": true, "limit": 10000},
        {"name": "AI Personalization", "description": "Advanced AI personalization with custom prompts", "included": true},
        {"name": "Advanced Analytics", "description": "Detailed analytics and reporting", "included": true},
        {"name": "Email Templates", "description": "Unlimited email templates", "included": true},
        {"name": "Campaign Sequences", "description": "Unlimited automated sequences", "included": true},
        {"name": "A/B Testing", "description": "Split test your campaigns", "included": true},
        {"name": "Team Collaboration", "description": "Up to 3 team members", "included": true, "limit": 3},
        {"name": "Priority Support", "description": "Priority email and chat support", "included": true},
        {"name": "Custom Domains", "description": "Connect custom sending domains", "included": true, "limit": 1}
    ]',
    '{
        "emailsPerMonth": 10000,
        "contactsLimit": 10000,
        "campaignsLimit": 25,
        "templatesLimit": -1,
        "automationsLimit": 50,
        "teamMembersLimit": 3,
        "apiCallsPerMonth": 10000,
        "customDomains": 1,
        "advancedAnalytics": true,
        "prioritySupport": true,
        "whiteLabel": false
    }',
    'price_professional_monthly',
    true
),
(
    'agency',
    'Agency',
    'Built for agencies and enterprises managing multiple clients and high-volume campaigns',
    39900, -- $399.00
    'usd',
    'month',
    '[
        {"name": "Email Accounts", "description": "Connect up to 10 email accounts", "included": true, "limit": 10},
        {"name": "Contacts", "description": "Store up to 50,000 contacts", "included": true, "limit": 50000},
        {"name": "Monthly Emails", "description": "Send up to 50,000 emails per month", "included": true, "limit": 50000},
        {"name": "AI Personalization", "description": "Enterprise AI with custom models", "included": true},
        {"name": "Advanced Analytics", "description": "Enterprise analytics and custom reports", "included": true},
        {"name": "Email Templates", "description": "Unlimited email templates", "included": true},
        {"name": "Campaign Sequences", "description": "Unlimited automated sequences", "included": true},
        {"name": "A/B Testing", "description": "Advanced split testing", "included": true},
        {"name": "Team Collaboration", "description": "Up to 10 team members", "included": true, "limit": 10},
        {"name": "White Label", "description": "Remove ColdReach Pro branding", "included": true},
        {"name": "Custom Domains", "description": "Unlimited custom sending domains", "included": true},
        {"name": "API Access", "description": "Full API access with higher limits", "included": true},
        {"name": "Dedicated Support", "description": "Dedicated account manager", "included": true}
    ]',
    '{
        "emailsPerMonth": 50000,
        "contactsLimit": 50000,
        "campaignsLimit": -1,
        "templatesLimit": -1,
        "automationsLimit": -1,
        "teamMembersLimit": 10,
        "apiCallsPerMonth": 100000,
        "customDomains": -1,
        "advancedAnalytics": true,
        "prioritySupport": true,
        "whiteLabel": true
    }',
    'price_agency_monthly',
    false
)
ON CONFLICT (id) DO NOTHING;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Subscription plans are public (read-only)
CREATE POLICY "Subscription plans are viewable by everyone" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Users can only see their own subscription data
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage metrics" ON usage_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices" ON invoices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payment methods" ON payment_methods
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all subscription data
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage usage metrics" ON usage_metrics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage invoices" ON invoices
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage payment methods" ON payment_methods
    FOR ALL USING (auth.role() = 'service_role');
-- Usag
e Alerts Table
CREATE TABLE IF NOT EXISTS usage_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    threshold INTEGER NOT NULL CHECK (threshold >= 0 AND threshold <= 100),
    current_usage INTEGER NOT NULL,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning', 'limit_reached', 'limit_exceeded')),
    is_active BOOLEAN DEFAULT TRUE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage Restrictions Table
CREATE TABLE IF NOT EXISTS usage_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL,
    is_restricted BOOLEAN DEFAULT TRUE,
    reason TEXT NOT NULL,
    can_purchase_addon BOOLEAN DEFAULT FALSE,
    restricted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    removed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, feature)
);

-- Usage Notifications Table
CREATE TABLE IF NOT EXISTS usage_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('usage_warning', 'limit_reached', 'limit_exceeded', 'addon_available')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Addon Purchases Table
CREATE TABLE IF NOT EXISTS addon_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addon_type VARCHAR(20) NOT NULL CHECK (addon_type IN ('emails', 'contacts', 'campaigns', 'templates')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price INTEGER NOT NULL, -- in cents
    stripe_payment_intent_id VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for usage monitoring tables
CREATE INDEX IF NOT EXISTS idx_usage_alerts_user_id ON usage_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_is_active ON usage_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_usage_restrictions_user_feature ON usage_restrictions(user_id, feature);
CREATE INDEX IF NOT EXISTS idx_usage_restrictions_is_restricted ON usage_restrictions(user_id, is_restricted);
CREATE INDEX IF NOT EXISTS idx_usage_notifications_user_id ON usage_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_notifications_is_read ON usage_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_addon_purchases_user_id ON addon_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_addon_purchases_status ON addon_purchases(user_id, status);

-- RLS Policies for usage monitoring tables
ALTER TABLE usage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_purchases ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage data
CREATE POLICY "Users can view own usage alerts" ON usage_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage restrictions" ON usage_restrictions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage notifications" ON usage_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage notifications" ON usage_notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own addon purchases" ON addon_purchases
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all usage monitoring data
CREATE POLICY "Service role can manage usage alerts" ON usage_alerts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage usage restrictions" ON usage_restrictions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage usage notifications" ON usage_notifications
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage addon purchases" ON addon_purchases
    FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically clean up old alerts and notifications
CREATE OR REPLACE FUNCTION cleanup_old_usage_data()
RETURNS void AS $$
BEGIN
    -- Delete acknowledged alerts older than 30 days
    DELETE FROM usage_alerts 
    WHERE is_active = false 
    AND acknowledged_at < NOW() - INTERVAL '30 days';
    
    -- Delete read notifications older than 90 days
    DELETE FROM usage_notifications 
    WHERE is_read = true 
    AND created_at < NOW() - INTERVAL '90 days';
    
    -- Delete expired addon purchases older than 1 year
    DELETE FROM addon_purchases 
    WHERE expires_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (this would typically be done via pg_cron or external scheduler)
-- SELECT cron.schedule('cleanup-usage-data', '0 2 * * *', 'SELECT cleanup_old_usage_data();');