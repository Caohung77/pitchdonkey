-- Migration: Sequence Campaign Infrastructure (Phase 1)
-- Purpose: Introduce shared tables to support multi-phase campaign sequences
-- Date: 2025-10-16

-- Create primary sequence metadata table
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  entry_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sequences_unique_entry_campaign UNIQUE (entry_campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_sequences_user_id
  ON sequences(user_id);

CREATE INDEX IF NOT EXISTS idx_sequences_status
  ON sequences(status);

-- Track ordering and campaign membership inside a sequence
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sequence_position INTEGER CHECK (sequence_position IS NULL OR sequence_position >= 1);

CREATE INDEX IF NOT EXISTS idx_campaigns_sequence_id
  ON campaigns(sequence_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_sequence_order
  ON campaigns(sequence_id, sequence_position);

COMMENT ON COLUMN campaigns.sequence_id IS 'Optional reference to the parent sequence when this campaign is part of a multi-step flow';
COMMENT ON COLUMN campaigns.sequence_position IS 'Board ordering for campaigns belonging to the same sequence (1 = entry column)';

-- Define sequence link settings between campaigns
CREATE TABLE IF NOT EXISTS sequence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  parent_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  next_campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  delay_days INTEGER NOT NULL DEFAULT 3 CHECK (delay_days >= 0),
  delay_hours INTEGER NOT NULL DEFAULT 0 CHECK (delay_hours >= 0 AND delay_hours < 24),
  condition_type TEXT NOT NULL DEFAULT 'no_reply'
    CHECK (condition_type IN ('no_reply', 'opened_no_reply', 'always', 'custom')),
  min_opens INTEGER NOT NULL DEFAULT 0 CHECK (min_opens >= 0),
  min_clicks INTEGER NOT NULL DEFAULT 0 CHECK (min_clicks >= 0),
  engagement_required BOOLEAN NOT NULL DEFAULT false,
  filter_auto_reply BOOLEAN NOT NULL DEFAULT true,
  filter_bounced BOOLEAN NOT NULL DEFAULT true,
  filter_unsubscribed BOOLEAN NOT NULL DEFAULT true,
  persona_override_id UUID,
  delivery_window JSONB DEFAULT '{}'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sequence_links_unique_transition UNIQUE (sequence_id, parent_campaign_id, next_campaign_id),
  CONSTRAINT sequence_links_no_self_reference CHECK (parent_campaign_id IS NULL OR parent_campaign_id <> next_campaign_id)
);

-- Ensure new filter columns exist even if table was created previously
ALTER TABLE sequence_links
  ADD COLUMN IF NOT EXISTS filter_auto_reply BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE sequence_links
  ADD COLUMN IF NOT EXISTS filter_bounced BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE sequence_links
  ADD COLUMN IF NOT EXISTS filter_unsubscribed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN sequence_links.filter_auto_reply IS 'If true, skip contacts with active auto reply before moving to next campaign';
COMMENT ON COLUMN sequence_links.filter_bounced IS 'If true, skip contacts that have bounced in previous steps';
COMMENT ON COLUMN sequence_links.filter_unsubscribed IS 'If true, skip contacts that unsubscribed in previous steps';

CREATE INDEX IF NOT EXISTS idx_sequence_links_sequence_id
  ON sequence_links(sequence_id);

CREATE INDEX IF NOT EXISTS idx_sequence_links_parent_campaign
  ON sequence_links(parent_campaign_id)
  WHERE parent_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sequence_links_next_campaign
  ON sequence_links(next_campaign_id);

-- Track contact enrollment and progression through sequences
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  current_link_id UUID REFERENCES sequence_links(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'stopped', 'paused')),
  last_transition_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sequence_enrollments_unique_contact UNIQUE (sequence_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_contact
  ON sequence_enrollments(sequence_id, contact_id);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_current_campaign
  ON sequence_enrollments(current_campaign_id)
  WHERE current_campaign_id IS NOT NULL;

-- Maintain updated_at columns automatically (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_sequences_updated_at'
  ) THEN
    CREATE TRIGGER update_sequences_updated_at
      BEFORE UPDATE ON sequences
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_sequence_links_updated_at'
  ) THEN
    CREATE TRIGGER update_sequence_links_updated_at
      BEFORE UPDATE ON sequence_links
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_sequence_enrollments_updated_at'
  ) THEN
    CREATE TRIGGER update_sequence_enrollments_updated_at
      BEFORE UPDATE ON sequence_enrollments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- Row Level Security policies for sequences (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users can view own sequences'
  ) THEN
    CREATE POLICY "Users can view own sequences"
      ON sequences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users can insert own sequences'
  ) THEN
    CREATE POLICY "Users can insert own sequences"
      ON sequences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users can update own sequences'
  ) THEN
    CREATE POLICY "Users can update own sequences"
      ON sequences FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users can delete own sequences'
  ) THEN
    CREATE POLICY "Users can delete own sequences"
      ON sequences FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Row Level Security policies for sequence links (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_links'
      AND policyname = 'Users can view sequence links'
  ) THEN
    CREATE POLICY "Users can view sequence links"
      ON sequence_links FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_links.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_links'
      AND policyname = 'Users can insert sequence links'
  ) THEN
    CREATE POLICY "Users can insert sequence links"
      ON sequence_links FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_links.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_links'
      AND policyname = 'Users can update sequence links'
  ) THEN
    CREATE POLICY "Users can update sequence links"
      ON sequence_links FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_links.sequence_id
            AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_links.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_links'
      AND policyname = 'Users can delete sequence links'
  ) THEN
    CREATE POLICY "Users can delete sequence links"
      ON sequence_links FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_links.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Row Level Security policies for sequence enrollments (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users can view sequence enrollments'
  ) THEN
    CREATE POLICY "Users can view sequence enrollments"
      ON sequence_enrollments FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_enrollments.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users can insert sequence enrollments'
  ) THEN
    CREATE POLICY "Users can insert sequence enrollments"
      ON sequence_enrollments FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_enrollments.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users can update sequence enrollments'
  ) THEN
    CREATE POLICY "Users can update sequence enrollments"
      ON sequence_enrollments FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_enrollments.sequence_id
            AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_enrollments.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users can delete sequence enrollments'
  ) THEN
    CREATE POLICY "Users can delete sequence enrollments"
      ON sequence_enrollments FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM sequences s
          WHERE s.id = sequence_enrollments.sequence_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Conditionally add foreign key to outreach_agents if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'outreach_agents'
  ) THEN
    ALTER TABLE sequence_links
      ADD CONSTRAINT sequence_links_persona_override_id_fkey
        FOREIGN KEY (persona_override_id)
        REFERENCES outreach_agents(id)
        ON DELETE SET NULL;
  END IF;
END $$;
