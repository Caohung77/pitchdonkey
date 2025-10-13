-- Add gender and appearance_description fields to ai_personas table
-- These fields support the Appearance step in persona creation wizard

ALTER TABLE ai_personas
ADD COLUMN IF NOT EXISTS gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'non-binary'));

ALTER TABLE ai_personas
ADD COLUMN IF NOT EXISTS appearance_description TEXT;

-- Add comment documenting the new fields
COMMENT ON COLUMN ai_personas.gender IS 'Gender of the persona, used for avatar generation';
COMMENT ON COLUMN ai_personas.appearance_description IS 'Custom appearance description provided by user for avatar generation';
