-- Migration: Add Custom Persona Type Support
-- Description: Allow users to create fully custom personas with their own definitions
-- Version: v0.23.1
-- Date: 2025-10-12

-- Add 'custom' to persona_type enum
ALTER TABLE ai_personas
DROP CONSTRAINT IF EXISTS ai_personas_persona_type_check;

ALTER TABLE ai_personas
ADD CONSTRAINT ai_personas_persona_type_check CHECK (persona_type IN (
  'customer_support',
  'sales_rep',
  'sales_development',
  'account_manager',
  'consultant',
  'technical_specialist',
  'success_manager',
  'marketing_specialist',
  'custom'
));

-- Add custom persona definition fields
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS custom_persona_name VARCHAR(255);
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS custom_persona_description TEXT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS custom_role_definition TEXT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS custom_responsibilities TEXT[];
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS custom_communication_guidelines TEXT;
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS custom_example_interactions JSONB DEFAULT '[]'::jsonb;

-- Create personality templates table for users to save/share custom personalities
CREATE TABLE IF NOT EXISTS ai_persona_personality_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  persona_type VARCHAR(50) DEFAULT 'custom',
  personality_traits JSONB NOT NULL,
  custom_role_definition TEXT,
  custom_responsibilities TEXT[],
  custom_communication_guidelines TEXT,
  example_interactions JSONB DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS persona_personality_templates_user_idx ON ai_persona_personality_templates(user_id);
CREATE INDEX IF NOT EXISTS persona_personality_templates_public_idx ON ai_persona_personality_templates(is_public);
CREATE INDEX IF NOT EXISTS persona_personality_templates_type_idx ON ai_persona_personality_templates(persona_type);

-- Add trigger to update timestamp
CREATE OR REPLACE FUNCTION update_personality_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_personality_templates_updated_at ON ai_persona_personality_templates;
CREATE TRIGGER update_personality_templates_updated_at
  BEFORE UPDATE ON ai_persona_personality_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_personality_templates_updated_at();

-- Add comments
COMMENT ON COLUMN ai_personas.custom_persona_name IS 'User-defined name for custom persona type (e.g., "Technical Writer", "Product Manager")';
COMMENT ON COLUMN ai_personas.custom_persona_description IS 'User-defined description of what this custom persona does';
COMMENT ON COLUMN ai_personas.custom_role_definition IS 'Detailed definition of the custom role and its purpose';
COMMENT ON COLUMN ai_personas.custom_responsibilities IS 'List of key responsibilities for this custom persona';
COMMENT ON COLUMN ai_personas.custom_communication_guidelines IS 'Specific guidelines for how this persona should communicate';
COMMENT ON COLUMN ai_personas.custom_example_interactions IS 'Example interactions showing how the persona should behave';

COMMENT ON TABLE ai_persona_personality_templates IS 'Saved personality templates that users can reuse or share';
