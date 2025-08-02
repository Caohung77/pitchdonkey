-- Indexes for optimal query performance on domain authentication tables

-- Domain auth table indexes
CREATE INDEX IF NOT EXISTS idx_domain_auth_user_id ON domain_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_auth_domain ON domain_auth(domain);
CREATE INDEX IF NOT EXISTS idx_domain_auth_user_domain ON domain_auth(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_domain_auth_verification_status ON domain_auth(spf_verified, dkim_verified, dmarc_verified);
CREATE INDEX IF NOT EXISTS idx_domain_auth_last_checked ON domain_auth(spf_last_checked, dkim_last_checked, dmarc_last_checked);

-- DNS provider credentials indexes
CREATE INDEX IF NOT EXISTS idx_dns_provider_credentials_user_id ON dns_provider_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_dns_provider_credentials_provider ON dns_provider_credentials(provider);
CREATE INDEX IF NOT EXISTS idx_dns_provider_credentials_active ON dns_provider_credentials(is_active);

-- Domain verification history indexes
CREATE INDEX IF NOT EXISTS idx_domain_verification_history_domain_auth_id ON domain_verification_history(domain_auth_id);
CREATE INDEX IF NOT EXISTS idx_domain_verification_history_checked_at ON domain_verification_history(checked_at);
CREATE INDEX IF NOT EXISTS idx_domain_verification_history_type_status ON domain_verification_history(verification_type, status);

-- Update triggers for automatic timestamp management
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