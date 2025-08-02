-- Domain Authentication Database Schema
-- This schema supports SPF, DKIM, and DMARC record management and verification

-- Domain authentication tracking table
CREATE TABLE IF NOT EXISTS domain_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  
  -- SPF configuration and status
  spf_verified BOOLEAN DEFAULT FALSE,
  spf_record TEXT,
  spf_last_checked TIMESTAMP WITH TIME ZONE,
  spf_error_message TEXT,
  
  -- DKIM configuration and status
  dkim_verified BOOLEAN DEFAULT FALSE,
  dkim_selector TEXT DEFAULT 'coldreach2024',
  dkim_public_key TEXT,
  dkim_private_key TEXT, -- Will be encrypted in application layer
  dkim_last_checked TIMESTAMP WITH TIME ZONE,
  dkim_error_message TEXT,
  
  -- DMARC configuration and status
  dmarc_verified BOOLEAN DEFAULT FALSE,
  dmarc_record TEXT,
  dmarc_policy TEXT DEFAULT 'none', -- none, quarantine, reject
  dmarc_percentage INTEGER DEFAULT 25,
  dmarc_report_email TEXT,
  dmarc_last_checked TIMESTAMP WITH TIME ZONE,
  dmarc_error_message TEXT,
  
  -- Provider and automation settings
  dns_provider TEXT, -- 'cloudflare', 'godaddy', 'namecheap', 'manual', etc.
  auto_configured BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, domain)
);

-- DNS provider credentials table (for API integrations)
CREATE TABLE IF NOT EXISTS dns_provider_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'cloudflare', 'godaddy', 'route53', etc.
  provider_name TEXT, -- User-friendly name for the credential set
  credentials JSONB NOT NULL, -- Encrypted API keys/tokens stored as JSON
  is_active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, provider, provider_name)
);

-- Domain verification history table (for monitoring and audit trail)
CREATE TABLE IF NOT EXISTS domain_verification_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_auth_id UUID NOT NULL REFERENCES domain_auth(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('spf', 'dkim', 'dmarc')),
  status BOOLEAN NOT NULL,
  error_message TEXT,
  dns_response TEXT, -- Store the actual DNS response for debugging
  response_time_ms INTEGER, -- Track DNS lookup performance
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index for efficient querying
  INDEX idx_domain_verification_history_domain_auth_id ON domain_verification_history(domain_auth_id),
  INDEX idx_domain_verification_history_checked_at ON domain_verification_history(checked_at)
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_domain_auth_user_id ON domain_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_auth_domain ON domain_auth(domain);
CREATE INDEX IF NOT EXISTS idx_domain_auth_user_domain ON domain_auth(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_domain_auth_verification_status ON domain_auth(spf_verified, dkim_verified, dmarc_verified);
CREATE INDEX IF NOT EXISTS idx_domain_auth_last_checked ON domain_auth(spf_last_checked, dkim_last_checked, dmarc_last_checked);

CREATE INDEX IF NOT EXISTS idx_dns_provider_credentials_user_id ON dns_provider_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_dns_provider_credentials_provider ON dns_provider_credentials(provider);
CREATE INDEX IF NOT EXISTS idx_dns_provider_credentials_active ON dns_provider_credentials(is_active);

-- Update trigger for domain_auth updated_at
CREATE OR REPLACE FUNCTION update_domain_auth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_domain_auth_updated_at
  BEFORE UPDATE ON domain_auth
  FOR EACH ROW
  EXECUTE FUNCTION update_domain_auth_updated_at();

-- Update trigger for dns_provider_credentials updated_at
CREATE OR REPLACE FUNCTION update_dns_provider_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dns_provider_credentials_updated_at
  BEFORE UPDATE ON dns_provider_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_dns_provider_credentials_updated_at();

-- Function to automatically create domain_auth record when email_accounts domain is not tracked
CREATE OR REPLACE FUNCTION auto_create_domain_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert domain_auth record if it doesn't exist for this user/domain combination
  INSERT INTO domain_auth (user_id, domain)
  VALUES (NEW.user_id, NEW.domain)
  ON CONFLICT (user_id, domain) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create domain_auth when email_accounts are created/updated
CREATE TRIGGER trigger_auto_create_domain_auth
  AFTER INSERT OR UPDATE OF domain ON email_accounts
  FOR EACH ROW
  WHEN (NEW.domain IS NOT NULL)
  EXECUTE FUNCTION auto_create_domain_auth();

-- View for easy domain authentication status overview
CREATE OR REPLACE VIEW domain_auth_overview AS
SELECT 
  da.id,
  da.user_id,
  da.domain,
  da.spf_verified,
  da.dkim_verified,
  da.dmarc_verified,
  (da.spf_verified AND da.dkim_verified AND da.dmarc_verified) AS fully_verified,
  da.dns_provider,
  da.auto_configured,
  da.created_at,
  da.updated_at,
  -- Count of associated email accounts
  COUNT(ea.id) AS email_account_count,
  -- Latest verification check
  GREATEST(da.spf_last_checked, da.dkim_last_checked, da.dmarc_last_checked) AS last_verification_check,
  -- Overall health status
  CASE 
    WHEN da.spf_verified AND da.dkim_verified AND da.dmarc_verified THEN 'excellent'
    WHEN (da.spf_verified AND da.dkim_verified) OR (da.spf_verified AND da.dmarc_verified) THEN 'good'
    WHEN da.spf_verified THEN 'basic'
    ELSE 'poor'
  END AS health_status
FROM domain_auth da
LEFT JOIN email_accounts ea ON ea.domain = da.domain AND ea.user_id = da.user_id
GROUP BY da.id, da.user_id, da.domain, da.spf_verified, da.dkim_verified, da.dmarc_verified, 
         da.dns_provider, da.auto_configured, da.created_at, da.updated_at,
         da.spf_last_checked, da.dkim_last_checked, da.dmarc_last_checked;

-- Grant appropriate permissions (adjust based on your RLS policies)
-- These would typically be handled by your Supabase RLS policies
-- ALTER TABLE domain_auth ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dns_provider_credentials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE domain_verification_history ENABLE ROW LEVEL SECURITY;