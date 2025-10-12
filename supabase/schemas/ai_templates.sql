-- AI Templates minimal migration
-- Run this in Supabase SQL Editor to enable saving email templates

-- Requirements: uuid-ossp extension and users table already exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create table
CREATE TABLE IF NOT EXISTS public.ai_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',

  -- Template content
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,

  -- Optional AI settings
  ai_provider TEXT DEFAULT 'openai' CHECK (ai_provider IN ('openai','anthropic')),
  ai_model TEXT DEFAULT 'gpt-4',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,

  -- Usage metrics
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,4) DEFAULT 0.0000,

  -- Extracted variables from {{variable}} in body_template
  variables JSONB DEFAULT '[]',

  is_public BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional notes field for custom AI prompt/instructions
ALTER TABLE public.ai_templates
ADD COLUMN IF NOT EXISTS custom_prompt TEXT;
ALTER TABLE public.ai_templates
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Enhanced template fields for complete campaign state
ALTER TABLE public.ai_templates
ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.ai_templates
ADD COLUMN IF NOT EXISTS email_purpose TEXT;
ALTER TABLE public.ai_templates
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English';
ALTER TABLE public.ai_templates
ADD COLUMN IF NOT EXISTS generation_options JSONB DEFAULT '{"generate_for_all": false, "use_contact_info": true}';
ALTER TABLE public.ai_templates
ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'campaign';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_templates_user_id ON public.ai_templates(user_id);

-- Row Level Security
ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;

-- Recreate policies idempotently (CREATE POLICY has no IF NOT EXISTS)
DROP POLICY IF EXISTS "Users can view own and public AI templates" ON public.ai_templates;
CREATE POLICY "Users can view own and public AI templates"
ON public.ai_templates FOR SELECT
USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can insert own AI templates" ON public.ai_templates;
CREATE POLICY "Users can insert own AI templates"
ON public.ai_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own AI templates" ON public.ai_templates;
CREATE POLICY "Users can update own AI templates"
ON public.ai_templates FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own AI templates" ON public.ai_templates;
CREATE POLICY "Users can delete own AI templates"
ON public.ai_templates FOR DELETE
USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger idempotently (no IF NOT EXISTS for triggers)
DROP TRIGGER IF EXISTS update_ai_templates_updated_at ON public.ai_templates;
CREATE TRIGGER update_ai_templates_updated_at
BEFORE UPDATE ON public.ai_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Done. Verify with: SELECT count(*) FROM public.ai_templates;
