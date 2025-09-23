-- Adds engagement scoring fields to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS engagement_status TEXT NOT NULL DEFAULT 'not_contacted',
  ADD COLUMN IF NOT EXISTS engagement_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_last_positive_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engagement_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure fast filtering by engagement status/score
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_status ON contacts(engagement_status);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_score ON contacts(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_last_positive ON contacts(engagement_last_positive_at DESC);
